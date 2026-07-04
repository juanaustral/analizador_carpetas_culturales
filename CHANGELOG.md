# Changelog — Analizador de Carpetas Culturales

## [1.4] — 2026-07-04

### Nuevas convocatorias FNA
- Agregado tipo `FnaLine` con 2 concursos: Composición ANBA-FNA 2026 y Valoración Patrimonial 2026
- Selector de concurso FNA dentro de la card del organismo
- Criterios específicos de evaluación extraídos del reglamento oficial ANBA-FNA (PDF descargado del sitio de argentina.gob.ar)

### Nuevas convocatorias Ibermúsicas (Ministerio de Cultura)
- Agregado tipo `MinculturaLine` con 15 líneas de convocatoria Ibermúsicas 2026
- Selector de línea Ibermúsicas dentro de la card del Ministerio de Cultura
- 15 líneas: Circulación, Programación, Residencias (artistas e instituciones), Especialización, Proyectos Virtuales, Promoción del Repertorio, Especial Mid Atlantic Arts, Emilia-Romagna, Arts Council England, CPLP, Premio Brasil, Creación de Canciones, Canciones para las Infancias, Composición para Orquesta Sinfónica
- Criterios específicos de evaluación extraídos de las bases oficiales de ibermusicas.org

### Backend
- server.ts actualizado: acepta `fnaLine` y `minculturaLine` en el request
- System prompt ampliado con criterios detallados para cada concurso FNA y cada línea Ibermúsicas
- Prompt de usuario incluye el nombre de la línea específica seleccionada

### SEO y Meta
- Index.html: meta description, keywords, Open Graph tags, Twitter Card, canonical URL
- JSON-LD structured data (WebApplication schema)
- Favicon emoji SVG
- Endpoint `/robots.txt` con sitemap reference
- Endpoint `/sitemap.xml` con URL principal

### Correcciones
- Contador de visitas: migrado de countapi.xyz (caido) a countapi.mileshilliard.com
- Contador ahora es persistente y funcional

---

## [1.2] — 2026-06-12

### Colores en resultados
- **Puntos fuertes**: verde (antes amarillo)
- **Puntos débiles**: rojo (se mantiene)
- **Sugerencias**: amarillo (antes verde)
- Intro de resultado con conteo coloreado por tipo

### Botones y exportación
- **DESCARGAR EN PDF**: reemplaza IMPRIMIR REPORTE, abre HTML estilizado con print
- **DESCARGAR TXT**: incluye attribution "Desarrollado por Juan Martinez Garcia"
- **COPIAR INFORME**: ahora incluye attribution al final
- **COMPARTIR**: genera link `#share=` con attribution incluido

### Interfaz
- Version badge: de amarillo a gris neutral sutil
- Contador de visitas debajo de la versión (siempre visible)
- "VER REQUISITOS CLAVE": botón renombrado con icono Info
- Cards de destino clickeables en toda su superficie
- Texto de bienvenida rediseñado en dos bloques: "¿Qué es?" / "¿Cómo usarla?"
- Footer: "Desarrollado por Juan Martinez Garcia" con link
- Texto disclaimer actualizado a "DATOS PUBLICOS DE LAS ENTIDADES"
- Texto de carga cambiado a "SISTEMA DE ANÁLISIS PARA CONVOCATORIAS ARGENTINAS"

### Límite de API
- Eliminada barra de límite diario del footer
- Reemplazado por mensaje informativo simple
- Servidor marca quota como agotada cuando Gemini devuelve 429
- Frontend bloquea evaluación si quota = 0 con mensaje claro

### Correcciones
- Prompt de sistema: prohibición estricta de introducciones/saludos de la IA
- Prompt de usuario: reforzado sin "por favor" ni saludos

---

## [1.1] — 2026-06-12

### Nuevas funcionalidades
- Medidor de límite de API en footer (barra de 1.500 req/día)
- Formulario de feedback con captcha matemático + almacenamiento en servidor
- SMTP configurado para enviar feedbacks por email
- Botón DESCARGAR TXT del análisis
- Botón COMPARTIR: genera link con resultado codificado en `#share=`
- Keep-alive via GitHub Actions (ping cada 10 min a Render)
- Contador de visitas en header

### Interfaz
- Texto de bienvenida separado en dos bloques
- Cards de destino clickeables en toda la superficie
- Resultados: puntos débiles en rojo, optimización en verde
- Intro informativo con conteo de puntos fuertes, débiles y sugerencias

### Infraestructura
- GitHub: usuario cambiado de `nvnvrs` a `juanaustral`
- Proyecto deployado en Render (plan Free)
- SSH key configurada para pushes sin autenticación extra
- Emails de feedback funcionando con Gmail SMTP

---

## [1.0] — 2026-06-12

### Versión inicial (exportada de Google AI Studio)

### Funcionalidades base
- Subida de PDF con análisis multimodal vía Gemini API
- 3 perfiles de evaluación: FNA, INT, Ministerio de Cultura
- Devolución estructurada en 4 bloques: puntos fuertes, diagnóstico, puntos débiles, sugerencias
- Sistema de reintentos ante errores 503/429 de Gemini

### Stack técnico
- Frontend: React 19 + Vite + Tailwind CSS 4 + motion animations
- Backend: Express + Google GenAI SDK
- Modelo: Gemini 2.5 Flash

### Correcciones post-exportación
- Modelo corregido: `gemini-3.5-flash` → `gemini-2.5-flash`
- Tokens de salida: 800 → 4096
- Puerto configurable por variable de entorno
- 7 clases CSS inválidas de Tailwind reemplazadas
- Caracter corrupto en vite.config.ts reparado
- Título y lang del HTML fijados
- `experimentalDecorators` eliminado de tsconfig.json
- Nombre del proyecto en package.json corregido
