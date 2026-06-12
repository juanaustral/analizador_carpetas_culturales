import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Upload, 
  X, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Globe, 
  Sparkles, 
  Printer, 
  Copy, 
  RefreshCw, 
  ChevronRight,
  BookmarkCheck,
  Building,
  Info,
  ExternalLink,
  Eye,
  ShieldCheck,
  HelpCircle,
  FileCheck,
  MessageCircle,
  Send,
  Mail
} from "lucide-react";

type Destination = "FNA" | "INT" | "Ministerio de Cultura" | "";

interface DestinationDetail {
  id: "FNA" | "INT" | "Ministerio de Cultura";
  label: string;
  org: string;
  focus: string;
  desc: string;
  sources: string;
  sourcesUrl: string;
  detailedAuditGuide: string;
}

const DESTINATIONS: DestinationDetail[] = [
  {
    id: "FNA",
    label: "Fondo Nacional de las Artes",
    org: "FNA",
    focus: "Fundamentación artística, originalidad y trayectoria.",
    desc: "Para becas, subsidios de creación artística o fomento patrimonial en territorio nacional.",
    sources: "Reglamento General de Becas, Concursos y Subsidios del Fondo Nacional de las Artes (FNA)",
    sourcesUrl: "https://fnartes.gob.ar",
    detailedAuditGuide: "La evaluación prioriza de manera estricta la fundamentación estética del proyecto, la originalidad de la propuesta en relación con la producción contemporánea de la disciplina, y la coherencia de la trayectoria de los artistas o colectivos postulantes."
  },
  {
    id: "INT",
    label: "Instituto Nacional del Teatro",
    org: "INT",
    focus: "Viabilidad técnica, operativa, desglose de puesta/gira y público objetivo.",
    desc: "Especial para salas independientes, elencos estables, festivales y giras regionales u nacionales.",
    sources: "Manual de Normas y Reglamentos de Fomento de la Ley Nacional del Teatro N° 24.800 (INT)",
    sourcesUrl: "https://inteatro.ar",
    detailedAuditGuide: "Se enfoca en auditar la factibilidad de ejecución real: desglose minucioso de la puesta en escena, escenografía, viáticos del equipo, cronogramas de giras, adaptabilidad de salas y la definición de públicos destinatarios."
  },
  {
    id: "Ministerio de Cultura",
    label: "Ministerio de Cultura",
    org: "Ministerio de Cultura",
    focus: "Impacto sociocomunitario, inclusión y desarrollo territorial.",
    desc: "Orientado a colectivos barriales, gestores independientes, festivales de alcance social y desarrollo federal.",
    sources: "Directrices Federales e Históricas de Programas del Ministerio/Secretaría de Cultura de la Nación",
    sourcesUrl: "https://www.argentina.gob.ar/cultura",
    detailedAuditGuide: "La matriz de evaluación mide el desarrollo comunitario y la descentralización federal del acceso cultural. Es clave la inclusión social, la perspectiva de género, y el arraigo territorial del proyecto en zonas prioritarias."
  }
];

// Encouraging tips shown in Argentine custom culture slang/tone during loading
const LOADING_PHRASES = [
  "Analizando la viabilidad de la propuesta para tu público objetivo...",
  "Evaluando que no se te haya escapado ningún gasto clave del presupuesto...",
  "Auditando la coherencia de la fundamentación artística...",
  "Revisando los desgloses de puestas, giras e impacto social en territorio...",
  "¡Paciencia! Estamos sintonizando la mirada constructiva y federal...",
  "Cocinando una devolución bien cercana para pulir tu carpeta..."
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>("");
  const [destination, setDestination] = useState<Destination>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState<number>(0);
  const [result, setResult] = useState<string>("");
  const [errorString, setErrorString] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Modal State Controllers
  const [activePriorityDetail, setActivePriorityDetail] = useState<DestinationDetail | null>(null);
  const [showCriteriaModal, setShowCriteriaModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Quota (límite de API) ---
  const [quota, setQuota] = useState<{ usedToday: number; limitPerDay: number; remaining: number } | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setQuota)
      .catch(() => {});
  }, []);

  // --- Feedback ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [captcha, setCaptcha] = useState({ a: 0, b: 0, answer: "" });
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const generateCaptcha = () => ({
    a: Math.floor(Math.random() * 10) + 1,
    b: Math.floor(Math.random() * 10) + 1,
    answer: "",
  });

  const openFeedback = () => {
    setCaptcha(generateCaptcha());
    setFeedbackName("");
    setFeedbackEmail("");
    setFeedbackMsg("");
    setFeedbackSent(false);
    setFeedbackError("");
    setShowFeedbackModal(true);
  };

  // Convert PDF to base64 safely
  const handleFileChange = (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      setErrorString("¡Che! Por favor cargá únicamente archivos PDF. Es el formato oficial requerido para carpetas culturales.");
      return;
    }
    
    // Check file size (limit 15MB to prevent browser lockup or server size overload)
    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorString("El archivo supera el tamaño recomendado. Intentá que pese menos de 15 MB.");
      return;
    }

    setFile(selectedFile);
    setErrorString("");
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPdfBase64(base64);
    };
    reader.onerror = () => {
      setErrorString("Che, hubo un problema técnico leyendo tu archivo PDF. Probá cargarlo de nuevo.");
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPdfBase64("");
    setErrorString("");
  };

  const startLoadingAnimation = () => {
    setLoadingPhraseIndex(0);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 4000);
  };

  const stopLoadingAnimation = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  const handleEvaluate = async () => {
    if (!pdfBase64 || !destination) return;

    setLoading(true);
    setErrorString("");
    setResult("");
    startLoadingAnimation();

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfBase64,
          destination,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error inesperado al procesar el archivo.");
      }

      setResult(data.text);
    } catch (err: any) {
      setErrorString(err.message || "No pudimos conectarnos con el servidor. Chequeá tu conexión en un rato.");
    } finally {
      setLoading(false);
      stopLoadingAnimation();
    }
  };

  const handleCopyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setResult("");
    setFile(null);
    setPdfBase64("");
    setDestination("");
    setErrorString("");
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analisis-cultural-${destination || "general"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!result) return;
    const shareUrl = window.location.origin + window.location.pathname + "#share=" + encodeURIComponent(btoa(unescape(encodeURIComponent(result))));
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("✅ Link de resultado copiado al portapapeles. Compartilo con quien quieras.");
    } catch {
      // fallback
      prompt("Copiá este link para compartir el resultado:", shareUrl);
    }
  };

  // Detect shared result on page load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#share=")) {
      try {
        const raw = hash.slice(7);
        const text = decodeURIComponent(escape(atob(decodeURIComponent(raw))));
        setResult(text);
      } catch {}
    }
  }, []);

  // Helper: resalta texto en **bold** con un color configurable
  const parseBoldText = (text: string, highlightClass = "bg-[#dae122]/30") => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={index} className={`font-extrabold text-neutral-950 ${highlightClass} px-1 py-0.5 text-xs font-mono border-b border-neutral-900`}>
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });
  };

  const renderFormattedResult = (text: string) => {
    const lines = text.split("\n");
    const renderList: React.ReactNode[] = [];
    let inList = false;
    let listType: "bullet" | "numbered" | null = null;
    let currentListItems: React.ReactNode[] = [];
    let currentSection: "strengths" | "weaknesses" | "suggestions" | "default" = "default";

    // Colors por tipo de sección
    const sectionColors = {
      strengths: { highlight: "bg-[#dae122]/30", bullet: "bg-[#dae122]", bulletText: "text-neutral-950" },
      weaknesses: { highlight: "bg-red-200/50", bullet: "bg-red-500", bulletText: "text-white" },
      suggestions: { highlight: "bg-green-200/50", bullet: "bg-green-600", bulletText: "text-white" },
      default:   { highlight: "bg-[#dae122]/30", bullet: "bg-[#dae122]", bulletText: "text-neutral-950" },
    };

    const flushList = () => {
      if (currentListItems.length > 0) {
        if (listType === "bullet") {
          renderList.push(
            <ul key={`list-${renderList.length}`} className="grid grid-cols-1 gap-3.5 my-5 pl-0">
              {currentListItems}
            </ul>
          );
        } else {
          renderList.push(
            <ol key={`list-${renderList.length}`} className="grid grid-cols-1 gap-3.5 my-5 pl-0">
              {currentListItems}
            </ol>
          );
        }
        currentListItems = [];
      }
      inList = false;
      listType = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      if (line.startsWith("###")) {
        flushList();
        
        let sectionLabel = "Criterio Técnico";
        let cardStyle = "border-neutral-900 bg-neutral-50 text-neutral-900";
        let borderStyle = "border-l-4 border-l-neutral-900";
        currentSection = "default";

        if (line.includes("🌟") || line.includes("Puntos Fuertes")) {
          sectionLabel = "Fortalezas Detectadas";
          cardStyle = "bg-[#dae122]/10 border-neutral-950 gap-2";
          borderStyle = "border-l-4 border-l-[#dae122]";
          currentSection = "strengths";
        } else if (line.includes("🔍") || line.includes("Diagnóstico")) {
          sectionLabel = "Inspección de Vacíos / Gaps";
          cardStyle = "bg-neutral-50 border-neutral-300";
          borderStyle = "border-l-4 border-l-neutral-400";
          currentSection = "default";
        } else if (line.includes("⚠️") || line.includes("Puntos Débiles")) {
          sectionLabel = "Riesgos Potenciales";
          cardStyle = "bg-red-50/40 border-red-900/20";
          borderStyle = "border-l-4 border-l-red-500";
          currentSection = "weaknesses";
        } else if (line.includes("💡") || line.includes("Sugerencias")) {
          sectionLabel = "Acciones de Optimización";
          cardStyle = "bg-green-50/40 border-green-900/20";
          borderStyle = "border-l-4 border-l-green-600";
          currentSection = "suggestions";
        }

        const cleanTitle = line.replace(/###\s*/, "").replace(/[🌟🔍⚠️💡]\s*/g, "");

        renderList.push(
          <div key={`header-${i}`} className={`mt-8 first:mt-2 p-5 border ${cardStyle} ${borderStyle} flex flex-col gap-1 rounded-sm`}>
            <span className="text-[10px] tracking-widest font-mono font-bold uppercase text-neutral-500">
              {sectionLabel}
            </span>
            <h3 className="text-sm md:text-base font-sans font-extrabold tracking-tight text-neutral-950">
              {cleanTitle}
            </h3>
          </div>
        );
      } else if (line.startsWith("- ")) {
        if (!inList || listType !== "bullet") {
          flushList();
          inList = true;
          listType = "bullet";
        }
        const rawContent = line.substring(2).trim();
        const colors = sectionColors[currentSection];
        
        currentListItems.push(
          <li key={`li-${i}`} className="flex items-start gap-3 bg-white p-4.5 border border-neutral-200 hover:border-neutral-900 transition-colors duration-150">
            <span className={`w-1.5 h-1.5 ${colors.bullet} border border-neutral-900 shrink-0 mt-2 rounded-none`}></span>
            <span className="text-xs md:text-sm leading-relaxed text-neutral-800 font-medium">{parseBoldText(rawContent, colors.highlight)}</span>
          </li>
        );
      } else if (/^\d+\.\s+/.test(line)) {
        if (!inList || listType !== "numbered") {
          flushList();
          inList = true;
          listType = "numbered";
        }
        const match = line.match(/^(\d+)\.\s+(.*)/);
        const num = match ? match[1] : i.toString();
        const rawContent = match ? match[2] : line;
        const colors = sectionColors[currentSection];
        
        currentListItems.push(
          <li key={`li-${i}`} className="flex items-start gap-4 bg-white p-4.5 border border-neutral-200 hover:border-neutral-900 transition-colors duration-150">
            <span className={`flex items-center justify-center font-mono text-[9px] font-bold ${colors.bullet} ${colors.bulletText} border border-neutral-900 w-5 h-5 shrink-0 select-none`}>
              {num}
            </span>
            <span className="text-xs md:text-sm leading-relaxed text-neutral-800 font-medium">{parseBoldText(rawContent, colors.highlight)}</span>
          </li>
        );
      } else {
        flushList();
        renderList.push(
          <p key={`p-${i}`} className="text-neutral-800 text-xs md:text-sm my-4 leading-relaxed pl-1 font-medium">
            {parseBoldText(line, sectionColors[currentSection].highlight)}
          </p>
        );
      }
    }
    flushList();

    return <div className="space-y-4 print:text-black">{renderList}</div>;
  };

  return (
    <div id="app-container" className="min-h-screen bg-[#ededeb] text-neutral-950 font-sans selection:bg-[#dae122] selection:text-neutral-950 antialiased flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-neutral-900 bg-white py-5 px-4 sm:px-6 md:px-8 sticky top-0 z-30 print:hidden shadow-xs">
        <div id="header-inner" className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#dae122] border border-neutral-900 rounded-none inline-block"></span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-500">PROYECTO INDEPENDIENTE // 2026</span>
            </div>
            <h1 className="text-xl md:text-2xl font-display font-black text-neutral-950 tracking-tight">
              ANALIZADOR DE CARPETAS CULTURALES
            </h1>
            <p className="text-xs text-neutral-500 font-mono">
              CREADO POR{" "}
              <a 
                id="author-link"
                href="https://www.juanmartinezgarcia.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold underline text-neutral-950 hover:bg-[#dae122] transition-colors"
              >
                JUAN MARTINEZ GARCIA
              </a>
            </p>
          </div>
          
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <span className="px-3.5 py-1.5 bg-[#dae122] border border-neutral-900 text-neutral-950 rounded-none text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5">
              VERSION 1.1
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!result && !loading && (
            <motion.div
              key="form-stage"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-8"
            >
            {/* Context Card */}
            <div id="welcome-card" className="bg-white text-neutral-950 rounded-none p-6 md:p-8 relative overflow-hidden border border-neutral-900 flex flex-col gap-3.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#dae122]/10 pointer-events-none select-none"></div>
              <div className="relative space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-950 text-[#dae122] border border-neutral-900 text-[9px] font-mono font-bold tracking-widest uppercase">
                  HERRAMIENTA GRATUITA
                </span>
                <h2 className="text-xl md:text-2xl font-display font-black text-neutral-950 tracking-tight uppercase">
                  Pre-evaluación para Artistas, Investigadores y Gestores Culturales
                </h2>
                <div className="space-y-3">
                  <p className="text-neutral-700 text-sm leading-relaxed max-w-3xl font-medium border-l-4 border-[#dae122] pl-4 py-1 bg-[#dae122]/5">
                    <span className="font-extrabold text-neutral-950">¿Qué es?</span> Herramienta de diagnóstico autónomo de carpetas para las convocatorias del <strong>FNA</strong>, <strong>INT</strong> y <strong>Ministerio de Cultura</strong>.
                  </p>
                  <p className="text-neutral-700 text-sm leading-relaxed max-w-3xl font-medium">
                    <span className="font-extrabold text-neutral-950">¿Cómo usarla?</span> Cargá tu PDF, seleccioná el organismo y recibí una devolución sobre la congruencia técnica, solidez presupuestal, delimitación territorial y desgloses operativos obligatorios <strong>antes</strong> de enviar tu postulación oficial.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Progress Indicator */}
            <div className="grid grid-cols-3 bg-white border border-neutral-900 text-[10px] text-neutral-950 max-w-xl mx-auto font-mono tracking-wider text-center divide-x divide-neutral-900">
              <span className={`px-3 py-3 font-bold transition-colors ${file ? 'bg-[#dae122] text-neutral-900' : 'bg-white text-neutral-900'}`}>
                01 // {file ? "✓ PDF CARGADO" : "SUBIR PDF"}
              </span>
              <span className={`px-3 py-3 font-bold transition-colors ${destination ? 'bg-[#dae122] text-neutral-900' : file ? 'bg-neutral-100 text-neutral-900' : 'bg-white text-neutral-400'}`}>
                02 // {destination ? `✓ ${destination}` : "CONVOCATORIA"}
              </span>
              <span className={`px-3 py-3 font-bold ${destination && file ? 'bg-neutral-950 text-[#dae122]' : 'bg-white text-neutral-400'}`}>
                03 // DIAGNÓSTICO
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PDF Uploader Section */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-neutral-500 font-mono flex items-center justify-between uppercase tracking-widest">
                  <span>[ 01 ] CARGAR CARPETA ÚNICA</span>
                  <span className="text-[10px] font-bold text-red-600 font-mono">* REQUERIDO</span>
                </label>
                
                <div 
                  id="pdf-dropzone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border border-dashed rounded-none p-6 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer min-h-[280px] ${
                    isDragging 
                      ? "border-neutral-900 bg-[#dae122]/5" 
                      : file 
                        ? "border-neutral-900 bg-[#dae122]/10" 
                        : "border-neutral-300 bg-white hover:border-neutral-900"
                  }`}
                  onClick={!file ? triggerFileSelect : undefined}
                >
                  <input 
                    id="pdf-file-input"
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                    accept="application/pdf"
                    className="hidden"
                  />

                  {file ? (
                    <div id="file-loaded-state" className="space-y-4 w-full">
                      <div className="mx-auto w-12 h-12 bg-neutral-900 text-[#dae122] rounded-none flex items-center justify-center border border-neutral-900">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5 px-4">
                        <p className="text-neutral-950 font-extrabold text-xs truncate max-w-xs mx-auto font-mono" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-neutral-400 font-mono font-bold">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • REGISTRADO
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (fileInputRef.current) fileInputRef.current.value = "";
                            triggerFileSelect();
                          }}
                          className="px-3 py-2 text-[10px] font-mono font-bold bg-white text-neutral-950 border border-neutral-900 hover:bg-neutral-50 flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> REEMPLAZAR
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="px-3 py-2 text-[10px] font-mono font-bold bg-red-100 text-red-900 hover:bg-red-200 border border-neutral-900 flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" /> REMOVER
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div id="empty-file-state" className="space-y-4">
                      <div className="mx-auto w-12 h-12 bg-neutral-50 text-neutral-900 rounded-none flex items-center justify-center border border-neutral-300">
                        <Upload className="w-5 h-5 text-neutral-500" />
                      </div>
                      <div className="space-y-2 px-1">
                        <p className="text-neutral-950 font-bold text-xs uppercase font-mono tracking-wider">
                          Arrastrá el pdf o explorá en tu biblioteca
                        </p>
                        <span className="inline-block px-4 py-2 bg-neutral-950 text-[#dae122] text-[10px] font-mono font-bold tracking-widest uppercase hover:bg-neutral-800 transition-colors">
                          SELECCIONAR ARCHIVO
                        </span>
                        <p className="text-[9px] text-neutral-400 font-mono font-bold uppercase tracking-widest pt-1">
                          SOPORTE DE ARCHIVO PDF HASTA 15MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Selector Section */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-neutral-500 font-mono flex items-center justify-between uppercase tracking-widest">
                  <span>[ 02 ] ORGANISMO DE EVALUACIÓN</span>
                  <span className="text-[10px] font-bold text-red-600 font-mono">* REQUERIDO</span>
                </label>
                
                <div id="destination-selector-group" className="space-y-2.5">
                  {DESTINATIONS.map((dest) => {
                    const isSelected = destination === dest.id;
                    return (
                      <div
                        key={dest.id}
                        onClick={() => setDestination(dest.id)}
                        className={`w-full p-4 rounded-none border transition-all duration-200 relative bg-white flex flex-col gap-2 cursor-pointer ${
                          isSelected 
                            ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900" 
                            : "border-neutral-200 hover:border-neutral-900"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-3.5 h-3.5 rounded-none border border-neutral-950 flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-neutral-950" : "bg-white"
                            }`}>
                              {isSelected && <span className="w-1.5 h-1.5 bg-[#dae122]"></span>}
                            </span>
                            <span className="font-extrabold text-xs md:text-sm text-neutral-950 font-display uppercase tracking-tight">
                              {dest.label}
                            </span>
                          </div>
                          
                          <span className={`text-[9px] px-2 py-0.5 rounded-none font-mono font-bold border ${
                            isSelected 
                              ? "bg-[#dae122] text-neutral-950 border-neutral-950" 
                              : "bg-neutral-100 text-neutral-500 border-neutral-200"
                          }`}>
                            {dest.org}
                          </span>
                        </div>
                        
                        <p className="text-xs text-neutral-600 pr-2 leading-relaxed font-semibold">
                          {dest.desc}
                        </p>

                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-neutral-100">
                          <span className="text-[9px] text-neutral-400 font-mono font-bold tracking-wider">
                            CRITERIO GENERAL: {dest.id}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePriorityDetail(dest);
                            }}
                            className="text-[9px] font-mono font-bold text-neutral-950 border border-neutral-950 hover:bg-neutral-50 transition-colors py-1 px-2.5 bg-white flex items-center gap-1"
                          >
                            <Eye className="w-2.5 h-2.5" /> REQUISITOS CLAVE
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Error Message display */}
            {errorString && (
              <div id="error-banner" className="p-4 bg-red-100 border border-red-500 rounded-none text-neutral-950 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <p className="leading-relaxed font-mono font-bold">{errorString}</p>
              </div>
            )}

            {/* Action Buttons Section */}
            <div className="pt-2 flex flex-col items-center gap-4">
              <button
                id="evaluate-btn"
                onClick={handleEvaluate}
                disabled={!pdfBase64 || !destination || loading}
                className={`group w-full md:w-auto px-10 py-3.5 rounded-none font-mono font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-3 border transition-all ${
                  (!pdfBase64 || !destination || loading)
                    ? "bg-neutral-100 cursor-not-allowed text-neutral-400 border-neutral-200"
                    : "bg-neutral-950 text-[#dae122] border-neutral-950 hover:bg-[#121212]/90"
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    EJECUTANDO DIAGNÓSTICO...
                  </>
                ) : (
                  <>
                    INICIAR EVALUACIÓN DE CARPETA
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {/* Smaller informative button to show criteria */}
              <button
                id="criteria-info-btn"
                type="button"
                onClick={() => setShowCriteriaModal(true)}
                className="text-[10px] font-mono font-bold text-neutral-500 hover:text-neutral-950 transition-all flex items-center gap-1.5 py-1 px-3 border-b border-dashed border-neutral-300 hover:border-neutral-950 mt-1"
              >
                <HelpCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" /> ¿CÓMO LA IA EVALÚA?
              </button>
            </div>
          </motion.div>
        )}

        {/* Loading Stage View with Encouraging argentine cultural tags */}
        {loading && (
          <motion.div
            key="loading-stage"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2 }}
            id="loading-stage"
            className="py-12 px-6 text-center space-y-6 max-w-lg mx-auto bg-white border border-neutral-900 rounded-none shadow-xs my-8"
          >
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center bg-neutral-50 border border-neutral-900">
              <div className="absolute inset-2 border-2 border-neutral-200 border-t-neutral-950 animate-spin"></div>
              <span className="text-xl select-none z-10">🧉</span>
            </div>
            
            <div className="space-y-3 px-2">
              <div className="inline-block px-2 py-0.5 bg-[#dae122] text-neutral-950 font-mono text-[9px] font-bold tracking-widest uppercase border border-neutral-950">
                PROCESANDO DOCUMENTO PDF
              </div>
              <h3 className="font-display font-black text-neutral-950 text-md uppercase tracking-tight">
                Inicializando Diagnóstico Técnico
              </h3>
              {/* Dynamic pedagogy lines shown during request */}
              <div className="min-h-[56px] px-4 flex items-center justify-center bg-neutral-50 rounded-none border border-neutral-200 p-3.5">
                <p className="text-xs italic transition-all duration-300 leading-relaxed font-bold text-neutral-800">
                  "{LOADING_PHRASES[loadingPhraseIndex]}"
                </p>
              </div>
            </div>
            
            <div className="pt-2 text-[10px] text-neutral-400 font-mono font-bold uppercase tracking-widest">
              SISTEMA DE ANÁLISIS GEMINI • CONV. FEDERALES
            </div>
          </motion.div>
        )}

        {/* Diagnostic Devolución Viewer */}
        {result && !loading && (
          <motion.div
            key="evaluation-stage"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            id="evaluation-result"
            className="space-y-6 print:p-0"
          >
            {/* Header of Devolución */}
            <div className="bg-white text-neutral-950 rounded-none p-6 md:p-8 relative overflow-hidden border border-neutral-900 print:border-none">
              <div className="absolute top-0 right-0 p-8 opacity-5 select-none print:hidden pointer-events-none">
                <Building className="w-32 h-32 text-neutral-950" />
              </div>
              <div className="relative space-y-4">
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-2.5 py-1 bg-neutral-950 text-white rounded-none">
                    REPORTE DIAGNÓSTICO GENERAL
                  </span>
                  <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-2.5 py-1 bg-[#dae122] text-neutral-950 border border-neutral-950 rounded-none">
                    DESTINO: {destination}
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  <h2 className="text-xl md:text-2xl font-display font-black text-neutral-950 uppercase tracking-tight print:text-black">
                    Auditoría Consultiva y Consejos de Viabilidad
                  </h2>
                  {file && (
                    <p className="text-neutral-500 text-xs font-mono flex items-center gap-1.5 print:text-slate-700">
                      <FileCheck className="w-4 h-4 shrink-0 text-neutral-900" />
                      DOCUMENTO: <span className="font-bold underline text-neutral-950 print:text-black">{file.name}</span>
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-neutral-200 flex flex-wrap justify-between items-center gap-3 print:hidden">
                  <div className="flex flex-wrap gap-2">
                    <button
                      id="copy-btn"
                      onClick={handleCopyToClipboard}
                      className="px-4 py-2 bg-white text-neutral-950 border border-neutral-900 text-[10px] font-mono font-bold hover:bg-neutral-50 flex items-center gap-1.5"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-600" /> ¡COPIADO!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> COPIAR INFORME
                        </>
                      )}
                    </button>
                    <button
                      id="print-btn"
                      onClick={handlePrint}
                      className="px-4 py-2 bg-[#dae122] text-neutral-950 border border-neutral-900 text-[10px] font-mono font-bold hover:bg-[#dae122]/85 flex items-center gap-1.5"
                    >
                      <Printer className="w-3" /> IMPRIMIR REPORTE
                    </button>
                    <button
                      id="download-btn"
                      onClick={handleDownloadPDF}
                      className="px-4 py-2 bg-white text-neutral-950 border border-neutral-900 text-[10px] font-mono font-bold hover:bg-neutral-50 flex items-center gap-1.5"
                    >
                      <FileText className="w-3 h-3" /> DESCARGAR TXT
                    </button>
                    <button
                      id="share-btn"
                      onClick={handleShare}
                      className="px-4 py-2 bg-neutral-950 text-[#dae122] border border-neutral-900 text-[10px] font-mono font-bold hover:bg-neutral-800 flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" /> COMPARTIR
                    </button>
                  </div>

                  <button
                    id="reset-btn"
                    onClick={handleReset}
                    className="group px-4 py-2 bg-neutral-950 text-[#dae122] text-[10px] font-mono font-bold tracking-wider hover:bg-neutral-800 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3 group-hover:animate-spin" /> AUDITAR OTRO
                  </button>
                </div>
              </div>
            </div>

            {/* Diagnostic evaluation result blocks processed from Markdown */}
            <div className="bg-white rounded-none border border-neutral-900 p-6 md:p-8 relative print:border-none print:p-0">
              <div id="formatted-devolucion-body" className="prose prose-neutral max-w-none">
                {renderFormattedResult(result)}
              </div>
            </div>

            {/* Bottom Warning/Pedagogy Disclaimer Card */}
            <div className="p-5 bg-neutral-50 border border-neutral-900 rounded-none text-neutral-950 text-xs space-y-2 print:hidden leading-relaxed font-mono">
              <p className="font-extrabold flex items-center gap-2 uppercase tracking-wider text-[#121212]">
                ⚠️ NOTA REGLAMENTARIA DE PROPIEDAD INTELECTUAL:
              </p>
              <p className="text-neutral-500 leading-relaxed font-semibold">
                Esta devolución es un diagnóstico automatizado elaborado por Inteligencia Artificial y no almacena tus datos de forma permanente ni reescribe tu obra para respetar tu derecho de propiedad intelectual original. No garantiza el otorgamiento del subsidio, sino que sirve como una guía clara para que tu postulación tenga la mayor solidez técnica posible según las directrices históricas de los reglamentos.
              </p>
            </div>
            
            {/* Visual Back Button */}
            <div className="flex justify-center pt-2 print:hidden">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-white text-neutral-950 border border-neutral-900 text-xs font-mono font-bold hover:bg-neutral-50"
              >
                VOLVER AL PANEL PRINCIPAL
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Floating Priority Modal */}
      <AnimatePresence>
        {activePriorityDetail && (
          <motion.div
            id="priority-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-xs"
          >
            <motion.div
              id="priority-modal"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-lg rounded-none border border-neutral-900 flex flex-col shadow-lg"
            >
              <div className="bg-neutral-950 border-b border-neutral-900 p-4 text-[#dae122] flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-[#dae122] shrink-0"></span>
                  <h3 className="font-mono font-bold text-xs uppercase tracking-widest text-[#dae122]">
                    {activePriorityDetail.label} • EXIGENCIAS
                  </h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActivePriorityDetail(null)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6 space-y-5 flex-1 select-text">
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-mono font-bold text-neutral-500 tracking-widest">
                    Foco de Evaluación Prioritario
                  </h4>
                  <p className="text-neutral-950 text-xs md:text-sm leading-relaxed font-bold bg-[#dae122]/15 p-4 border border-neutral-200">
                    "{activePriorityDetail.focus}"
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-mono font-bold text-neutral-500 tracking-widest">
                    Directivas Técnicas de Viabilidad
                  </h4>
                  <p className="text-neutral-700 text-xs leading-relaxed font-semibold bg-neutral-50 p-4 border border-neutral-200">
                    {activePriorityDetail.detailedAuditGuide}
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-neutral-200">
                  <h4 className="text-[10px] uppercase font-mono font-bold text-neutral-500 tracking-widest">
                    Base Reglamentaria Recopilada
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-neutral-900 text-xs font-mono font-semibold">
                      {activePriorityDetail.sources}
                    </p>
                    <a 
                      href={activePriorityDetail.sourcesUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] font-mono font-bold text-neutral-950 hover:underline flex items-center gap-1.5 mt-1 bg-neutral-50 border border-neutral-200 p-2 w-fit"
                    >
                      <Globe className="w-3 h-3 shrink-0" /> SITIO OFICIAL DEL {activePriorityDetail.org} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-50 p-4 border-t border-neutral-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActivePriorityDetail(null)}
                  className="px-4 py-2 bg-neutral-950 text-white hover:bg-neutral-800 text-[10px] font-mono tracking-wider font-bold"
                >
                  ENTENDIDO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Criteria / Transparent AI Modal */}
      <AnimatePresence>
        {showCriteriaModal && (
          <motion.div
            id="criteria-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-xs"
          >
            <motion.div
              id="criteria-modal"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-xl rounded-none border border-neutral-900 flex flex-col shadow-lg"
            >
              <div className="bg-neutral-950 border-b border-neutral-900 p-4 text-[#dae122] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#dae122] shrink-0"></span>
                  <h3 className="font-mono font-bold text-xs uppercase tracking-widest text-[#dae122]">
                    CRITERIOS DE AUDITORÍA / HONESTIDAD TRANSPARENTE
                  </h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowCriteriaModal(false)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto select-text">
                <p className="text-neutral-700 text-xs leading-relaxed font-bold">
                  Nuestra premisa fundamental es la <strong className="text-neutral-900 underline decoration-[#dae122] decoration-2">honestidad intelectual</strong>. El analizador utiliza modelos de lenguaje preparados bajo directrices pedagógicas para examinar carpetas de proyectos culturales de Argentina de acuerdo a cuatro pilares claves:
                </p>

                <div className="grid grid-cols-1 gap-3 pt-1">
                  <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-1">
                    <h4 className="text-xs font-mono font-bold text-neutral-950 flex items-center gap-1.5 uppercase">
                      <span className="px-1 py-0.5 text-[8px] bg-neutral-950 text-white font-mono">01</span> Coherencia Organizativa
                    </h4>
                    <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                      Se evalúa que el título, los objetivos generales y específicos tengan un hilo conductor real con las actividades propuestas de forma racional.
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-1">
                    <h4 className="text-xs font-mono font-bold text-neutral-950 flex items-center gap-1.5 uppercase">
                      <span className="px-1 py-0.5 text-[8px] bg-neutral-950 text-white font-mono">02</span> Viabilidad de Destino
                    </h4>
                    <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                      Se ponderan las directrices de fomento de las instituciones: la viabilidad escénica del INT, la fundamentación estética del FNA, o el impacto federal del Ministerio.
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-1">
                    <h4 className="text-xs font-mono font-bold text-neutral-950 flex items-center gap-1.5 uppercase">
                      <span className="px-1 py-0.5 text-[8px] bg-neutral-950 text-white font-mono">03</span> Detección de Datos Faltantes
                    </h4>
                    <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                      Revisa la ausencia de apartados vitales requeridos en los reglamentos nacionales, tales como presupuesto desglosado o delimitación de público final.
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-1">
                    <h4 className="text-xs font-mono font-bold text-neutral-950 flex items-center gap-1.5 uppercase">
                      <span className="px-1 py-0.5 text-[8px] bg-neutral-950 text-white font-mono">04</span> Regla Crucial de No Modificación
                    </h4>
                    <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                      La IA no tiene permitido alterar, reescribir ni adueñarse de tus textos originales. Tu impronta y voz permanece respetada en su totalidad.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#dae122]/10 rounded-none text-neutral-700 text-[10px] font-mono italic text-center border border-neutral-300">
                  La temperatura del modelo Gemini está fijada en 0.2 para evitar asunciones creativas y garantizar consistencia normativa precisa.
                </div>
              </div>

              <div className="bg-neutral-50 p-4 border-t border-neutral-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCriteriaModal(false)}
                  className="px-4 py-2 bg-neutral-950 text-white hover:bg-neutral-800 text-[10px] font-mono tracking-wider font-bold"
                >
                  CERRAR METODOLOGÍA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-lg rounded-none border border-neutral-900 flex flex-col shadow-lg"
            >
              <div className="bg-neutral-950 border-b border-neutral-900 p-4 text-[#dae122] flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-[#dae122] shrink-0"></span>
                  <h3 className="font-mono font-bold text-xs uppercase tracking-widest text-[#dae122]">
                    ENVIAR COMENTARIOS Y SUGERENCIAS
                  </h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {feedbackSent ? (
                <div className="p-8 text-center space-y-4">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <p className="text-neutral-950 font-bold text-sm font-mono">¡MENSAJE ENVIADO!</p>
                  <p className="text-neutral-500 text-xs font-mono">Gracias por tu feedback. Lo voy a leer apenas pueda.</p>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 bg-neutral-950 text-white hover:bg-neutral-800 text-[10px] font-mono tracking-wider font-bold"
                  >
                    CERRAR
                  </button>
                </div>
              ) : (
                <form
                  className="p-6 space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const captchaOk = parseInt(captcha.answer) === captcha.a + captcha.b;
                    if (!captchaOk) {
                      setFeedbackError("La respuesta del captcha es incorrecta. Probá de nuevo.");
                      setCaptcha(generateCaptcha());
                      return;
                    }
                    setFeedbackSending(true);
                    setFeedbackError("");
                    try {
                      const r = await fetch("/api/feedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: feedbackName, email: feedbackEmail, message: feedbackMsg }),
                      });
                      if (!r.ok) throw new Error("Error del servidor");
                      setFeedbackSent(true);
                    } catch {
                      setFeedbackError("No se pudo enviar el mensaje. Intentalo de nuevo más tarde.");
                    } finally {
                      setFeedbackSending(false);
                    }
                  }}
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Nombre</label>
                    <input
                      type="text"
                      required
                      value={feedbackName}
                      onChange={(e) => setFeedbackName(e.target.value)}
                      className="w-full border border-neutral-300 p-2.5 text-xs font-mono focus:outline-none focus:border-neutral-900 bg-white"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Email (opcional)</label>
                    <input
                      type="email"
                      value={feedbackEmail}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                      className="w-full border border-neutral-300 p-2.5 text-xs font-mono focus:outline-none focus:border-neutral-900 bg-white"
                      placeholder="tu@email.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Mensaje *</label>
                    <textarea
                      required
                      rows={4}
                      value={feedbackMsg}
                      onChange={(e) => setFeedbackMsg(e.target.value)}
                      className="w-full border border-neutral-300 p-2.5 text-xs font-mono focus:outline-none focus:border-neutral-900 bg-white resize-none"
                      placeholder="Contame qué mejorarías, qué te gustó, o qué bug encontraste..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">¿Cuánto es {captcha.a} + {captcha.b}? *</label>
                    <input
                      type="number"
                      required
                      value={captcha.answer}
                      onChange={(e) => setCaptcha({ ...captcha, answer: e.target.value })}
                      className="w-full border border-neutral-300 p-2.5 text-xs font-mono focus:outline-none focus:border-neutral-900 bg-white"
                      placeholder="Escribí el resultado"
                    />
                  </div>

                  {feedbackError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-800 text-[10px] font-mono font-bold">
                      {feedbackError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(false)}
                      className="px-4 py-2 bg-white text-neutral-950 border border-neutral-900 text-[10px] font-mono font-bold hover:bg-neutral-50"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      disabled={feedbackSending}
                      className="px-4 py-2 bg-neutral-950 text-white hover:bg-neutral-800 text-[10px] font-mono tracking-wider font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {feedbackSending ? (
                        <><RefreshCw className="w-3 h-3 animate-spin" /> ENVIANDO...</>
                      ) : (
                        <><Send className="w-3 h-3" /> ENVIAR MENSAJE</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Area */}
      <footer className="border-t border-neutral-900 bg-white py-6 px-4 md:px-8 text-center text-neutral-700 text-xs print:hidden space-y-3">
        {/* Quota Meter */}
        {quota && (
          <div className="max-w-4xl mx-auto flex items-center gap-3 pb-3 border-b border-neutral-100">
            <div className="flex-1">
              <div className="flex justify-between text-[9px] font-mono font-bold text-neutral-500 mb-1 tracking-wider">
                <span>LÍMITE DIARIO DE LA API</span>
                <span>{quota.usedToday} / {quota.limitPerDay} usados</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 rounded-none overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    quota.remaining < 100 ? "bg-red-500" : quota.remaining < 500 ? "bg-[#dae122]" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(100, (quota.usedToday / quota.limitPerDay) * 100)}%` }}
                />
              </div>
              <p className="text-[8px] text-neutral-400 font-mono mt-0.5 text-left">
                {quota.remaining > 0
                  ? `Quedan ${quota.remaining} análisis disponibles hoy. Se resetea a ${quota.resetsAt}.`
                  : "⚠️ Límite diario alcanzado. Volvé mañana o contactame para alternativas."}
              </p>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <p className="font-mono font-bold text-neutral-900 text-left uppercase tracking-tighter text-[11px] leading-relaxed">
            © 2026 ANALIZADOR DE CARPETAS CULTURALES • 
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openFeedback}
              className="text-neutral-950 font-mono font-bold hover:bg-[#dae122] border border-neutral-950 px-3 py-1.5 transition-colors text-[10px] flex items-center gap-1.5"
            >
              <MessageCircle className="w-3 h-3" /> ENVIAR COMENTARIOS
            </button>
            <a 
              href="https://www.juanmartinezgarcia.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-950 font-mono font-bold hover:bg-[#dae122] border border-neutral-950 px-3 py-1.5 transition-colors text-[10px]"
            >
              WWW.JUANMARTINEZGARCIA.COM
            </a>
          </div>
        </div>

        <div className="max-w-3xl mx-auto text-[10px] text-neutral-500 font-mono font-semibold leading-relaxed border-t border-neutral-200 pt-3">
          ESTE DIAGNÓSTICO ESTÁ CONSTRUIDO BAJO RECOPILACIÓN REGLAMENTARIA AUTÓNOMA Y NO TIENE VINCULACIÓN OFICIAL NI RESPALDO DIRECTO DE LAS MENCIONADAS ENTIDADES PÚBLICAS.
        </div>
      </footer>
    </div>
  );
}
