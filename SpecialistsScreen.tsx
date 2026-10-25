import React, { useState } from 'react';
import {
  Users,
  Search,
  PenTool,
  Code2,
  CheckSquare,
  Sparkles,
  Send,
  X,
  Bot,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AgentId } from '../types';
import { AGENTS_INFO, SPECIALIST_AGENTS } from '../agentConfig';
import { runDirectAgent } from '../services/api';
import { MarkdownView } from './MarkdownView';

interface SpecialistsScreenProps {
  onDirectTaskCreated?: (agentId: AgentId, title: string, output: string) => void;
  activeMemoriesCount: number;
}

export const SpecialistsScreen: React.FC<SpecialistsScreenProps> = ({
  activeMemoriesCount,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [prompt, setPrompt] = useState('');
  const [executing, setExecuting] = useState(false);
  const [directOutput, setDirectOutput] = useState<{
    agentId: AgentId;
    output: string;
    appliedMemories: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAgentIcon = (id: AgentId) => {
    switch (id) {
      case 'main':
        return Bot;
      case 'research':
        return Search;
      case 'writing':
        return PenTool;
      case 'technical':
        return Code2;
      case 'task_manager':
        return CheckSquare;
    }
  };

  const handleOpenDirect = (id: AgentId) => {
    setSelectedAgentId(id);
    setPrompt('');
    setDirectOutput(null);
    setError(null);
  };

  const handleRunDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !prompt.trim() || executing) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await runDirectAgent(selectedAgentId, prompt.trim());
      setDirectOutput(res);
    } catch (err: any) {
      setError(err.message || 'Execution failed.');
    } finally {
      setExecuting(false);
    }
  };

  const selectedAgent = selectedAgentId ? AGENTS_INFO[selectedAgentId] : null;

  return (
    <div className="pb-24 pt-3 px-4 max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">SmartBuddy Specialist Squad</h1>
            <p className="text-xs text-slate-400">4 Specialists + 1 Global Orchestrator</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2.5">
          <strong className="text-teal-300 font-semibold">SmartBuddy</strong> automatically decomposes your requests across these 4 specialists. You can also interact with any specialist agent directly to test their individual expertise.
        </p>
      </div>

      {/* Main Orchestrator Card */}
      <div className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-teal-950/30 border border-teal-500/40 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 shadow-sm shadow-teal-500/10">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{AGENTS_INFO.main.name}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-teal-500/30 bg-teal-500/20 text-teal-300">
                  Global Orchestrator
                </span>
              </div>
              <p className="text-xs text-teal-400/90 font-medium mt-0.5">{AGENTS_INFO.main.role}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
          {AGENTS_INFO.main.shortDescription}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800/80">
          {AGENTS_INFO.main.specialties.map((spec, i) => (
            <span key={i} className="text-[10px] bg-slate-800/90 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-md font-medium">
              {spec}
            </span>
          ))}
        </div>
      </div>

      {/* 4 Specialist Agents */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          The 4 Specialist Agents
        </h2>

        {SPECIALIST_AGENTS.map((agent) => {
          const Icon = getAgentIcon(agent.id);

          return (
            <div
              key={agent.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${agent.accentBg} ${agent.accentBorder}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    </div>
                    <span className="text-xs text-slate-400">{agent.role}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenDirect(agent.id)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium shrink-0 border border-slate-700/60"
                >
                  <span>Test Agent</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                </button>
              </div>

              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {agent.shortDescription}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800/60">
                {agent.specialties.map((spec, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-slate-800/60 text-slate-300 px-2 py-0.5 rounded-md font-medium"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct Test Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${selectedAgent.badgeColor}`}>
                  {selectedAgent.name}
                </span>
                <span className="text-xs text-slate-400 font-medium">Direct Specialist Dispatch</span>
              </div>
              <button
                onClick={() => setSelectedAgentId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3 text-xs flex-1">
              <p className="text-slate-300">
                Send a direct instruction to the <strong>{selectedAgent.name}</strong>. It will process using its specialized persona while honoring your{' '}
                <span className="text-indigo-300 font-semibold">{activeMemoriesCount} active memories</span>.
              </p>

              <form onSubmit={handleRunDirect} className="space-y-2">
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Ask ${selectedAgent.name} something specific to ${selectedAgent.role.toLowerCase()}...`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={executing || !prompt.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {executing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Running Specialist...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to {selectedAgent.name.replace(' Agent', '')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {directOutput && (
                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-white">Specialist Output:</span>
                    <span>✓ {directOutput.appliedMemories.length} memories enforced</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                    <MarkdownView content={directOutput.output} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
