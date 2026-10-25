import {
  AgentContribution,
  AgentId,
  AgentTask,
  ChatMessage,
  MemoryItem,
  OrchestrationPlan,
  ServerStatusResponse,
} from '../types';

export interface OrchestrationResult {
  plan: OrchestrationPlan;
  agentContributions: AgentContribution[];
  finalAnswer: string;
  createdTasks: AgentTask[];
  memoriesApplied: string[];
}

export async function getStatus(): Promise<ServerStatusResponse> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

// Chat History
export async function getHistory(): Promise<ChatMessage[]> {
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}

export async function saveHistory(messages: ChatMessage[]): Promise<void> {
  const res = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error('Failed to save chat history');
}

export async function clearHistory(): Promise<void> {
  const res = await fetch('/api/history', {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear chat history');
}

const MEMORIES_STORAGE_KEY = 'my_ai_agent_memories';

// Security check: validate that no passwords, API keys, private keys, or sensitive credentials are saved into Memory
export function isSensitiveMemoryContent(text: string): { isSensitive: boolean; reason?: string } {
  if (!text || typeof text !== 'string') return { isSensitive: false };

  // Password patterns
  if (/(?:password|passwd|pwd)\s*[:=]\s*\S+/i.test(text)) {
    return { isSensitive: true, reason: 'Passwords cannot be saved in Memory for security.' };
  }
  // API keys / tokens (Gemini AIza, OpenAI sk-, GitHub ghp_, generic Bearer tokens)
  if (/(?:AIza[0-9A-Za-z-_]{20,}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|bearer\s+[a-zA-Z0-9_\-\.]{15,}|api[\s_-]?key\s*[:=]\s*\S+)/i.test(text)) {
    return { isSensitive: true, reason: 'API keys, secret tokens, and credentials cannot be saved in Memory.' };
  }
  // Private keys
  if (/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i.test(text)) {
    return { isSensitive: true, reason: 'Private cryptographic keys cannot be saved in Memory.' };
  }
  // Credit cards
  if (/\b(?:\d{4}[ -]?){3}\d{4}\b/.test(text)) {
    return { isSensitive: true, reason: 'Credit card numbers cannot be saved in Memory.' };
  }

  return { isSensitive: false };
}

// Memory with dual-layer persistent storage (Server Disk data/memory.json + Browser localStorage)
export async function getMemories(): Promise<MemoryItem[]> {
  try {
    const res = await fetch('/api/memory');
    if (res.ok) {
      const data: MemoryItem[] = await res.json();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(data));
        } catch {
          // ignore localStorage quota error
        }
      }
      return data;
    }
  } catch (netErr) {
    console.warn('Network fetch for memories failed, using localStorage cache:', netErr);
  }

  // Fallback to browser localStorage if server network is unreachable
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem(MEMORIES_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  throw new Error('Failed to fetch memories from server or browser storage');
}

export async function addMemory(data: { category: MemoryItem['category']; title: string; content: string }): Promise<MemoryItem> {
  const checkTitle = isSensitiveMemoryContent(data.title);
  if (checkTitle.isSensitive) throw new Error(checkTitle.reason);

  const checkContent = isSensitiveMemoryContent(data.content);
  if (checkContent.isSensitive) throw new Error(checkContent.reason);

  const res = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add memory');
  }
  const created: MemoryItem = await res.json();

  // Dual-layer sync: persist immediately to browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem(MEMORIES_STORAGE_KEY);
      const list = cached ? JSON.parse(cached) : [];
      window.localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify([created, ...list]));
    } catch {
      // ignore
    }
  }

  return created;
}

export async function updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
  if (updates.title) {
    const check = isSensitiveMemoryContent(updates.title);
    if (check.isSensitive) throw new Error(check.reason);
  }
  if (updates.content) {
    const check = isSensitiveMemoryContent(updates.content);
    if (check.isSensitive) throw new Error(check.reason);
  }

  const res = await fetch(`/api/memory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update memory');
  }
  const updated: MemoryItem = await res.json();

  // Dual-layer sync: update browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem(MEMORIES_STORAGE_KEY);
      if (cached) {
        const list: MemoryItem[] = JSON.parse(cached);
        const next = list.map((m) => (m.id === id ? updated : m));
        window.localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
  }

  return updated;
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`/api/memory/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete memory');

  // Dual-layer sync: remove from browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem(MEMORIES_STORAGE_KEY);
      if (cached) {
        const list: MemoryItem[] = JSON.parse(cached);
        const next = list.filter((m) => m.id !== id);
        window.localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
  }
}

// Tasks
export async function getTasks(): Promise<AgentTask[]> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function addTask(data: { agentId: AgentId; title: string; description?: string }): Promise<AgentTask> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add task');
  }
  return res.json();
}

export async function updateTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update task');
  }
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

export async function retryTask(id: string): Promise<{ success: boolean; task: AgentTask }> {
  const res = await fetch(`/api/tasks/${id}/retry`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Specialist agent retry failed');
  }
  return res.json();
}

export async function resynthesizeWithSpecialist(
  taskId: string,
  userPrompt: string,
  contributions: AgentContribution[]
): Promise<{ success: boolean; updatedTask: AgentTask; updatedContributions: AgentContribution[]; finalAnswer: string }> {
  const res = await fetch('/api/orchestrate/resynthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, userPrompt, contributions }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to re-execute specialist and synthesize');
  }
  return res.json();
}

// Orchestration & Direct
export async function executeOrchestration(prompt: string): Promise<OrchestrationResult> {
  const res = await fetch('/api/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    let errMsg = 'Failed to execute agent orchestration';
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.error) errMsg = json.error;
      } catch {
        if (text) errMsg = text.slice(0, 150);
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export async function runDirectAgent(
  agentId: AgentId,
  prompt: string
): Promise<{ agentId: AgentId; output: string; appliedMemories: string[] }> {
  const res = await fetch('/api/agent-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, prompt }),
  });
  if (!res.ok) {
    let errMsg = 'Failed to execute direct agent call';
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.error) errMsg = json.error;
      } catch {
        if (text) errMsg = text.slice(0, 150);
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}
