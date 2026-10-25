import React, { useState, useEffect } from 'react';
import {
  Bot,
  BrainCircuit,
  Info,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { AgentId, AgentTask, ChatMessage, MemoryItem, ServerStatusResponse, AgentContribution } from './types';
import {
  getStatus,
  getHistory,
  saveHistory,
  clearHistory,
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  retryTask,
  resynthesizeWithSpecialist,
  executeOrchestration,
} from './services/api';
import { BottomNav, NavTab } from './components/BottomNav';
import { ChatScreen } from './components/ChatScreen';
import { SpecialistsScreen } from './components/SpecialistsScreen';
import { TasksScreen } from './components/TasksScreen';
import { MemoryScreen } from './components/MemoryScreen';
import { SetupModal } from './components/SetupModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [status, setStatus] = useState<ServerStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load initial data including persistent Chat History
  useEffect(() => {
    const init = async () => {
      try {
        const [statusData, historyData, mems, tks] = await Promise.all([
          getStatus().catch(() => null),
          getHistory().catch(() => []),
          getMemories().catch(() => []),
          getTasks().catch(() => []),
        ]);
        if (statusData) setStatus(statusData);
        if (Array.isArray(historyData) && historyData.length > 0) {
          setMessages(historyData);
        }
        setMemories(mems);
        setTasks(tks);
      } catch (err) {
        console.error('Initial load error:', err);
      }
    };
    init();
  }, []);

  const activeMemoriesCount = memories.filter((m) => m.isActive).length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;

  // Handle Send Message & Genuine Multi-Agent Orchestration
  const handleSendMessage = async (prompt: string) => {
    const userMessage: ChatMessage = {
      id: 'msg_u_' + Date.now(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      userPrompt: prompt,
    };

    const updatedAfterUser = [...messages, userMessage];
    setMessages(updatedAfterUser);
    saveHistory(updatedAfterUser).catch(console.error);

    setIsLoading(true);

    try {
      const result = await executeOrchestration(prompt);

      const assistantMessage: ChatMessage = {
        id: 'msg_a_' + Date.now(),
        role: 'assistant',
        content: result.finalAnswer,
        timestamp: Date.now(),
        userPrompt: prompt,
        plan: result.plan,
        agentContributions: result.agentContributions,
        memoriesApplied: result.memoriesApplied,
      };

      const finalMessages = [...updatedAfterUser, assistantMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages).catch(console.error);

      // Refresh tasks and memories from persistent storage
      const [updatedTasks, updatedMemories] = await Promise.all([
        getTasks().catch(() => []),
        getMemories().catch(() => memories),
      ]);
      setTasks(updatedTasks);
      setMemories(updatedMemories);
    } catch (err: any) {
      console.error('Orchestration failed:', err);
      const errorMessage: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `Execution Error: ${err.message || 'Failed to complete agent orchestration.'}\n\nPlease check that your Gemini API key is configured or inspect the Setup modal.`,
        timestamp: Date.now(),
        userPrompt: prompt,
        isError: true,
      };
      const finalMessages = [...updatedAfterUser, errorMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages).catch(console.error);
    } finally {
      setIsLoading(false);
    }
  };

  // Retry an individual specialist agent from the Chat view
  const handleRetrySpecialistInChat = async (
    messageId: string,
    taskId: string,
    userPrompt: string,
    contributions: AgentContribution[]
  ) => {
    try {
      const res = await resynthesizeWithSpecialist(taskId, userPrompt, contributions);
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              content: res.finalAnswer,
              agentContributions: res.updatedContributions,
            };
          }
          return m;
        });
        saveHistory(next).catch(console.error);
        return next;
      });

      // Refresh tasks list
      const refreshedTasks = await getTasks();
      setTasks(refreshedTasks);
      showToast('Specialist re-executed & final report updated');
    } catch (err: any) {
      showToast(err.message || 'Retry failed', 'error');
      throw err;
    }
  };

  // Retry a task from the Tasks screen
  const handleRetryTask = async (id: string) => {
    try {
      const res = await retryTask(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? res.task : t)));
      showToast('Specialist task completed successfully');
    } catch (err: any) {
      showToast(err.message || 'Retry failed', 'error');
      // Refresh tasks to show failed status
      const refreshed = await getTasks();
      setTasks(refreshed);
      throw err;
    }
  };

  // Memory Handlers
  const handleAddMemory = async (data: { category: MemoryItem['category']; title: string; content: string }) => {
    try {
      const created = await addMemory(data);
      setMemories((prev) => [created, ...prev]);
      showToast('Memory rule saved & enforced');
    } catch (err: any) {
      showToast(err.message || 'Failed to add memory', 'error');
      throw err;
    }
  };

  const handleUpdateMemory = async (id: string, updates: Partial<MemoryItem>) => {
    try {
      const updated = await updateMemory(id, updates);
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      showToast('Memory updated');
    } catch (err: any) {
      showToast(err.message || 'Failed to update memory', 'error');
      throw err;
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      showToast('Memory removed');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete memory', 'error');
      throw err;
    }
  };

  const handleSaveToMemoryFromChat = async (
    title: string,
    content: string,
    category: MemoryItem['category'] = 'preference'
  ) => {
    await handleAddMemory({
      category,
      title,
      content,
    });
  };

  // Task Handlers
  const handleAddTask = async (data: { agentId: AgentId; title: string; description?: string }) => {
    try {
      const created = await addTask(data);
      setTasks((prev) => [created, ...prev]);
      showToast('Task added to schedule');
    } catch (err: any) {
      showToast(err.message || 'Failed to add task', 'error');
      throw err;
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<AgentTask>) => {
    try {
      const updated = await updateTask(id, updates);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err: any) {
      showToast(err.message || 'Failed to update task', 'error');
      throw err;
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      showToast('Task deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete task', 'error');
      throw err;
    }
  };

  const handleClearChat = async () => {
    if (messages.length > 0) {
      setMessages([]);
      await clearHistory().catch(console.error);
      showToast('Chat history cleared');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none sm:select-text">
      {/* Top Application Bar (Android Mobile-Native feel) */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between max-w-xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 via-teal-500/20 to-cyan-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold shadow-sm shadow-teal-500/10">
            <Bot className="w-4 h-4 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight">SmartBuddy</span>
              <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.2 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300">
                Global
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="text-teal-400/90 font-medium">Your Global AI Assistant</span>
              <span>·</span>
              <span className="text-slate-400">{activeMemoriesCount} Memories</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {currentTab === 'chat' && messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Clear Chat"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsSetupOpen(true)}
            title="System Info & Setup"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors relative"
          >
            <Info className="w-4 h-4" />
            {status && !status.hasGeminiKey && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl mx-auto w-full overflow-hidden flex flex-col">
        {currentTab === 'chat' && (
          <ChatScreen
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            activeMemoriesCount={activeMemoriesCount}
            onSaveToMemory={handleSaveToMemoryFromChat}
            onNavigateToTasks={() => setCurrentTab('tasks')}
            onNavigateToMemory={() => setCurrentTab('memory')}
            onRetrySpecialist={handleRetrySpecialistInChat}
            onClearHistory={handleClearChat}
          />
        )}

        {currentTab === 'agents' && (
          <div className="flex-1 overflow-y-auto">
            <SpecialistsScreen activeMemoriesCount={activeMemoriesCount} />
          </div>
        )}

        {currentTab === 'tasks' && (
          <div className="flex-1 overflow-y-auto">
            <TasksScreen
              tasks={tasks}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onRetryTask={handleRetryTask}
            />
          </div>
        )}

        {currentTab === 'memory' && (
          <div className="flex-1 overflow-y-auto">
            <MemoryScreen
              memories={memories}
              onAddMemory={handleAddMemory}
              onUpdateMemory={handleUpdateMemory}
              onDeleteMemory={handleDeleteMemory}
            />
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs text-white animate-in fade-in slide-in-from-bottom-2">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Android Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeMemoriesCount={activeMemoriesCount}
        pendingTasksCount={pendingTasksCount}
      />

      {/* Setup & Architecture Modal */}
      <SetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        hasGeminiKey={status?.hasGeminiKey ?? true}
        activeMemoriesCount={activeMemoriesCount}
        searchGroundingQuotaExhausted={status?.searchGroundingQuotaExhausted ?? true}
      />
    </div>
  );
}
