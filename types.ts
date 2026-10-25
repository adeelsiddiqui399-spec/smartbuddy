export type AgentId = 'main' | 'research' | 'writing' | 'technical' | 'task_manager';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'not_executed';

export type ExecutionStatus =
  | 'SUCCESS'
  | 'PLANNING_COMPLETE'
  | 'TOOL_UNAVAILABLE'
  | 'FAILED'
  | 'NOT_EXECUTED'
  | 'IN_PROGRESS'
  | 'PENDING';

export interface ToolExecutionDetail {
  toolName: string;
  toolStatus: 'SUCCESS' | 'FAILED' | 'TOOL_UNAVAILABLE' | 'NOT_ATTEMPTED' | 'PLANNING_COMPLETE';
  reason?: string;
  details?: string;
}

export interface AgentInfo {
  id: AgentId;
  name: string;
  role: string;
  shortDescription: string;
  specialties: string[];
  color: string;
  accentBg: string;
  accentBorder: string;
  badgeColor: string;
}

export interface AgentTask {
  id: string;
  agentId: AgentId;
  title: string;
  description: string;
  status: TaskStatus;
  output?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  toolDetail?: ToolExecutionDetail;
}

export interface MemoryItem {
  id: string;
  category: 'instruction' | 'preference' | 'context';
  title: string;
  content: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AgentContribution {
  agentId: AgentId;
  agentName: string;
  subtask: string;
  output: string;
  status: ExecutionStatus;
  error?: string;
  durationMs?: number;
  taskId?: string;
  toolDetail?: ToolExecutionDetail;
}

export interface OrchestrationPlan {
  summary: string;
  rationale: string;
  delegatedTasks: {
    agentId: AgentId;
    title: string;
    instructions: string;
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  userPrompt?: string;
  plan?: OrchestrationPlan;
  agentContributions?: AgentContribution[];
  memoriesApplied?: string[];
  isError?: boolean;
}

export interface ServerStatusResponse {
  ok: boolean;
  hasGeminiKey: boolean;
  model: string;
  searchGroundingQuotaExhausted?: boolean;
  activeMemoriesCount: number;
  totalTasksCount: number;
  totalHistoryCount?: number;
}
