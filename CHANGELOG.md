# Changelog — Analizador de Carpetas Culturales

## [1.3] — 2026-06-12

### SEO y Meta
- Index.html: meta description, keywords, Open Graph tags, Twitter Card, canonical URL
- JSON-LD structured data (WebApplication schema)
- Favicon emoji SVG
- og:image con logo del proyecto para compartir en redes
- Endpoint `/robots.txt` con sitemap reference
- Endpoint `/sitemap.xml` con URL principal

### Logo e imágenes
- Logo de carpeta con nodos en el header (fondo blanco con borde para visibilidad)
- Favicon ahora usa el logo PNG en vez de emoji SVG
- og:image actualizada con imagen grupal de colaboración para redes sociales
- Logo y assets movidos a `public/` para que sirvan en producción

### Respuestas más detalladas
- Eliminada restricción "Sé directo y ve al grano"
- Nuevas instrucciones: "Sé detallado y exhaustivo, mientras más análisis mejor"
- Citá fragmentos textuales del PDF para respaldar observaciones
- Items ilimitados en cada sección (antes máximo 3)
- Diagnóstico detallado (antes "máximo 4 líneas")
- Sugerencias sin límite de cantidad
- `maxOutputTokens`: 4.096 → 8.192

### Correcciones
- Contador de visitas: migrado de countapi.xyz (caído) a countapi.mileshilliard.com
- Corregido bug de div faltante en header JSX

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
