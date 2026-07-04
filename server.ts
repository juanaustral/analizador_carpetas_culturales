/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DAILY_LIMIT = 1500;

// --- Quota tracker (file-based, persiste en Render single-instance) ---
const QUOTA_FILE = path.join(process.cwd(), "quota.json");

function getQuota(): { date: string; count: number; limit: number } {
  try {
    const raw = fs.readFileSync(QUOTA_FILE, "utf-8");
    const data = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (data.date === today) return data;
  } catch {}
  return { date: new Date().toISOString().slice(0, 10), count: 0, limit: DAILY_LIMIT };
}

function saveQuota(quota: { date: string; count: number; limit: number }) {
  try { fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota)); } catch {}
}

function incrementQuota() {
  const q = getQuota();
  q.count++;
  saveQuota(q);
  return q;
}

function setQuotaExhausted() {
  const q = getQuota();
  q.count = q.limit; // marca como agotado
  saveQuota(q);
}

const VISITS_FILE = path.join(process.cwd(), "visits.json");

function getVisits(): number {
  try { return JSON.parse(fs.readFileSync(VISITS_FILE, "utf-8")).count || 0; }
  catch { return 0; }
}

function incrementVisits() {
  const count = getVisits() + 1;
  try { fs.writeFileSync(VISITS_FILE, JSON.stringify({ count })); } catch {}
  return count;
}

// ---

// Increase body limit to handle PDF base64 uploads safely
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Check for Gemini API key existence and prepare the client
const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Función auxiliar para reintentar la solicitud ante errores temporales del servidor Gemini (p. ej. error 503 por alta demanda o 429 por límite de cuotas)
async function generateContentWithRetry(aiClient: GoogleGenAI, callParams: any, maxRetries = 3, initialDelay = 1500) {
  let attempt = 0;
  while (true) {
    try {
      return await aiClient.models.generateContent(callParams);
    } catch (err: any) {
      attempt++;
      const errorMessage = err?.message || "";
      const is503 = errorMessage.includes("503") || errorMessage.toLowerCase().includes("unavailable") || errorMessage.toLowerCase().includes("high demand") || errorMessage.toLowerCase().includes("temporary");
      const is429 = errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit") || errorMessage.toLowerCase().includes("quota exceeded");
      
      if ((is503 || is429) && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`[Gemini API] La solicitud al modelo falló (intento ${attempt}/${maxRetries}) debido a sobrecarga/demanda (503/429). Reintentando en ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

// API Status — quota + visit info
app.get("/api/status", (_req: Request, res: Response) => {
  const quota = getQuota();
  const visits = incrementVisits();
  res.json({
    usedToday: quota.count,
    limitPerDay: quota.limit,
    remaining: Math.max(0, quota.limit - quota.count),
    visits,
  });
});

// API Feedback — recibe comentarios de los usuarios
const FEEDBACK_FILE = path.join(process.cwd(), "feedback.json");

// --- SEO endpoints ---
app.get("/robots.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Sitemap: https://analizador-carpetas-culturales.onrender.com/sitemap.xml
`);
});

app.get("/sitemap.xml", (_req: Request, res: Response) => {
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://analizador-carpetas-culturales.onrender.com/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`);
});

function saveFeedback(data: { name: string; email: string; message: string; date: string }) {
  try {
    const existing = fs.existsSync(FEEDBACK_FILE)
      ? JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf-8"))
      : [];
    existing.push(data);
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(existing, null, 2));
  } catch (e) {
    console.error("Error guardando feedback:", e);
  }
}

async function tryEmailFeedback(data: { name: string; email: string; message: string }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const feedbackEmail = process.env.FEEDBACK_EMAIL;
  if (!smtpHost || !smtpUser || !smtpPass || !feedbackEmail) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: smtpUser,
      to: feedbackEmail,
      subject: `[Feedback Analizador] ${data.name}`,
      text: `Nombre: ${data.name}\nEmail: ${data.email}\n\nMensaje:\n${data.message}`,
    });
    return true;
  } catch {
    return false;
  }
}

app.post("/api/feedback", async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body as { name?: string; email?: string; message?: string };
    if (!name || !message) {
      return res.status(400).json({ error: "Faltan nombre o mensaje" });
    }
    const data = { name, email: email || "(no especificado)", message, date: new Date().toISOString() };
    saveFeedback(data);
    const emailed = await tryEmailFeedback(data);
    res.json({ ok: true, emailed });
  } catch (err) {
    console.error("Error en /api/feedback:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// API Endpoint to evaluate cultural folders
app.post("/api/evaluate", async (req: Request, res: Response) => {
  try {
    const { pdfBase64, destination, intLine, fnaLine, minculturaLine } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: "Falta el archivo PDF en formato base64." });
    }

    if (!destination) {
      return res.status(400).json({ error: "Falta seleccionar la opción de destino." });
    }

    // Clean up base64 prefix if present
    let cleanedBase64 = pdfBase64;
    if (cleanedBase64.startsWith("data:")) {
      const parts = cleanedBase64.split(",");
      if (parts.length > 1) {
        cleanedBase64 = parts[1];
      }
    }

    const ai = getGeminiClient();

    const systemInstruction = `
# ROL
Sos un Asistente de Evaluación de Proyectos Culturales Independientes en Argentina. Tu tarea es auditar las carpetas en PDF bajo un enfoque constructivo y pedagógico.

# TONO Y ESTILO
- Hablá en español de Argentina (tratar de "vos"), con un tono cercano, empático y alentador.
- Evitá tecnicismos complejos de gestión cultural; explicá los problemas de forma simple para que cualquiera lo entienda.
- Sé directo y ve al grano para optimizar tokens de salida.

# MATRIZ DE EVALUACIÓN SEGÚN LA OPCIÓN SELECCIONADA
- Si el usuario eligió FNA (Fondo Nacional de las Artes): Evaluá con prioridad la fundamentación artística, la originalidad y la trayectoria.
- Si el usuario eligió FNA con un concurso específico: Usá los criterios detallados para ese concurso (ver abajo).
- Si el usuario eligió INT (Instituto Nacional del Teatro) sin una línea específica: Evaluá con prioridad la viabilidad técnica, operativa, el desglose de la puesta/gira y el público objetivo.
- Si el usuario eligió INT con una línea específica: Usá los criterios detallados para esa línea (ver abajo).
- Si el usuario eligió Ministerio de Cultura: Evaluá con prioridad el impacto sociocomunitario, la inclusión y el desarrollo territorial.
- Si el usuario eligió Ministerio de Cultura con una línea de Ibermúsicas específica: Usá los criterios detallados para esa línea (ver abajo).

# CRITERIOS ESPECÍFICOS POR LÍNEA DEL INT
Cuando el usuario selecciona una línea de postulación del INT, evaluá usando estos criterios:

- **Producción de Obra**: Evaluá (a) Concepto y fundamentación — solidez del concepto y calidad del proyecto para contribuir al quehacer teatral. (b) Factibilidad y sostenibilidad — presupuesto coherente y realista, plan de ejecución claro. (c) Trayectoria y desarrollo de capacidades — antecedentes del equipo, adecuación del desafío artístico. (d) Relevancia cultural y comunitaria — representatividad de la propuesta en su comunidad, pertinencia para el desarrollo regional. (e) Plan estratégico de comunicación y gestión de públicos. (f) Nacionalidad del autor (los espectáculos de autoría nacional son bonificados con 10%).

- **Circulación Nacional e Internacional**: Evaluá (a) Trayectoria, contenido y enfoque artístico del espectáculo. (b) Pertinencia de la actividad y resultados esperados según cronograma e itinerario. (c) Fundamentación del proyecto — objetivos de la circulación, actividades paralelas y alianzas estratégicas. (d) Plan estratégico de comunicación y plan de medios. (e) Antecedentes individuales de los integrantes y del elenco en conjunto. Verificá que la obra tenga al menos 6 funciones realizadas.

- **Eventos y Programaciones**: Evaluá (a) Fortalecimiento cultural y comunitario — vínculo con la comunidad, cantidad de participantes y espectadores estimados. (b) Proyecto artístico y cultural — fundamentación, coherencia organizativa, actividades, viabilidad. (c) Antecedentes personales. (d) Presupuesto — cobertura de gastos a participantes, cachet, alojamiento, comidas y traslados. (e) Plan estratégico de comunicación, prensa y gestión de públicos. (f) Identidad, originalidad e innovación del evento. Verificá que los organizadores acrediten al menos 2 años de actividad.

- **Festivales**: Evaluá (a) Objetivos, concepto, fundamentación, descripción del proyecto y alcance del presupuesto. (b) Cantidad de participantes, cogestiones, alianzas estratégicas, espacios que abarca y pertinencia para el desarrollo regional. (c) Programación — actividades a desarrollar, cantidad de funciones. (d) Antecedentes personales y gestiones en conjunto. (e) Plan estratégico de comunicación y gestión de públicos. (f) Características propias — idiosincrasia, actividades complementarias, subsedes, integración comunitaria. Verificá que el festival tenga al menos 16 espectáculos/actividades.

- **Gestión de Espacios Teatrales**: Evaluá (a) Impacto territorial — vinculación y relevancia cultural del espacio en su comunidad: funciones realizadas, actividades/talleres, redes de colaboración y asociativismo. (b) Proyecto y proyección del espacio — perfil artístico, fundamentación, programación tentativa, equipo de trabajo, infraestructura y equipamiento técnico. (c) Génesis y biografía de la sala — antecedentes de gestión, programación y actividades de los últimos 2 años.

- **Movilidad Internacional**: Evaluá (a) Trayectoria, relevancia y alcance de la institución o formación donde fue aceptado/invitado. (b) Pertinencia de la actividad, objetivos y solidez de la contraprestación propuesta. (c) Desarrollo de capacidades — antecedentes de la persona y beneficio futuro de la acción. (d) Plan estratégico de comunicación y plan de prensa.

# CRITERIOS ESPECÍFICOS POR CONCURSO DEL FNA
Cuando el usuario selecciona un concurso específico del FNA, evaluá usando estos criterios:

- **Premio de Composición ANBA-FNA 2026**: Evaluá (a) Cumplimiento de requisitos de admisibilidad — compositor argentino o naturalizado residente, mayor de 18 años, nacido a partir del 1/1/1986. (b) Originalidad e inédititud de la obra — no estrenada ni premiada previamente, registrada en Propiedad Intelectual. (c) Características técnicas — obra coral sin acompañamiento instrumental, duración entre 3 y 12 minutos, coro mixto a no más de 4 voces (divisi a due ocasional, hasta 8 partes reales). (d) Único compositor — no se admiten coautorías, arreglos ni transcripciones. (e) Documentación — partitura con seudónimo en todas las páginas, CV, DNI, autorizaciones de texto si corresponde, certificado de Propiedad Intelectual. (f) Premio — estreno por CONAMA en 2da mitad de 2026 + $2.000.000 + diploma.

- **Concurso Valoración Patrimonial 2026**: Evaluá (a) Pertinencia del sitio seleccionado — relevancia histórica, arquitectónica y cultural del cementerio, templo o lugar sagrado. (b) Metodología de trabajo — plan de registro, documentación y conservación propuesto. (c) Impacto comunitario y vinculación con actores locales. (d) Viabilidad técnica y presupuestaria del proyecto. (e) Antecedentes del equipo de trabajo en patrimonio cultural.

# CRITERIOS ESPECÍFICOS POR LÍNEA DE IBERMÚSICAS (Ministerio de Cultura)
Cuando el usuario selecciona una línea de Ibermúsicas, evaluá usando estos criterios:

- **Circulación de profesionales de la música**: Evaluá (a) Impacto artístico y carácter sostenible del proyecto — relevancia para el desarrollo de lenguajes, géneros, territorios o escenas musicales. (b) Capacidad de generar redes duraderas en el tiempo. (c) Actividades de formación o mediación asociadas (cursos, talleres, clases magistrales, mesas redondas). (d) Pertinencia de la movilidad y coherencia del itinerario/cronograma. (e) Antecedentes del/la postulante y del proyecto.

- **Programación musical**: Evaluá (a) Pertinencia y calidad de la programación propuesta — artistas invitados, actividades e integración con la comunidad local. (b) Trayectoria de la institución organizadora — antecedentes del festival, feria, sala o emprendimiento cultural. (c) Alcance e impacto esperado de las actividades de intercambio. (d) Capacidad de gestión y cofinanciamiento del proyecto. (e) Plan de comunicación y difusión.

- **Residencias para artistas e investigadores**: Evaluá (a) Calidad y solidez de la propuesta de trabajo creativo o de investigación. (b) Pertinencia y trayectoria de la institución o grupo musical anfitrión. (c) Duración mínima de 3 semanas de la residencia. (d) Fundamentación de los objetivos y resultados esperados. (e) Antecedentes del/la postulante y vinculación con la propuesta.

- **Residencias para instituciones**: Evaluá (a) Trayectoria y solidez de la institución convocante. (b) Calidad del programa de residencia propuesto — plan de actividades, duración mínima de 3 semanas, condiciones de recepción. (c) Pertinencia del/la profesional invitado en relación al programa. (d) Impacto esperado en la comunidad musical local. (e) Capacidad de cofinanciamiento y sostenibilidad.

- **Especialización y perfeccionamiento**: Evaluá (a) Pertinencia del plan de especialización para el desarrollo de la carrera del/la postulante. (b) Trayectoria — grado avanzado o experto en el área. (c) Solidez y prestigio de la institución o maestro/a seleccionado/a. (d) Aplicación futura de los conocimientos en la escena iberoamericana. (e) Claridad del cronograma, costos y plan de financiamiento.

- **Proyectos virtuales**: Evaluá (a) Innovación y calidad de la propuesta en entorno digital. (b) Alcance iberoamericano y capacidad de generar vínculos entre países. (c) Viabilidad técnica y presupuestaria. (d) Propuesta de valor para la comunidad musical iberoamericana. (e) Antecedentes del equipo en proyectos digitales.

- **Promoción del repertorio iberoamericano**: Evaluá (a) Calidad y representatividad del repertorio seleccionado. (b) Estrategia de difusión y promoción. (c) Impacto esperado en la visibilidad de la música de la región. (d) Antecedentes del/la postulante en difusión musical. (e) Plan de sostenibilidad y alcance.

- **Especial Mid Atlantic Arts**: Evaluá (a) Pertinencia del proyecto en EE.UU. (b) Gestión de visa de trabajo (P-1, O-1 u otras). (c) Impacto en la proyección internacional del/la artista. (d) Cofinanciamiento con instituciones asociadas. (e) Antecedentes del/la postulante.

- **Especial Emilia-Romagna**: Evaluá (a) Vinculación con la escena musical de Emilia-Romagna, Italia. (b) Calidad de la propuesta de intercambio bilateral. (c) Impacto esperado en ambas regiones. (d) Viabilidad logística y presupuestaria. (e) Antecedentes del/la postulante.

- **Especial Arts Council England**: Evaluá (a) Pertinencia del vínculo con la escena musical inglesa. (b) Impacto bilateral esperado. (c) Trayectoria artística del/la postulante. (d) Viabilidad logística y presupuestaria. (e) Plan de actividades y cronograma detallado. Abierta hasta el 31 de julio.

- **Especial CPLP**: Evaluá (a) Vinculación con países de la Comunidad de Países de Lengua Portuguesa. (b) Calidad de la propuesta de intercambio musical. (c) Impacto en la comunidad lusófona. (d) Viabilidad logística y presupuestaria. (e) Antecedentes en proyectos de cooperación cultural.

- **Premio Brasil Ibermúsicas**: Evaluá (a) Excelencia artística y originalidad. (b) Vinculación y pertinencia del proyecto con Brasil. (c) Trayectoria del/la postulante. (d) Claridad de objetivos y resultados. (e) Plan de difusión y sostenibilidad.

- **Creación de canciones**: Evaluá (a) Originalidad y calidad de la canción. (b) Representatividad iberoamericana. (c) Trayectoria del/la compositor/a. (d) Factibilidad de producción y circulación. (e) Claridad de la propuesta artística.

- **Canciones para las infancias**: Evaluá (a) Adecuación al público infantil. (b) Valor pedagógico y formativo. (c) Calidad musical y originalidad. (d) Trayectoria en música infantil. (e) Claridad de objetivos y plan de circulación.

- **Composición para Orquesta Sinfónica**: Evaluá (a) Creatividad y calidad de la obra sinfónica. (b) Representatividad iberoamericana. (c) Viabilidad técnica para orquesta sinfónica. (d) Claridad de la partitura y materiales. (e) Antecedentes del/la compositor/a en el ámbito sinfónico. Una obra ganadora por país miembro. Estreno por Orquesta Sinfónica Nacional de Cuba o Filarmónica Nacional de Venezuela.

# REGLA CRUCIAL
NO reescribas ni corrijas el texto original del artista. Tu función es auditar y dar feedback.

# REGLA DE FORMATO ESTRICTA
NO agregues ningún saludo, introducción, mensaje personalizado ni texto de apertura. Arrancá DIRECTAMENTE con la primera sección "### 🌟 Puntos Fuertes de la Propuesta". NADA antes de eso.

# ESTRUCTURA OBLIGATORIA DE LA RESPUESTA
Devolvé el análisis usando exactamente esta estructura de títulos:

### 🌟 Puntos Fuertes de la Propuesta
- [Mencionar de 1 a 3 virtudes encontradas en el PDF según el perfil de la convocatoria].

### 🔍 Diagnóstico General de la Carpeta
- [Un breve párrafo de máximo 4 líneas con una mirada global del estado del documento].

### ⚠️ Puntos Débiles e Incongruencias
- **[Aspecto a corregir]**: [Explicación amigable de por qué es un problema o genera confusión].
- **[Dato faltante]**: [Qué información clave omitió el usuario en su PDF y debe agregar].

### 💡 Sugerencias Prácticas para tu Próxima Versión
1. [Acción concreta 1 para mejorar la coherencia].
2. [Acción concreta 2].
3. [Acción concreta 3].
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: cleanedBase64,
            mimeType: "application/pdf",
          },
        },
        {
          text: `Auditá la siguiente carpeta cultural para presentarse ante el organismo de destino: ${destination}${intLine ? `, línea específica del INT: ${intLine}` : ""}${fnaLine ? `, concurso específico del FNA: ${fnaLine}` : ""}${minculturaLine ? `, línea específica de Ibermúsicas: ${minculturaLine}` : ""}. Sin introducciones ni saludos. Arrancá directo con la primera sección. Seguí estrictamente las instrucciones de rol, tono y estructura obligatoria.`,
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    const text = response.text || "No se ha podido generar una devolución adecuada para esta carpeta. Intenta de nuevo.";
    incrementQuota();
    res.json({ text });
  } catch (err: any) {
    console.error("Error al procesar evaluación:", err);
    let userFriendlyError = "Ocurrió un error inesperado al procesar la carpeta.";
    const errString = err.message || "";
    if (errString.includes("503") || errString.toLowerCase().includes("unavailable") || errString.toLowerCase().includes("high demand")) {
      userFriendlyError = "Los servidores de IA están con mucha demanda en este momento (Error 503). Por favor, respirá hondo, esperá unos segundos y volvé a intentar iniciar la auditoría.";
    } else if (errString.includes("429") || errString.toLowerCase().includes("quota")) {
      setQuotaExhausted();
      userFriendlyError = "Alcanzamos el límite temporal de consultas a la IA (Error 429). Aguantanos unos segundos y reintentá.";
    }
    res.status(500).json({ error: userFriendlyError });
  }
});

// Setup development or production server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
