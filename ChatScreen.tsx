import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BookmarkPlus,
  RefreshCw,
  AlertCircle,
  BrainCircuit,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCw,
  History,
  X,
  CheckCircle2,
  MinusCircle,
  Mic,
  MicOff,
  Download,
} from 'lucide-react';
import { AgentContribution, AgentId, ChatMessage, ExecutionStatus, MemoryItem } from '../types';
import { AGENTS_INFO } from '../agentConfig';
import { MarkdownView } from './MarkdownView';
import { SaveMemoryModal } from './SaveMemoryModal';

interface ChatScreenProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => Promise<void>;
  isLoading: boolean;
  activeMemoriesCount: number;
  onSaveToMemory: (title: string, content: string, category?: MemoryItem['category']) => Promise<void>;
  onNavigateToTasks: () => void;
  onNavigateToMemory?: () => void;
  onRetrySpecialist?: (
    messageId: string,
    taskId: string,
    userPrompt: string,
    contributions: AgentContribution[]
  ) => Promise<void>;
  onClearHistory?: () => Promise<void>;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeMemoriesCount,
  onSaveToMemory,
  onNavigateToTasks,
  onNavigateToMemory,
  onRetrySpecialist,
  onClearHistory,
}) => {
  const [input, setInput] = useState('');
  const [activeTabByMessage, setActiveTabByMessage] = useState<Record<string, AgentId>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedMemoryId, setSavedMemoryId] = useState<string | null>(null);
  const [retryingTaskKey, setRetryingTaskKey] = useState<string | null>(null);
  const [memoryModalData, setMemoryModalData] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    category: MemoryItem['category'];
    messageId?: string;
  }>({
    isOpen: false,
    title: '',
    content: '',
    category: 'preference',
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedSpecialistsByMessage, setExpandedSpecialistsByMessage] = useState<Record<string, boolean>>({});
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'ur-PK' | 'en-US'>('ur-PK');
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Clean up speech recognition on component unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleSpeechRecognition = () => {
    setSpeechError(null);

    // If active, stop listening
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setSpeechNotice(null);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        'Aapka browser Web Speech API support nahi karta. Google Chrome ya Android Chrome browser use karein, ya normal tareeqay se type karein.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLang; // 'ur-PK' for Urdu & Roman Urdu, 'en-US' for English

      const langTitle = voiceLang === 'ur-PK' ? 'Urdu / Roman Urdu' : 'English';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setSpeechNotice(`Sun raha hoon (${langTitle})... Boley (Speak now)`);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (finalTranscript) {
          setInput((prev) => {
            const trimmed = prev.trim();
            const addition = finalTranscript.trim();
            return trimmed ? `${trimmed} ${addition}` : addition;
          });
          setSpeechNotice(`Transcribed: "${finalTranscript.trim().slice(0, 32)}..."`);

          // Auto-resize textarea to fit transcribed text
          if (textareaRef.current) {
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
              }
            }, 50);
          }
        } else if (interimTranscript) {
          setSpeechNotice(`Listening: "${interimTranscript.trim().slice(0, 32)}..."`);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError(
            'Microphone access deny ho gaya. Browser address bar mein mic icon tap karke permission allow karein, ya normal typing use karein.'
          );
        } else if (event.error === 'no-speech') {
          setSpeechNotice('Koi aawaz detect nahi hui. Dubara bolne ke liye microphone tap karein.');
          setTimeout(() => setSpeechNotice(null), 3500);
        } else if (event.error === 'audio-capture') {
          setSpeechError('Microphone hardware detect nahi ho saka. Device microphone check karein.');
        } else if (event.error === 'network') {
          setSpeechError('Speech recognition ke doran network issue aya. Connection check karein ya type karein.');
        } else if (event.error !== 'aborted') {
          setSpeechError(`Voice input error (${event.error}). Aap normally type karke chat continue kar sakte hain.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      setSpeechError(
        'Microphone shuru karne mein masla hua. Permission check karein ya direct type karein.'
      );
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const prompt = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const [selectedPromptCategory, setSelectedPromptCategory] = useState<string>('All');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadMessage = (content: string, id: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `response_${id.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleOpenSaveMemoryModal = (msg: ChatMessage) => {
    const summaryTitle = msg.plan?.summary ? `Learned: ${msg.plan.summary.slice(0, 50)}` : 'Response Guidance';
    const content = msg.content.slice(0, 300) + (msg.content.length > 300 ? '...' : '');
    setMemoryModalData({
      isOpen: true,
      title: summaryTitle,
      content,
      category: 'preference',
      messageId: msg.id,
    });
  };

  const handleOpenNewPreferenceModal = () => {
    setMemoryModalData({
      isOpen: true,
      title: '',
      content: input.trim(),
      category: 'preference',
    });
  };

  const handleConfirmSaveMemory = async (data: {
    category: MemoryItem['category'];
    title: string;
    content: string;
  }) => {
    await onSaveToMemory(data.title, data.content, data.category);
    if (memoryModalData.messageId) {
      setSavedMemoryId(memoryModalData.messageId);
      setTimeout(() => setSavedMemoryId(null), 3000);
    }
  };

  const handleRetrySpecialistClick = async (
    messageId: string,
    taskId: string | undefined,
    userPrompt: string | undefined,
    contributions: AgentContribution[] | undefined
  ) => {
    if (!onRetrySpecialist || !taskId || retryingTaskKey) return;
    setRetryingTaskKey(`${messageId}_${taskId}`);
    try {
      await onRetrySpecialist(messageId, taskId, userPrompt || '', contributions || []);
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetryingTaskKey(null);
    }
  };

  const renderStatusBadge = (status: ExecutionStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            SUCCESS
          </span>
        );
      case 'PLANNING_COMPLETE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300">
            <Sparkles className="w-3 h-3 text-sky-400" />
            PLANNING COMPLETE
          </span>
        );
      case 'TOOL_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            TOOL UNAVAILABLE
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            FAILED
          </span>
        );
      case 'NOT_EXECUTED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
            <MinusCircle className="w-3 h-3 text-slate-500" />
            NOT EXECUTED
          </span>
        );
    }
  };

  const starterCategories = [
    'All',
    'Web & Code',
    'Android',
    'Marketing',
    'WhatsApp',
    'Documents',
    'Roman Urdu',
    'Education',
  ];

  const starterPrompts = [
    {
      category: 'Web & Code',
      badge: 'HTML / JS / CSS',
      title: 'Responsive Modern Landing Page',
      prompt: 'Build a single-file modern responsive HTML/CSS/Tailwind landing page for a SaaS app with hero section, features grid, pricing table, and interactive FAQ accordion. Provide complete executable HTML with script.',
    },
    {
      category: 'Web & Code',
      badge: 'Algorithm / JS',
      title: 'JavaScript In-Browser Execution & Test',
      prompt: 'Write a JavaScript function that takes an array of transactions, groups them by category, calculates monthly burn rate, and detects unusual spending spikes. Include executable sample test code with console.log output.',
    },
    {
      category: 'Android',
      badge: 'Kotlin / Compose',
      title: 'Android Architecture & Room DB Roadmap',
      prompt: 'Design an Android app architecture in Kotlin using Jetpack Compose and Room DB for an offline-first expense tracker. Provide the schema, DAO, ViewModel, and step-by-step build roadmap.',
    },
    {
      category: 'Marketing',
      badge: 'Meta Ads',
      title: 'Facebook & Instagram Ad Campaign & Hooks',
      prompt: 'Create a high-converting Facebook and Instagram ad campaign for an online course. Include 3 audience targeting sets, 5 emotional hook variations, ad copy body with emojis, and ROAS performance metrics.',
    },
    {
      category: 'WhatsApp',
      badge: 'Business Messaging',
      title: 'WhatsApp Business Templates & Funnel',
      prompt: 'Create 5 WhatsApp Business message templates for an e-commerce store: Welcome greeting, product catalog inquiry, order confirmation, shipping tracking, and customer feedback. Make them natural and high-conversion.',
    },
    {
      category: 'Documents',
      badge: 'Resume / CV',
      title: 'ATS-Friendly Senior Developer CV',
      prompt: 'Draft an ATS-optimized, high-impact Professional CV for a Full-Stack Engineer with 4 years experience. Include executive summary, quantifiable achievements (metrics/impact), core technical stack, and clean layout.',
    },
    {
      category: 'Roman Urdu',
      badge: 'Business & Tasks',
      title: 'Zero-Budget Mobile Business (Roman Urdu)',
      prompt: 'Main Agent: Mujhe zero budget aur sirf Android mobile se online business shuru karne ka plan banana hai. Is kaam ko Research Agent, Writing Agent, Technical Agent aur Task Manager Agent mein divide karo aur Roman Urdu mein complete actionable roadmap aur saved tasks do.',
    },
    {
      category: 'Education',
      badge: 'Math & Science',
      title: 'Step-by-Step Science / Math Breakdown',
      prompt: 'Explain Gradient Descent and backpropagation in machine learning with simple visual analogies, mathematical equations step-by-step, and practical code implementation.',
    },
  ];

  const filteredStarters =
    selectedPromptCategory === 'All'
      ? starterPrompts
      : starterPrompts.filter((s) => s.category === selectedPromptCategory);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-xl mx-auto">
      {/* Top action strip */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between border-b border-slate-900 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="text-teal-300/90 font-medium">SmartBuddy Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewPreferenceModal}
            className="flex items-center gap-1 text-teal-300 hover:text-white px-2 py-0.5 rounded bg-teal-950/50 border border-teal-800/50 hover:bg-teal-900/60 transition-colors"
            title="Explicitly save an instruction or preference to permanent memory"
          >
            <BrainCircuit className="w-3 h-3 text-teal-400" />
            <span>+ Memory</span>
          </button>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition-colors"
          >
            <History className="w-3 h-3 text-teal-400" />
            <span>Chat History ({messages.length})</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 ? (
          <div className="py-4 space-y-4 animate-in fade-in">
            {/* Hero Welcome Card */}
            <div className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-teal-500/20 rounded-2xl p-4 shadow-sm text-center">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-teal-500/20 border border-teal-500/30 text-teal-300 flex items-center justify-center mx-auto mb-2.5 shadow-sm shadow-teal-500/10">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">SmartBuddy</h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.2 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300">
                  Worldwide
                </span>
              </div>
              <p className="text-xs font-medium text-teal-400 mt-0.5">Your Global AI Assistant</p>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                All-in-one assistant for <span className="text-teal-300 font-medium">Web Creation</span>, <span className="text-cyan-300 font-medium">Coding</span>, <span className="text-blue-300 font-medium">Android</span>, <span className="text-emerald-300 font-medium">Marketing & Meta Ads</span>, <span className="text-purple-300 font-medium">Documents & CV</span>, and <span className="text-amber-300 font-medium">Multilingual</span> workflows worldwide.
              </p>

              <div className="flex items-center justify-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400">
                <BrainCircuit className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  <strong className="text-white">{activeMemoriesCount} active memories</strong> injected into every agent
                </span>
              </div>
            </div>

            {/* Capability Category Filter Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Select Workflow Capability
                </span>
                <span className="text-[10px] text-slate-500 font-medium">{filteredStarters.length} prompts</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {starterCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedPromptCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-all ${
                      selectedPromptCategory === cat
                        ? 'bg-gradient-to-r from-blue-600/30 to-teal-600/30 border-teal-500 text-teal-200 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Quick Starters Grid */}
              <div className="space-y-2">
                {filteredStarters.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(starter.prompt)}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800/80 hover:border-teal-500/40 transition-all text-xs group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white group-hover:text-teal-300 transition-colors">
                          {starter.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-950/60 border border-teal-800/40 text-teal-300">
                          {starter.badge}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </div>
                    <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">{starter.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === 'user';
            const isExpandedSpecialists = expandedSpecialistsByMessage[message.id] ?? true;
            const activeAgentTab = activeTabByMessage[message.id] || (message.agentContributions?.[0]?.agentId ?? 'research');

            const successCount = message.agentContributions?.filter((c) => c.status === 'SUCCESS').length || 0;
            const planningCount = message.agentContributions?.filter((c) => c.status === 'PLANNING_COMPLETE').length || 0;
            const toolUnavailableCount = message.agentContributions?.filter((c) => c.status === 'TOOL_UNAVAILABLE').length || 0;
            const failedCount = message.agentContributions?.filter((c) => c.status === 'FAILED').length || 0;
            const notExecutedCount = message.agentContributions?.filter((c) => c.status === 'NOT_EXECUTED').length || 0;
            const totalCount = message.agentContributions?.length || 0;

            return (
              <div key={message.id} className="space-y-2">
                {isUser ? (
                  // User Message
                  <div className="flex items-start justify-end gap-2.5">
                    <div className="max-w-[85%] bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <span className="block text-[10px] text-teal-100/75 text-right mt-1">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 border border-teal-500/30">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  // Assistant Orchestration Message
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 border border-teal-500/30 mt-1 shadow-sm shadow-teal-500/10">
                      <Bot className="w-4 h-4" />
                    </div>

                    <div className="flex-1 max-w-[92%] space-y-3">
                      {/* REQUIREMENT 3: Display each agent's actual result SEPARATELY before the final combined report */}
                      {message.agentContributions && message.agentContributions.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                          {/* Header with real execution audit */}
                          <div
                            onClick={() =>
                              setExpandedSpecialistsByMessage((prev) => ({
                                ...prev,
                                [message.id]: !isExpandedSpecialists,
                              }))
                            }
                            className="p-3 bg-slate-850 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  failedCount > 0 ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
                                }`}
                              />
                              <span className="text-xs font-bold text-white">Specialist Agents Execution Audit</span>
                              <span className="text-[10px] text-slate-400">
                                ({successCount > 0 && `${successCount} SUCCESS, `}
                                {planningCount > 0 && `${planningCount} PLANNING_COMPLETE, `}
                                {toolUnavailableCount > 0 && `${toolUnavailableCount} TOOL_UNAVAILABLE, `}
                                {failedCount > 0 && `${failedCount} FAILED, `}
                                {notExecutedCount > 0 && `${notExecutedCount} NOT EXECUTED`}
                                {successCount === 0 && planningCount === 0 && toolUnavailableCount === 0 && failedCount === 0 && notExecutedCount === 0 && `${totalCount} agents`}
                                )
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                              <span className="text-[11px]">{isExpandedSpecialists ? 'Collapse' : 'Expand'}</span>
                              {isExpandedSpecialists ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>

                          {/* Plan summary */}
                          {message.plan && (
                            <div className="p-2.5 bg-slate-950/60 border-b border-slate-800 text-[11px] text-slate-300">
                              <span className="font-semibold text-teal-300">SmartBuddy Strategy: </span>
                              <span>{message.plan.summary}</span>
                            </div>
                          )}

                          {/* Separate Results of All Specialists */}
                          {isExpandedSpecialists && (
                            <div className="p-3 bg-slate-950 space-y-3">
                              {/* Agent Selection Tabs */}
                              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                                {message.agentContributions.map((contrib) => {
                                  const agentMeta = AGENTS_INFO[contrib.agentId] || AGENTS_INFO.main;
                                  const isTabActive = activeAgentTab === contrib.agentId;

                                  return (
                                    <button
                                      key={contrib.agentId}
                                      onClick={() =>
                                        setActiveTabByMessage((prev) => ({
                                          ...prev,
                                          [message.id]: contrib.agentId,
                                        }))
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                                        isTabActive
                                          ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      <span>{agentMeta.name}</span>
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          contrib.status === 'SUCCESS'
                                            ? 'bg-emerald-400'
                                            : contrib.status === 'PLANNING_COMPLETE'
                                            ? 'bg-sky-400'
                                            : contrib.status === 'TOOL_UNAVAILABLE'
                                            ? 'bg-amber-400'
                                            : contrib.status === 'FAILED'
                                            ? 'bg-rose-400'
                                            : 'bg-slate-500'
                                        }`}
                                      />
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Selected Specialist's Output Card */}
                              {(() => {
                                const currentContrib =
                                  message.agentContributions.find((c) => c.agentId === activeAgentTab) ||
                                  message.agentContributions[0];

                                if (!currentContrib) return null;
                                const agentMeta = AGENTS_INFO[currentContrib.agentId] || AGENTS_INFO.main;
                                const isRetryingThis =
                                  retryingTaskKey === `${message.id}_${currentContrib.taskId}`;

                                return (
                                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs animate-in fade-in">
                                    <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full border font-semibold ${agentMeta.badgeColor}`}>
                                          {agentMeta.name}
                                        </span>
                                        {renderStatusBadge(currentContrib.status)}
                                      </div>

                                      {currentContrib.durationMs && (
                                        <span className="text-[10px] text-slate-500">{currentContrib.durationMs}ms duration</span>
                                      )}
                                    </div>

                                    {/* Tool Call & Status Details Box */}
                                    {currentContrib.toolDetail && (
                                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-slate-500 font-mono text-[10px]">TOOL:</span>
                                            <span className="font-mono text-indigo-300 font-semibold">{currentContrib.toolDetail.toolName}</span>
                                          </div>
                                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                            currentContrib.toolDetail.toolStatus === 'SUCCESS'
                                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                              : currentContrib.toolDetail.toolStatus === 'TOOL_UNAVAILABLE'
                                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                              : currentContrib.toolDetail.toolStatus === 'PLANNING_COMPLETE'
                                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                                              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                          }`}>
                                            {currentContrib.toolDetail.toolStatus}
                                          </span>
                                        </div>
                                        {currentContrib.toolDetail.reason && (
                                          <div className="text-[11px] text-amber-300/90 leading-tight">
                                            <span className="font-semibold text-amber-400">Notice: </span>
                                            {currentContrib.toolDetail.reason}
                                          </div>
                                        )}
                                        {currentContrib.toolDetail.details && (
                                          <div className="text-[10px] text-slate-400 font-mono">
                                            <span className="text-slate-500">Details: </span>
                                            {currentContrib.toolDetail.details}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="text-slate-300 font-medium text-[11px]">
                                      <span className="text-slate-500">Assigned Subtask: </span>
                                      {currentContrib.subtask}
                                    </div>

                                    {/* Real Result Display or Real Error */}
                                    {currentContrib.status === 'SUCCESS' ||
                                    currentContrib.status === 'PLANNING_COMPLETE' ||
                                    currentContrib.status === 'TOOL_UNAVAILABLE' ? (
                                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 max-h-64 overflow-y-auto">
                                        <MarkdownView content={currentContrib.output} />
                                      </div>
                                    ) : currentContrib.status === 'FAILED' ? (
                                      <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-2">
                                        <div className="flex items-start gap-1.5 text-rose-300">
                                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                                          <div>
                                            <span className="font-semibold block">Function Call Failed</span>
                                            <span className="text-[11px] opacity-90">{currentContrib.error || 'Unknown execution error'}</span>
                                          </div>
                                        </div>
                                        {currentContrib.taskId && onRetrySpecialist && (
                                          <button
                                            onClick={() =>
                                              handleRetrySpecialistClick(
                                                message.id,
                                                currentContrib.taskId,
                                                message.userPrompt || message.content,
                                                message.agentContributions
                                              )
                                            }
                                            disabled={isRetryingThis}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                                          >
                                            <RotateCw className={`w-3 h-3 ${isRetryingThis ? 'animate-spin' : ''}`} />
                                            <span>{isRetryingThis ? 'Retrying Agent Call...' : 'Retry This Agent Function'}</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-[11px]">
                                        <MinusCircle className="w-4 h-4 inline mr-1 text-slate-500" />
                                        <span>NOT EXECUTED: This specialist was not required for this prompt.</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Final Combined Report Generated by SmartBuddy */}
                      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
                            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                            <span>SmartBuddy Global Synthesis</span>
                          </div>
                          {message.memoriesApplied && message.memoriesApplied.length > 0 && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>{message.memoriesApplied.length} memories enforced</span>
                            </span>
                          )}
                        </div>

                        {/* Markdown Output */}
                        <MarkdownView content={message.content} />

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopy(message.content, message.id)}
                              className="flex items-center gap-1 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleOpenSaveMemoryModal(message)}
                              className="flex items-center gap-1 hover:text-indigo-300 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
                              title="Review and save to permanent memory with explicit permission"
                            >
                              {savedMemoryId === message.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Saved to Memory!</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                  <span>Save to Memory</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleDownloadMessage(message.content, message.id)}
                              className="flex items-center gap-1 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
                              title="Download response as Markdown (.md) document"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-400" />
                              <span>Export .md</span>
                            </button>
                          </div>

                          <button
                            onClick={onNavigateToTasks}
                            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Tasks</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading state indicator with step-by-step agent animation */}
        {isLoading && (
          <div className="flex items-start gap-2.5 animate-in fade-in">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 border border-teal-500/30 shadow-sm shadow-teal-500/10">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-4 space-y-2 max-w-[85%]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                <span>SmartBuddy is Coordinating Specialists...</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                SmartBuddy is executing <code className="text-teal-300 font-mono text-[10px]">executeResearchAgent</code>, <code className="text-teal-300 font-mono text-[10px]">executeWritingAgent</code>, <code className="text-teal-300 font-mono text-[10px]">executeTechnicalAgent</code>, and <code className="text-teal-300 font-mono text-[10px]">executeTaskManagerAgent</code>.
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded-md border border-cyan-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>Research Agent</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-950/40 px-2 py-1 rounded-md border border-amber-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Writing Agent</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Technical Agent</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-purple-300 bg-purple-950/40 px-2 py-1 rounded-md border border-purple-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                  <span>Task Manager</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80 space-y-1.5">
        {/* Voice Input Error Banner */}
        {speechError && (
          <div className="px-3 py-2 rounded-xl bg-amber-950/80 border border-amber-600/40 text-[11px] text-amber-200 flex items-start justify-between gap-2 animate-in fade-in shadow-md">
            <div className="flex items-start gap-1.5 flex-1">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{speechError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSpeechError(null)}
              className="text-amber-400 hover:text-amber-200 p-0.5 shrink-0"
              aria-label="Dismiss error notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Listening Indicator */}
        {isListening && (
          <div className="px-3 py-2 rounded-xl bg-rose-950/70 border border-rose-600/40 text-[11px] text-rose-200 flex items-center justify-between gap-2 animate-in fade-in shadow-md">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="truncate font-medium">
                {speechNotice || `Sun raha hoon (${voiceLang === 'ur-PK' ? 'Urdu / Roman Urdu' : 'English'})... Boley`}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-semibold shrink-0 shadow-sm"
            >
              Done (Rokein)
            </button>
          </div>
        )}

        {!isListening && speechNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-teal-950/60 border border-teal-800/60 text-[11px] text-teal-300 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5 truncate">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{speechNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setSpeechNotice(null)}
              className="text-[10px] text-teal-300 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-end gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 focus-within:border-teal-500/80 transition-colors shadow-lg">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? `Sun raha hoon (${voiceLang === 'ur-PK' ? 'Urdu/Roman' : 'English'})... Boley (Speak now)...`
                : "Ask SmartBuddy anything (English, Urdu, Roman Urdu)..."
            }
            className="flex-1 bg-transparent border-0 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none max-h-28"
          />

          {/* Voice Language Selector */}
          <button
            type="button"
            onClick={() => setVoiceLang((prev) => (prev === 'ur-PK' ? 'en-US' : 'ur-PK'))}
            title={`Aawaz ki zuban badlein (Current: ${voiceLang === 'ur-PK' ? 'Urdu / Roman Urdu' : 'English'})`}
            className="h-9 px-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 shrink-0 transition-colors"
          >
            <span className={voiceLang === 'ur-PK' ? 'text-amber-400' : 'text-teal-300'}>
              {voiceLang === 'ur-PK' ? 'اردو' : 'EN'}
            </span>
          </button>

          {/* Voice Input Microphone Button */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            aria-label={isListening ? "Stop voice listening" : "Tap to speak with voice"}
            title={
              isListening
                ? "Recording rokein (Stop speaking)"
                : `Aawaz se bolne ke liye tap karein (${voiceLang === 'ur-PK' ? 'Urdu/Roman Urdu' : 'English'})`
            }
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all border ${
              isListening
                ? 'bg-rose-600 text-white border-rose-400 shadow-rose-900/60 shadow-lg ring-2 ring-rose-500/60 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700/80 hover:text-white hover:bg-slate-700 active:scale-95'
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-teal-400" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-teal-900/30"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3 text-slate-400" />
            <span>Voice input: {voiceLang === 'ur-PK' ? 'Urdu & Roman Urdu' : 'English'}</span>
          </span>
          <span className="text-teal-400 font-medium">✓ {activeMemoriesCount} active memories enforced</span>
        </div>
      </div>

      {/* History Drawer Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <History className="w-4 h-4 text-teal-400" />
                <span>Chat History ({messages.length} messages)</span>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 text-xs">
              {messages.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No saved chat history yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-indigo-300 uppercase">{m.role}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-200 line-clamp-2">{m.content}</p>
                    {m.agentContributions && (
                      <span className="text-[10px] text-slate-500">
                        {m.agentContributions.length} specialist agents called
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/60">
              {onClearHistory && messages.length > 0 && (
                <button
                  onClick={async () => {
                    await onClearHistory();
                    setIsHistoryOpen(false);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Clear History
                </button>
              )}
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="ml-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Permission Modal for Permanent Memory */}
      <SaveMemoryModal
        isOpen={memoryModalData.isOpen}
        onClose={() => setMemoryModalData((prev) => ({ ...prev, isOpen: false }))}
        initialTitle={memoryModalData.title}
        initialContent={memoryModalData.content}
        initialCategory={memoryModalData.category}
        onConfirm={handleConfirmSaveMemory}
      />
    </div>
  );
};
