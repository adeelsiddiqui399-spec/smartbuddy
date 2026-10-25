import React, { useState } from 'react';
import {
  BrainCircuit,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Eye,
  Sliders,
  BookmarkCheck,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { MemoryItem } from '../types';
import { isSensitiveMemoryContent } from '../services/api';

interface MemoryScreenProps {
  memories: MemoryItem[];
  onAddMemory: (data: { category: MemoryItem['category']; title: string; content: string }) => Promise<void>;
  onUpdateMemory: (id: string, updates: Partial<MemoryItem>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const MemoryScreen: React.FC<MemoryScreenProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const [filter, setFilter] = useState<'all' | 'instruction' | 'preference' | 'context'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [category, setCategory] = useState<MemoryItem['category']>('instruction');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredMemories = memories.filter((m) => (filter === 'all' ? true : m.category === filter));
  const activeCount = memories.filter((m) => m.isActive).length;

  const handleOpenAdd = (defaultCat: MemoryItem['category'] = 'instruction') => {
    setCategory(defaultCat);
    setTitle('');
    setContent('');
    setFormError(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setCategory(item.category);
    setTitle(item.title);
    setContent(item.content);
    setFormError(null);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const titleCheck = isSensitiveMemoryContent(title);
    if (titleCheck.isSensitive) {
      setFormError(titleCheck.reason || 'Sensitive content detected');
      return;
    }
    const contentCheck = isSensitiveMemoryContent(content);
    if (contentCheck.isSensitive) {
      setFormError(contentCheck.reason || 'Sensitive content detected');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onAddMemory({ category, title: title.trim(), content: content.trim() });
      setIsAdding(false);
      setTitle('');
      setContent('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to save memory.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !title.trim() || !content.trim()) return;

    const titleCheck = isSensitiveMemoryContent(title);
    if (titleCheck.isSensitive) {
      setFormError(titleCheck.reason || 'Sensitive content detected');
      return;
    }
    const contentCheck = isSensitiveMemoryContent(content);
    if (contentCheck.isSensitive) {
      setFormError(contentCheck.reason || 'Sensitive content detected');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onUpdateMemory(editingId, {
        category,
        title: title.trim(),
        content: content.trim(),
      });
      setEditingId(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update memory.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: MemoryItem) => {
    await onUpdateMemory(item.id, { isActive: !item.isActive });
  };

  const getCategoryMeta = (cat: MemoryItem['category']) => {
    switch (cat) {
      case 'instruction':
        return { label: 'Instruction', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      case 'preference':
        return { label: 'Preference', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'context':
        return { label: 'Context', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-xl mx-auto space-y-4">
      {/* Screen Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">SmartBuddy Memory Bank</h1>
              <p className="text-xs text-slate-400">
                {activeCount} of {memories.length} rules active & enforced
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPromptPreview(!showPromptPreview)}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span>Prompt View</span>
          </button>
        </div>

        <p className="text-xs text-slate-300 mt-3 leading-relaxed border-t border-slate-800/80 pt-2.5">
          These approved instructions and personal preferences are <strong className="text-teal-300 font-medium">actually injected</strong> into the system prompt of SmartBuddy and every specialist agent (Research, Writing, Technical, and Task Manager).
        </p>

        {/* Storage & Privacy Status Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dual Storage: Server Disk (data/memory.json) + LocalStorage Sync</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Sensitive Data Blocked</span>
          </div>
        </div>

        {/* Live Prompt Injection Preview */}
        {showPromptPreview && (
          <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 space-y-1">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-sans font-semibold">
              Actual System Instruction Injected into Gemini:
            </div>
            <pre className="whitespace-pre-wrap text-[11px] text-indigo-200/90 leading-relaxed bg-slate-900/60 p-2 rounded">
              {activeCount > 0
                ? memories
                    .filter((m) => m.isActive)
                    .map((m, i) => `${i + 1}. [${m.category.toUpperCase()}] ${m.title}: ${m.content}`)
                    .join('\n')
                : '(No rules currently active)'}
            </pre>
          </div>
        )}
      </div>

      {/* Category Filter & Add Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs overflow-x-auto">
          {(['all', 'instruction', 'preference', 'context'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors font-medium whitespace-nowrap ${
                filter === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'all' ? 'All' : cat + 's'}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleOpenAdd(filter === 'all' ? 'instruction' : filter)}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Add Memory Modal/Form */}
      {isAdding && (
        <form onSubmit={handleSaveAdd} className="bg-slate-900 border border-indigo-500/40 p-4 rounded-2xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Add Approved Instruction or Preference</span>
            </div>
            <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="text-[11px]">{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(['instruction', 'preference', 'context'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`py-1.5 text-xs rounded-lg border capitalize transition-all font-medium ${
                  category === c
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Concise Bullet Points, Avoid Fluff..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Instruction Details</label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the rule or preference the agents must obey..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              required
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
              disabled={submitting || !title.trim() || !content.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      )}

      {/* Memory List */}
      <div className="space-y-2.5">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <BookmarkCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No memories in this category</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add instructions or preferences to tailor the Main Agent and specialists to your exact needs.
            </p>
          </div>
        ) : (
          filteredMemories.map((item) => {
            const meta = getCategoryMeta(item.category);
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <form
                  key={item.id}
                  onSubmit={handleSaveEdit}
                  className="bg-slate-900 border border-indigo-500/40 p-4 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold text-white">Edit Memory Item</span>
                    <button type="button" onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {formError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="text-[11px]">{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {(['instruction', 'preference', 'context'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`py-1 text-xs rounded-lg border capitalize transition-all ${
                          category === c
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />

                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                    required
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
                    >
                      {submitting ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.isActive
                    ? 'bg-slate-900/90 border-slate-800 shadow-sm'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.label}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">{item.content}</p>
                  </div>

                  {/* Toggle Active Switch */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(item)}
                      title={item.isActive ? 'Active (injected into prompts)' : 'Inactive (disabled)'}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        item.isActive ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          item.isActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                  <span>
                    Status: <strong className={item.isActive ? 'text-emerald-400' : 'text-slate-500'}>{item.isActive ? 'Enforced' : 'Paused'}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 hover:text-slate-300 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-rose-800/40 animate-in fade-in">
                        <span className="text-[10px] text-rose-400 font-semibold">Delete?</span>
                        <button
                          onClick={async () => {
                            await onDeleteMemory(item.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-1 py-0.5 text-slate-400 hover:text-white text-[10px]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-1 hover:text-rose-400 rounded transition-colors"
                        title="Delete memory item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
