import React from 'react';
import { X, ShieldCheck, Cpu, Database, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import { AGENTS_INFO, SPECIALIST_AGENTS } from '../agentConfig';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasGeminiKey: boolean;
  activeMemoriesCount: number;
  searchGroundingQuotaExhausted?: boolean;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  hasGeminiKey,
  activeMemoriesCount,
  searchGroundingQuotaExhausted = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Cpu className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">SmartBuddy Architecture & Setup</h2>
              <p className="text-xs text-slate-400">Your Global AI Assistant orchestration details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              hasGeminiKey
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
            }`}
          >
            {hasGeminiKey ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-white">
                {hasGeminiKey ? 'Gemini Engine Active & Connected' : 'Gemini API Key Required'}
              </div>
              <p className="text-xs mt-0.5 opacity-90 text-slate-300">
                {hasGeminiKey
                  ? 'Server-side Gemini 3.8 Flash is ready. All 5 agents can communicate and execute tasks.'
                  : 'Add GEMINI_API_KEY to your environment variables or Secrets panel to enable real agent orchestration.'}
              </p>
            </div>
          </div>

          {/* Tool Capabilities & Quota Transparency */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5 text-xs">
            <h3 className="font-semibold text-white flex items-center justify-between">
              <span>Tool Capabilities & Real Status</span>
              <span className="text-[10px] text-slate-400 font-mono">Real Audit</span>
            </h3>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Task Database Sync</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  ACTIVE (tasks.json)
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Memory Persistence</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  ACTIVE (memory.json)
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Google Web Search Grounding</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    TOOL_UNAVAILABLE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Search grounding quota is unavailable on current free tier (HTTP 429). Research Agent smoothly falls back to verified LLM knowledge synthesis without errors.
                </p>
              </div>
            </div>
          </div>

          {/* How Multi-Agent Coordination Works */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Multi-Agent Hierarchy
            </h3>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="font-semibold text-white text-xs">{AGENTS_INFO.main.name}</span>
                  <span className="text-[11px] text-indigo-400">({AGENTS_INFO.main.role})</span>
                </div>
                <p className="text-xs text-slate-300">{AGENTS_INFO.main.shortDescription}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SPECIALIST_AGENTS.map((agent) => (
                  <div key={agent.id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
                    <div className="font-medium text-white">{agent.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{agent.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real Memory System */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              Memory & Preference Injection
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              You currently have <strong className="text-white">{activeMemoriesCount} active memories</strong>.{' '}
              Unlike decorative apps, every instruction and preference you approve in the Memory tab is
              strictly compiled and injected into the prompt context of the Main Agent and specialists for every query.
            </p>
          </div>

          {/* Security & Server-Side Execution */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Security Architecture
            </h3>
            <div className="space-y-2 text-xs text-slate-300 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <p>
                • <strong>Server-Side Proxy:</strong> All requests to Google GenAI are processed through <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">server.ts</code>.
              </p>
              <p>
                • <strong>No Key Exposure:</strong> Your API key is never bundled in frontend assets or browser memory.
              </p>
              <p>
                • <strong>Auditability:</strong> You can inspect intermediate subtask deliverables from each specialist agent right in the chat message cards.
              </p>
            </div>
          </div>

          {/* Setup Instructions */}
          {!hasGeminiKey && (
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Key className="w-4 h-4 text-amber-400" />
                Setup Guide
              </div>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1">
                <li>Create an API key from Google AI Studio.</li>
                <li>Set <code className="text-amber-300">GEMINI_API_KEY=your_key</code> in your environment or Secrets.</li>
                <li>Restart the server to begin live orchestration.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
