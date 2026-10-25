import React from 'react';
import { MessageSquare, Users, CheckSquare, BrainCircuit } from 'lucide-react';

export type NavTab = 'chat' | 'agents' | 'tasks' | 'memory';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeMemoriesCount: number;
  pendingTasksCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  activeMemoriesCount,
  pendingTasksCount,
}) => {
  const tabs = [
    {
      id: 'chat' as NavTab,
      label: 'Chat',
      icon: MessageSquare,
      badge: null,
    },
    {
      id: 'agents' as NavTab,
      label: 'Agents',
      icon: Users,
      badge: '5',
    },
    {
      id: 'tasks' as NavTab,
      label: 'Tasks',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? `${pendingTasksCount}` : null,
    },
    {
      id: 'memory' as NavTab,
      label: 'Memory',
      icon: BrainCircuit,
      badge: activeMemoriesCount > 0 ? `${activeMemoriesCount}` : null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 px-2 pb-safe max-w-xl mx-auto">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all relative ${
                isActive ? 'text-teal-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-all ${
                    isActive ? 'bg-gradient-to-br from-blue-500/20 to-teal-500/20 text-teal-300 scale-105 border border-teal-500/30 shadow-sm shadow-teal-500/20' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {tab.badge && (
                  <span
                    className={`absolute -top-1 -right-2 text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                      tab.id === 'tasks' && pendingTasksCount > 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : tab.id === 'memory'
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1 rounded-full bg-teal-400 absolute bottom-1 shadow-sm shadow-teal-400/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
