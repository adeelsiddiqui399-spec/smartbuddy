import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  Sparkles,
  PlayCircle,
  RotateCw,
} from 'lucide-react';
import { AgentId, AgentTask, TaskStatus } from '../types';
import { AGENTS_INFO, SPECIALIST_AGENTS } from '../agentConfig';
import { MarkdownView } from './MarkdownView';

interface TasksScreenProps {
  tasks: AgentTask[];
  onAddTask: (data: { agentId: AgentId; title: string; description?: string }) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<AgentTask>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onRetryTask?: (id: string) => Promise<void>;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onRetryTask,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [agentFilter, setAgentFilter] = useState<'all' | AgentId>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  // New task form state
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('task_manager');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;
    const matchesAgent = agentFilter === 'all' ? true : t.agentId === agentFilter;
    return matchesStatus && matchesAgent;
  });

  const pendingCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await onAddTask({
        agentId: selectedAgent,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setIsAdding(false);
      setNewTitle('');
      setNewDescription('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (taskId: string) => {
    if (!onRetryTask || retryingTaskId) return;
    setRetryingTaskId(taskId);
    try {
      await onRetryTask(taskId);
    } catch (err) {
      console.error('Task retry failed:', err);
    } finally {
      setRetryingTaskId(null);
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completed',
          icon: CheckCircle2,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          icon: Clock,
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        };
      case 'pending':
        return {
          label: 'Pending',
          icon: PlayCircle,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        };
      case 'failed':
        return {
          label: 'Failed',
          icon: AlertCircle,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        };
      case 'not_executed':
        return {
          label: 'Not Executed',
          icon: Clock,
          color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        };
      case 'skipped':
        return {
          label: 'Skipped',
          icon: Clock,
          color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        };
    }
  };

  const toggleTaskStatus = async (task: AgentTask) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    await onUpdateTask(task.id, { status: nextStatus });
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-xl mx-auto space-y-4">
      {/* Overview Card */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Task Management & Status</h1>
              <p className="text-xs text-slate-400">
                {completedCount} completed · {pendingCount} in progress {failedCount > 0 && `· ${failedCount} failed`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-teal-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2.5">
          Tasks created by <strong className="text-teal-300 font-medium">SmartBuddy</strong> and executed by the 4 specialists appear here with real status and deliverables. Tasks are never marked completed until execution succeeds.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Status Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs overflow-x-auto">
          {(['all', 'pending', 'in_progress', 'completed', 'failed', 'not_executed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors font-medium whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'all' ? 'All Status' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Agent Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setAgentFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors whitespace-nowrap ${
              agentFilter === 'all'
                ? 'bg-slate-800 border-slate-700 text-white font-medium'
                : 'border-slate-800/60 text-slate-400 hover:text-slate-300'
            }`}
          >
            All Agents
          </button>
          {SPECIALIST_AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setAgentFilter(agent.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors whitespace-nowrap ${
                agentFilter === agent.id
                  ? 'bg-slate-800 border-slate-700 text-white font-medium'
                  : 'border-slate-800/60 text-slate-400 hover:text-slate-300'
              }`}
            >
              {agent.name.replace(' Agent', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Add Task Form Modal */}
      {isAdding && (
        <form onSubmit={handleCreateTask} className="bg-slate-900 border border-purple-500/40 p-4 rounded-2xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-white">Create New Task</span>
            <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Assign to Agent</label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALIST_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`p-2 text-left rounded-xl border text-xs transition-all ${
                    selectedAgent === agent.id
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-semibold'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>{agent.name}</div>
                  <div className="text-[10px] opacity-75 font-normal">{agent.role}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Task Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Conduct benchmark comparison on API speeds..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Detailed Requirements</label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Specific guidelines or deliverables expected..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !newTitle.trim()}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No tasks found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Send an instruction in the Chat tab or click New Task to generate real actionable items.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const agent = AGENTS_INFO[task.agentId] || AGENTS_INFO.task_manager;
            const statusMeta = getStatusBadge(task.status);
            const StatusIcon = statusMeta.icon;
            const isExpanded = expandedId === task.id;
            const isRetrying = retryingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 transition-all shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {/* Status checkbox button */}
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                      task.status === 'completed'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : task.status === 'failed'
                        ? 'bg-rose-950/60 border-rose-500 text-rose-400'
                        : 'border-slate-700 bg-slate-800/80 text-transparent hover:border-slate-500'
                    }`}
                  >
                    {task.status === 'failed' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${agent.badgeColor}`}>
                        {agent.name}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusMeta.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusMeta.label}
                      </span>
                    </div>

                    <h4
                      className={`text-xs font-bold ${
                        task.status === 'completed' ? 'line-through text-slate-400' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Error display and retry button */}
                    {task.status === 'failed' && (
                      <div className="mt-2.5 p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-xl space-y-2">
                        <div className="text-[11px] text-rose-300 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{task.error || 'Execution failed'}</span>
                        </div>
                        {onRetryTask && (
                          <button
                            onClick={() => handleRetry(task.id)}
                            disabled={isRetrying}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RotateCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                            <span>{isRetrying ? 'Retrying Agent...' : 'Retry Specialist Task'}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Agent Output Dropdown */}
                    {task.output && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : task.id)}
                          className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>{isExpanded ? 'Hide Agent Deliverable' : 'View Agent Deliverable'}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
                            <MarkdownView content={task.output} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                      <span>
                        {task.completedAt
                          ? `Done: ${new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : task.startedAt
                          ? `Started: ${new Date(task.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </span>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
