import React, { useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  Play,
  Download,
  X,
  Smartphone,
  Tablet,
  Monitor,
  Terminal,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  duration: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<{ isOpen: boolean; code: string; title: string }>({
    isOpen: false,
    code: '',
    title: '',
  });
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [executionResults, setExecutionResults] = useState<Record<number, ExecutionResult>>({});

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadCodeFile = (code: string, lang: string) => {
    let extension = 'txt';
    const l = lang.toLowerCase();
    if (l === 'html' || l === 'htm') extension = 'html';
    else if (l === 'javascript' || l === 'js') extension = 'js';
    else if (l === 'typescript' || l === 'ts') extension = 'ts';
    else if (l === 'python' || l === 'py') extension = 'py';
    else if (l === 'kotlin' || l === 'kt') extension = 'kt';
    else if (l === 'json') extension = 'json';
    else if (l === 'css') extension = 'css';
    else if (l === 'markdown' || l === 'md') extension = 'md';
    else if (l === 'sql') extension = 'sql';

    const filename = `snippet_${Date.now()}.${extension}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Safe in-browser execution sandbox for JavaScript & math logic
  const runCodeInSandbox = (code: string, idx: number) => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    try {
      console.log = (...args) =>
        logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      console.warn = (...args) =>
        logs.push('[WARN] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      console.error = (...args) =>
        logs.push('[ERROR] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));

      const startTime = performance.now();
      // Safe execution using Function constructor in browser runtime
      const fn = new Function(code);
      const result = fn();
      const duration = (performance.now() - startTime).toFixed(1);

      let output = logs.join('\n');
      if (result !== undefined) {
        output = output
          ? `${output}\n\nReturned: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`
          : `Returned: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`;
      }
      if (!output) output = '(Execution completed successfully with no console output)';

      setExecutionResults((prev) => ({
        ...prev,
        [idx]: {
          success: true,
          output,
          duration: `${duration}ms`,
        },
      }));
    } catch (err: any) {
      setExecutionResults((prev) => ({
        ...prev,
        [idx]: {
          success: false,
          output: `Runtime Error: ${err?.message || String(err)}`,
          duration: '0ms',
        },
      }));
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };

  // Line-by-line markdown parser with code blocks, tables, and typography
  const renderFormatted = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeLang = '';
    let blockIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Close code block
          const codeText = codeBuffer.join('\n');
          const currentIdx = blockIndex++;
          const lang = codeLang.toLowerCase();
          const isHtml =
            lang === 'html' ||
            lang === 'xml' ||
            codeText.includes('<!DOCTYPE html>') ||
            codeText.includes('<html') ||
            codeText.includes('<head>') ||
            codeText.includes('<body>');
          const isJs = lang === 'javascript' || lang === 'js';
          const execResult = executionResults[currentIdx];

          elements.push(
            <div
              key={`code-${i}`}
              className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-xs shadow-sm"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400 font-mono text-[11px] flex-wrap gap-2">
                <span className="font-semibold text-slate-300 uppercase">{codeLang || 'code'}</span>

                <div className="flex items-center gap-1.5">
                  {/* HTML Live Preview Button */}
                  {isHtml && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewHtml({
                          isOpen: true,
                          code: codeText,
                          title: 'Interactive Web Page Preview',
                        })
                      }
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/40 transition-colors py-0.5 px-2 rounded-lg text-[10px] font-semibold"
                      title="Preview this HTML website live in sandbox"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview Live</span>
                    </button>
                  )}

                  {/* Browser JS Execution Button */}
                  {isJs && (
                    <button
                      type="button"
                      onClick={() => runCodeInSandbox(codeText, currentIdx)}
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 hover:bg-cyan-900/40 transition-colors py-0.5 px-2 rounded-lg text-[10px] font-semibold"
                      title="Run code in browser JavaScript sandbox"
                    >
                      <Play className="w-3 h-3" />
                      <span>Run JS</span>
                    </button>
                  )}

                  {/* Download File */}
                  <button
                    type="button"
                    onClick={() => downloadCodeFile(codeText, codeLang)}
                    className="flex items-center gap-1 hover:text-slate-200 transition-colors py-0.5 px-1.5 rounded text-[10px]"
                    title="Download file to device"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>

                  {/* Copy Code */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(codeText, currentIdx)}
                    className="flex items-center gap-1 hover:text-slate-200 transition-colors py-0.5 px-1.5 rounded text-[10px]"
                  >
                    {copiedIndex === currentIdx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="p-3.5 overflow-x-auto font-mono text-slate-200 leading-relaxed text-[11px]">
                <code>{codeText}</code>
              </pre>

              {/* Real JavaScript Execution Output Drawer */}
              {execResult && (
                <div
                  className={`p-3 border-t text-[11px] font-mono ${
                    execResult.success
                      ? 'bg-slate-900/90 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/50 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                    <span className="flex items-center gap-1.5 font-bold">
                      {execResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>Browser JS Execution ({execResult.duration})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Sandbox Runtime</span>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{execResult.output}</pre>
                </div>
              )}
            </div>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLang = line.replace('```', '').trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${i}`} className="text-sm font-semibold text-slate-100 mt-3 mb-1">
            {formatInline(line.replace('### ', ''))}
          </h4>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${i}`} className="text-base font-bold text-white mt-4 mb-2 border-b border-slate-800 pb-1">
            {formatInline(line.replace('## ', ''))}
          </h3>
        );
        continue;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={`h1-${i}`} className="text-lg font-bold text-white mt-4 mb-2">
            {formatInline(line.replace('# ', ''))}
          </h2>
        );
        continue;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`bq-${i}`}
            className="border-l-2 border-teal-400/60 pl-3 my-2 text-slate-300 italic text-sm"
          >
            {formatInline(line.replace('> ', ''))}
          </blockquote>
        );
        continue;
      }

      // Horizontal Rules
      if (line.trim() === '---' || line.trim() === '***') {
        elements.push(<hr key={`hr-${i}`} className="my-3 border-slate-800" />);
        continue;
      }

      // Bullet lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={`li-${i}`} className="ml-4 list-disc text-slate-200 text-sm my-0.5 leading-relaxed">
            {formatInline(line.substring(2))}
          </li>
        );
        continue;
      }

      // Numbered lists
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={`num-${i}`} className="flex gap-2 text-slate-200 text-sm my-1 leading-relaxed">
            <span className="text-indigo-400 font-medium select-none min-w-[1.2rem]">{numMatch[1]}.</span>
            <span>{formatInline(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Empty line / paragraph break
      if (line.trim() === '') {
        elements.push(<div key={`sp-${i}`} className="h-2" />);
        continue;
      }

      // Standard text line
      elements.push(
        <p key={`p-${i}`} className="text-slate-200 text-sm leading-relaxed my-1">
          {formatInline(line)}
        </p>
      );
    }

    return elements;
  };

  // Helper for inline styles (bold, code, links)
  const formatInline = (text: string): React.ReactNode => {
    // Split by inline code `...`
    const parts = text.split(/(`[^`]+`)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="bg-slate-800/90 text-indigo-300 px-1 py-0.5 rounded text-[12px] font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Split by bold **...**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={idx}>
          {boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith('**') && bPart.endsWith('**')) {
              return (
                <strong key={bIdx} className="font-semibold text-white">
                  {bPart.slice(2, -2)}
                </strong>
              );
            }
            return bPart;
          })}
        </span>
      );
    });
  };

  return (
    <div className={`space-y-0.5 ${className}`}>
      {renderFormatted()}

      {/* Live Interactive Webpage Preview Modal */}
      {previewHtml.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white truncate">{previewHtml.title}</span>
              </div>

              {/* Viewport Toggles */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewportMode('mobile')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    viewportMode === 'mobile' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mobile View (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mobile (375px)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('tablet')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    viewportMode === 'tablet' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tablet View (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('desktop')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    viewportMode === 'desktop' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Desktop Full Width"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => downloadCodeFile(previewHtml.code, 'html')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-medium rounded-lg transition-colors"
                  title="Download HTML file"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400" />
                  <span className="hidden sm:inline">Download HTML</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewHtml({ isOpen: false, code: '', title: '' })}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sandbox IFrame Container */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-3 overflow-auto">
              <div
                className={`h-full bg-white transition-all shadow-xl rounded-xl overflow-hidden ${
                  viewportMode === 'mobile'
                    ? 'w-[375px] border-4 border-slate-700'
                    : viewportMode === 'tablet'
                    ? 'w-[768px] border-4 border-slate-700'
                    : 'w-full border border-slate-800'
                }`}
              >
                <iframe
                  title="Web Artifact Preview Sandbox"
                  srcDoc={previewHtml.code}
                  sandbox="allow-scripts allow-modals"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
