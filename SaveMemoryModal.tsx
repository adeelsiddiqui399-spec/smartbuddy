import React, { useState } from 'react';
import { X, BrainCircuit, ShieldAlert, ShieldCheck, Check } from 'lucide-react';
import { MemoryItem } from '../types';
import { isSensitiveMemoryContent } from '../services/api';

interface SaveMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialContent?: string;
  initialCategory?: MemoryItem['category'];
  onConfirm: (data: { category: MemoryItem['category']; title: string; content: string }) => Promise<void>;
}

export const SaveMemoryModal: React.FC<SaveMemoryModalProps> = ({
  isOpen,
  onClose,
  initialTitle = '',
  initialContent = '',
  initialCategory = 'preference',
  onConfirm,
}) => {
  const [category, setCategory] = useState<MemoryItem['category']>(initialCategory);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const titleCheck = isSensitiveMemoryContent(title);
  const contentCheck = isSensitiveMemoryContent(content);
  const sensitiveError = titleCheck.isSensitive ? titleCheck.reason : contentCheck.isSensitive ? contentCheck.reason : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    if (sensitiveError) {
      setError(sensitiveError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        category,
        title: title.trim(),
        content: content.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save to permanent memory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Save to Permanent Memory</h2>
              <p className="text-[11px] text-slate-400">Explicit user consent required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {/* Permission Guarantee Note */}
          <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-200/90 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Permanent memory is stored on your server disk (<code className="text-indigo-300">data/memory.json</code>) and synced to browser storage. It will guide the Main Agent in future conversations.
            </p>
          </div>

          {/* Sensitive Data Error Alert */}
          {sensitiveError && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-start gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-[11px]">Security Protection:</span>
                <span className="text-[11px]">{sensitiveError}</span>
              </div>
            </div>
          )}

          {error && !sensitiveError && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-[11px]">
              {error}
            </div>
          )}

          {/* Category Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              Memory Category
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'preference', label: 'Preference' },
                  { id: 'instruction', label: 'Instruction' },
                  { id: 'context', label: 'Context' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`py-1.5 px-2 rounded-lg text-center font-medium capitalize border transition-all ${
                    category === cat.id
                      ? 'bg-indigo-600/30 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Title / Summary
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prefers Roman Urdu, React Native Techstack..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Memory Details & Rules
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What should the AI remember to obey in future conversations?"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              required
            />
          </div>

          {/* Security policy note */}
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Passwords, private keys, and API tokens are never allowed in Memory.</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !content.trim() || Boolean(sensitiveError)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Confirm & Save to Permanent Memory'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
