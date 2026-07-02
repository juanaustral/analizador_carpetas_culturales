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
    const { pdfBase64, destination, intLine } = req.body;

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
- Si el usuario eligió INT (Instituto Nacional del Teatro) sin una línea específica: Evaluá con prioridad la viabilidad técnica, operativa, el desglose de la puesta/gira y el público objetivo.
- Si el usuario eligió INT con una línea específica: Usá los criterios detallados para esa línea (ver abajo).
- Si el usuario eligió Ministerio de Cultura: Evaluá con prioridad el impacto sociocomunitario, la inclusión y el desarrollo territorial.

# CRITERIOS ESPECÍFICOS POR LÍNEA DEL INT
Cuando el usuario selecciona una línea de postulación del INT, evaluá usando estos criterios:

- **Producción de Obra**: Evaluá (a) Concepto y fundamentación — solidez del concepto y calidad del proyecto para contribuir al quehacer teatral. (b) Factibilidad y sostenibilidad — presupuesto coherente y realista, plan de ejecución claro. (c) Trayectoria y desarrollo de capacidades — antecedentes del equipo, adecuación del desafío artístico. (d) Relevancia cultural y comunitaria — representatividad de la propuesta en su comunidad, pertinencia para el desarrollo regional. (e) Plan estratégico de comunicación y gestión de públicos. (f) Nacionalidad del autor (los espectáculos de autoría nacional son bonificados con 10%).

- **Circulación Nacional e Internacional**: Evaluá (a) Trayectoria, contenido y enfoque artístico del espectáculo. (b) Pertinencia de la actividad y resultados esperados según cronograma e itinerario. (c) Fundamentación del proyecto — objetivos de la circulación, actividades paralelas y alianzas estratégicas. (d) Plan estratégico de comunicación y plan de medios. (e) Antecedentes individuales de los integrantes y del elenco en conjunto. Verificá que la obra tenga al menos 6 funciones realizadas.

- **Eventos y Programaciones**: Evaluá (a) Fortalecimiento cultural y comunitario — vínculo con la comunidad, cantidad de participantes y espectadores estimados. (b) Proyecto artístico y cultural — fundamentación, coherencia organizativa, actividades, viabilidad. (c) Antecedentes personales. (d) Presupuesto — cobertura de gastos a participantes, cachet, alojamiento, comidas y traslados. (e) Plan estratégico de comunicación, prensa y gestión de públicos. (f) Identidad, originalidad e innovación del evento. Verificá que los organizadores acrediten al menos 2 años de actividad.

- **Festivales**: Evaluá (a) Objetivos, concepto, fundamentación, descripción del proyecto y alcance del presupuesto. (b) Cantidad de participantes, cogestiones, alianzas estratégicas, espacios que abarca y pertinencia para el desarrollo regional. (c) Programación — actividades a desarrollar, cantidad de funciones. (d) Antecedentes personales y gestiones en conjunto. (e) Plan estratégico de comunicación y gestión de públicos. (f) Características propias — idiosincrasia, actividades complementarias, subsedes, integración comunitaria. Verificá que el festival tenga al menos 16 espectáculos/actividades.

- **Gestión de Espacios Teatrales**: Evaluá (a) Impacto territorial — vinculación y relevancia cultural del espacio en su comunidad: funciones realizadas, actividades/talleres, redes de colaboración y asociativismo. (b) Proyecto y proyección del espacio — perfil artístico, fundamentación, programación tentativa, equipo de trabajo, infraestructura y equipamiento técnico. (c) Génesis y biografía de la sala — antecedentes de gestión, programación y actividades de los últimos 2 años.

- **Movilidad Internacional**: Evaluá (a) Trayectoria, relevancia y alcance de la institución o formación donde fue aceptado/invitado. (b) Pertinencia de la actividad, objetivos y solidez de la contraprestación propuesta. (c) Desarrollo de capacidades — antecedentes de la persona y beneficio futuro de la acción. (d) Plan estratégico de comunicación y plan de prensa.

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
          text: `Auditá la siguiente carpeta cultural para presentarse ante el organismo de destino: ${destination}${intLine ? `, línea específica: ${intLine}` : ""}. Sin introducciones ni saludos. Arrancá directo con la primera sección. Seguí estrictamente las instrucciones de rol, tono y estructura obligatoria.`,
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
