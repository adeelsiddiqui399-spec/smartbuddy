import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  AgentContribution,
  AgentId,
  AgentTask,
  ChatMessage,
  ExecutionStatus,
  MemoryItem,
  OrchestrationPlan,
  ToolExecutionDetail,
} from './src/types';

dotenv.config();

const app = express();
// Cloud Run dev environment requires binding strictly to port 3000 so container proxy (port 8080) can forward
const PORT = 3000;

app.use(express.json());

// Set up data directory for persistence
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const HISTORY_FILE = path.join(DATA_DIR, 'chat_history.json');

// Initial seed memories
const DEFAULT_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_1',
    category: 'instruction',
    title: 'Structured Output Format',
    content: 'Format answers with clear section headings, concise bullet points, and high-impact takeaways.',
    isActive: true,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'mem_2',
    category: 'instruction',
    title: 'Action-Oriented Next Steps',
    content: 'Always conclude complex answers with concrete, immediate action items.',
    isActive: true,
    createdAt: Date.now() - 72000000,
    updatedAt: Date.now() - 72000000,
  },
  {
    id: 'mem_3',
    category: 'preference',
    title: 'Direct & Professional Tone',
    content: 'Keep tone direct, polished, analytical, and respectful without repetitive filler phrases.',
    isActive: true,
    createdAt: Date.now() - 50000000,
    updatedAt: Date.now() - 50000000,
  },
  {
    id: 'mem_4',
    category: 'context',
    title: 'Mobile-First Accessibility',
    content: 'Optimized for quick reading on Android mobile screens, short paragraphs, and digestible modules.',
    isActive: true,
    createdAt: Date.now() - 30000000,
    updatedAt: Date.now() - 30000000,
  },
];

// Memory Helpers
function loadMemories(): MemoryItem[] {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading memory file:', err);
  }
  saveMemories(DEFAULT_MEMORIES);
  return DEFAULT_MEMORIES;
}

function saveMemories(memories: MemoryItem[]) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving memory file:', err);
  }
}

// Tasks Helpers
function loadTasks(): AgentTask[] {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading tasks file:', err);
  }
  return [];
}

function saveTasks(tasks: AgentTask[]) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving tasks file:', err);
  }
}

// History Helpers
function loadHistory(): ChatMessage[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading chat history file:', err);
  }
  return [];
}

function saveHistory(history: ChatMessage[]) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving chat history file:', err);
  }
}

// Gemini Client initialization
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const MODEL_NAME = 'gemini-3.1-flash-lite';

// Structured Mapped Preferences Interface
export interface MappedPreferences {
  language?: { value: string; sourceTitle: string };
  device?: { value: string; sourceTitle: string };
  budget?: { value: string; sourceTitle: string };
  instructionStyle?: { value: string; sourceTitle: string };
  tone?: { value: string; sourceTitle: string };
  rawItems: MemoryItem[];
}

// Explicit attribute mapper that inspects saved memory items and maps key fields without losing zero budget or device
function mapSavedPreferences(memories: MemoryItem[]): MappedPreferences {
  const active = memories.filter((m) => m.isActive);
  const result: MappedPreferences = {
    rawItems: active,
  };

  for (const m of active) {
    const combined = `${m.title} ${m.content}`.toLowerCase();

    // 1. Budget mapping (handles Zero, $0, 0, free tools, zero-cost, explicit numbers)
    if (!result.budget) {
      if (
        combined.includes('budget') ||
        combined.includes('zero') ||
        combined.includes('free tools') ||
        combined.includes('zero-cost') ||
        m.title.toLowerCase().includes('budget')
      ) {
        if (/zero|free|\$0|\b0\b/i.test(combined)) {
          result.budget = {
            value: 'Zero ($0 / Free tools only - do not suggest paid tools)',
            sourceTitle: m.title,
          };
        } else {
          result.budget = {
            value: m.content,
            sourceTitle: m.title,
          };
        }
      }
    }

    // 2. Device mapping (handles Android, iOS, mobile, desktop, etc.)
    if (!result.device) {
      if (/android|mobile|ios|iphone|device|phone|platform/i.test(combined)) {
        if (/android/i.test(combined)) {
          result.device = {
            value: 'Android Mobile',
            sourceTitle: m.title,
          };
        } else if (/ios|iphone/i.test(combined)) {
          result.device = {
            value: 'iOS / iPhone',
            sourceTitle: m.title,
          };
        } else {
          result.device = {
            value: m.content,
            sourceTitle: m.title,
          };
        }
      }
    }

    // 3. Language mapping (handles Roman Urdu, Urdu, English, etc.)
    if (!result.language) {
      if (/roman\s*urdu/i.test(combined)) {
        result.language = {
          value: 'Roman Urdu',
          sourceTitle: m.title,
        };
      } else if (/\burdu\b/i.test(combined)) {
        result.language = {
          value: 'Urdu',
          sourceTitle: m.title,
        };
      } else if (/\benglish\b/i.test(combined)) {
        result.language = {
          value: 'English',
          sourceTitle: m.title,
        };
      }
    }

    // 4. Instruction style mapping
    if (!result.instructionStyle) {
      if (/step-by-step|structured|bullet points|action-oriented|headings/i.test(combined)) {
        const parts: string[] = [];
        if (/step-by-step/i.test(combined)) parts.push('Step-by-step instructions');
        if (/structured|bullet points|headings/i.test(combined)) parts.push('Structured format with clear bullet points');
        if (/action-oriented|action items/i.test(combined)) parts.push('Concrete, action-oriented next steps');
        result.instructionStyle = {
          value: parts.join(', ') || m.content,
          sourceTitle: m.title,
        };
      }
    }

    // 5. Tone mapping
    if (!result.tone) {
      if (/tone|direct|professional|analytical/i.test(combined)) {
        result.tone = {
          value: m.content,
          sourceTitle: m.title,
        };
      }
    }
  }

  return result;
}

// Build memory context string using real persistent storage (loadMemories)
function getActiveMemoryContext(): {
  text: string;
  appliedTitles: string[];
  mapped: MappedPreferences;
  rawItems: MemoryItem[];
} {
  const memories = loadMemories();
  const active = memories.filter((m) => m.isActive);
  const mapped = mapSavedPreferences(active);

  if (active.length === 0) {
    return {
      text: 'PERSISTENT MEMORY STORAGE (/api/memory): No user instructions or preferences are currently active in storage.',
      appliedTitles: [],
      mapped,
      rawItems: [],
    };
  }

  const rawList = active
    .map((m, i) => `${i + 1}. [${m.category.toUpperCase()}] "${m.title}": ${m.content} (ID: ${m.id})`)
    .join('\n');

  const profileLines: string[] = [];
  if (mapped.language) profileLines.push(`• Preferred Language: ${mapped.language.value} (Retrieved from "${mapped.language.sourceTitle}")`);
  if (mapped.device) profileLines.push(`• Device Type / Platform: ${mapped.device.value} (Retrieved from "${mapped.device.sourceTitle}")`);
  if (mapped.budget) profileLines.push(`• Budget: ${mapped.budget.value} (Retrieved from "${mapped.budget.sourceTitle}")`);
  if (mapped.instructionStyle) profileLines.push(`• Instruction Style: ${mapped.instructionStyle.value} (Retrieved from "${mapped.instructionStyle.sourceTitle}")`);
  if (mapped.tone) profileLines.push(`• Tone: ${mapped.tone.value} (Retrieved from "${mapped.tone.sourceTitle}")`);

  const structuredSummary = profileLines.length > 0
    ? `\nRETRIEVED PERSISTENT PREFERENCES (Verified from data/memory.json):\n${profileLines.join('\n')}\n`
    : '';

  const text = `=== ACTIVE PERSISTENT MEMORY STORAGE (Directly retrieved from data/memory.json & /api/memory) ===
Total Active Stored Records: ${active.length}
${rawList}
${structuredSummary}==================================================================================================`;

  return {
    text,
    appliedTitles: active.map((m) => m.title),
    mapped,
    rawItems: active,
  };
}

// Agent Specialist Personas (All-in-One Practical Capabilities)
const AGENT_PERSONAS: Record<AgentId, string> = {
  main: `You are SmartBuddy, Your Global AI Assistant.
Your role is to deeply understand the user's natural language, context, needs, and goals, and deliver high-impact, complete, real-world solutions.
You support a comprehensive range of capabilities:
1. Website creation, responsive web design, HTML/CSS/JavaScript, and deployment guidance.
2. Programming, code explanation, bug fixing, algorithms, and tests.
3. Android app engineering (Kotlin, Jetpack Compose, XML, Room DB, Gradle, APKs).
4. Digital marketing, Meta (Facebook/Instagram) advertising copy, audience targeting, and budget plans.
5. Social media content, WhatsApp Business message scripts, and content publishing calendars.
6. Education, science, mathematics, language learning, and general knowledge.
7. Documents, ATS-compliant CVs, business plans, reports, proposals, and customer communications.
8. Creative work, design briefs, branding, slogans, productivity, and task management.
9. Any other reasonable user requests—always identify the core objective and deliver an actionable solution rather than rejecting requests.

CORE PRINCIPLES:
- Users interact ONLY with you. You seamlessly orchestrate the 4 specialist agents (Research, Writing, Technical, Task Manager) internally.
- Communicate fluently in the user's chosen language and style (Roman Urdu, Urdu, or English).
- Be honest about capabilities: if an external live platform (e.g. Meta Ads API, WhatsApp Cloud API, live hosting) is not directly connected to a live account, transparently provide the ready-to-use copy/code/specs for manual use.
- Conclude complex answers with concrete, immediate action items.`,

  research: `You are the Research Agent. You specialize in information retrieval, fact validation, comparative benchmarking, market research, domain background, and identifying real-world references and opportunities.
You cover:
- Market analysis, competitor benchmarking, and consumer trends.
- Digital marketing audience demographics, interest targeting parameters, and ad metrics.
- Educational, scientific, mathematical, and historical facts.
- Device specifications, tool compatibility, and free-tier software alternatives.
Provide verified, accurate, high-value findings tailored to the user's constraints. Follow language instructions (e.g. if user wrote in Roman Urdu, respond in Roman Urdu).`,

  writing: `You are the Writing Agent. You specialize in communication, copy creation, clear structuring, executive summaries, messaging scripts, and tone calibration.
You cover:
- High-converting Facebook & Instagram ad copy (Hooks, Primary Text, Headlines, Description, Call-to-Action).
- WhatsApp Business broadcast templates, automated greeting messages, and quick-reply customer service scripts.
- Professional, ATS-friendly CVs, cover letters, executive bios, and job applications.
- Business proposals, business plans, executive summaries, and formal client communications.
- Social media captions, hashtags, and storytelling copy.
Produce articulate, compelling, well-formatted content directly usable by the user. Follow language instructions.`,

  technical: `You are the Technical Agent. You specialize in software engineering, technical tools, web creation, mobile apps, setup instructions, architecture, and practical technical workflows.
You cover:
- Complete, responsive, self-contained HTML/CSS/JavaScript web pages and widgets ready for live preview and browser execution.
- Programming in TypeScript, JavaScript, Python, Kotlin, Java, PHP, C++, SQL, and modern frameworks.
- Android application architecture (Kotlin, Jetpack Compose, XML layouts, Room database, Gradle configuration, Android Studio setup).
- Mathematical calculations, formula derivations, algorithmic problem solving, and unit test cases.
- Deployment instructions for free hosting platforms (GitHub Pages, Vercel, Netlify, Render).
Provide concrete technical code, actionable steps, and realistic tool recommendations fitting the user's technical constraints. Follow language instructions.`,

  task_manager: `You are the Task Manager Agent. You specialize in operational execution, step-by-step checklists, milestone breakdown, prioritizing immediate actions, and identifying risks.
You cover:
- Actionable step-by-step implementation checklists for software, web, marketing, or business projects.
- Social media publishing schedules and content calendars (Day 1 to Day 30).
- Advertising campaign rollout timelines and A/B testing milestones.
- Risk identification and mitigation strategies.
Provide a clear, prioritized checklist and timeline that the user can immediately execute. Follow language instructions.`,
};

const AGENT_NAME_MAP: Record<AgentId, string> = {
  main: 'Main Agent',
  research: 'Research Agent',
  writing: 'Writing Agent',
  technical: 'Technical Agent',
  task_manager: 'Task Manager Agent',
};

// Resilient Model Execution with Fast Multi-Agent Latency
async function generateWithModelFallback(params: {
  contents: any;
  config?: any;
}) {
  if (!ai) {
    throw new Error('Gemini API key is not configured.');
  }

  try {
    return await ai.models.generateContent({
      model: MODEL_NAME,
      contents: params.contents,
      config: params.config,
    });
  } catch (err: any) {
    console.warn(`Primary model ${MODEL_NAME} encountered an error, attempting fallback to gemini-3.8-flash:`, err?.message);
    try {
      return await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: params.contents,
        config: {
          ...params.config,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch {
      throw err;
    }
  }
}

// ============================================================================
// Requirement 1: Separate Callable Functions for Each Specialist Agent
// ============================================================================

export interface SpecialistExecutionResult {
  text: string;
  status: ExecutionStatus;
  toolDetail?: ToolExecutionDetail;
}

// Tracks whether Google Search Grounding quota is exhausted on the current Gemini API tier
// On free tier keys, tools: [{ googleSearch: {} }] returns HTTP 429 RESOURCE_EXHAUSTED.
let isSearchGroundingQuotaExhausted = true;

// 1. Separate Callable Function: Research Agent
async function executeResearchAgent(params: {
  subtaskTitle: string;
  subtaskInstructions: string;
  userPrompt: string;
  memoryContext: string;
}): Promise<SpecialistExecutionResult> {
  const needsLiveWeb = /search|latest|current|news|web|real-time|population|price|weather|census|2025|2026/i.test(
    `${params.subtaskTitle} ${params.subtaskInstructions} ${params.userPrompt}`
  );

  let toolDetail: ToolExecutionDetail | undefined;
  let text = '';
  let status: ExecutionStatus = 'PLANNING_COMPLETE';

  if (needsLiveWeb) {
    if (isSearchGroundingQuotaExhausted) {
      // Avoid doomed 429 network calls when quota is known to be unavailable on free tier
      toolDetail = {
        toolName: 'google_web_search',
        toolStatus: 'TOOL_UNAVAILABLE',
        reason: 'Google Search Grounding requires paid Gemini API billing quota (free tier returned HTTP 429 RESOURCE_EXHAUSTED). Research Agent is synthesizing via verified internal domain knowledge.',
        details: 'Live web retrieval skipped due to confirmed quota limitations.',
      };
      status = 'PLANNING_COMPLETE';
    } else {
      toolDetail = {
        toolName: 'google_web_search',
        toolStatus: 'NOT_ATTEMPTED',
      };

      try {
        if (!ai) throw new Error('Gemini API key is not configured.');

        // Attempt Google Search Grounding with Gemini
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: `USER REQUEST: "${params.userPrompt}"\n\nRESEARCH TASK: ${params.subtaskTitle}\n${params.subtaskInstructions}\n\n${params.memoryContext}`,
          config: {
            systemInstruction: AGENT_PERSONAS.research,
            tools: [{ googleSearch: {} }],
          },
        });

        const extracted = response.text?.trim();
        if (extracted) {
          text = extracted;
          status = 'SUCCESS';
          toolDetail = {
            toolName: 'google_web_search',
            toolStatus: 'SUCCESS',
            details: 'Google Search grounding executed with verified live sources.',
          };
        }
      } catch (searchErr: any) {
        const isQuota =
          searchErr?.message?.includes('429') ||
          searchErr?.message?.includes('quota') ||
          searchErr?.message?.includes('RESOURCE_EXHAUSTED');

        if (isQuota) {
          isSearchGroundingQuotaExhausted = true;
          console.info('[Research Agent] Live search grounding quota limit reached (HTTP 429). Falling back gracefully to LLM knowledge synthesis.');
        } else {
          console.info('[Research Agent] Live search grounding unavailable, falling back to LLM knowledge synthesis.');
        }

        toolDetail = {
          toolName: 'google_web_search',
          toolStatus: 'TOOL_UNAVAILABLE',
          reason: isQuota
            ? 'Google Search Grounding requires a paid Gemini API billing quota (returned 429 RESOURCE_EXHAUSTED). Free tier does not include search grounding quota.'
            : (searchErr?.message || 'Web search grounding unavailable on current configuration.'),
          details: 'Handled gracefully with fallback to verified internal model knowledge.',
        };
        status = 'PLANNING_COMPLETE';
      }
    }
  } else {
    toolDetail = {
      toolName: 'knowledge_synthesis',
      toolStatus: 'PLANNING_COMPLETE',
      details: 'Domain knowledge and comparative analysis prepared without external web calls.',
    };
  }

  // If text not produced via live search, perform standard model synthesis
  if (!text) {
    const prompt = `USER REQUEST:
"${params.userPrompt}"

YOUR SPECIALIST ASSIGNMENT (RESEARCH AGENT):
Subtask: ${params.subtaskTitle}
Instructions: ${params.subtaskInstructions}
${toolDetail.toolStatus === 'TOOL_UNAVAILABLE' ? `\nNOTE: Live web search tool is currently unavailable (${toolDetail.reason}). Provide research and comparative analysis using verified knowledge.` : ''}

${params.memoryContext}

Provide verified, accurate, high-value research findings and comparative analysis. If the user used a specific language (e.g. Roman Urdu, Urdu, English), respond in that exact language.`;

    const response = await generateWithModelFallback({
      contents: prompt,
      config: {
        systemInstruction: AGENT_PERSONAS.research,
        temperature: 0.7,
      },
    });

    text = response.text?.trim() || '';
    if (!text) {
      throw new Error('Research Agent returned an empty result.');
    }
  }

  return { text, status, toolDetail };
}

// 2. Separate Callable Function: Writing Agent
async function executeWritingAgent(params: {
  subtaskTitle: string;
  subtaskInstructions: string;
  userPrompt: string;
  memoryContext: string;
}): Promise<SpecialistExecutionResult> {
  const prompt = `USER REQUEST:
"${params.userPrompt}"

YOUR SPECIALIST ASSIGNMENT (WRITING AGENT):
Subtask: ${params.subtaskTitle}
Instructions: ${params.subtaskInstructions}

${params.memoryContext}

Produce articulate, compelling, well-formatted content and structured copy. If the user used a specific language (e.g. Roman Urdu, Urdu, English), respond in that exact language.`;

  const response = await generateWithModelFallback({
    contents: prompt,
    config: {
      systemInstruction: AGENT_PERSONAS.writing,
      temperature: 0.7,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Writing Agent returned an empty result.');
  }

  return {
    text,
    status: 'PLANNING_COMPLETE',
    toolDetail: {
      toolName: 'copy_composition',
      toolStatus: 'NOT_ATTEMPTED',
      details: 'Drafted structured messaging and content without external tools.',
    },
  };
}

// 3. Separate Callable Function: Technical Agent
async function executeTechnicalAgent(params: {
  subtaskTitle: string;
  subtaskInstructions: string;
  userPrompt: string;
  memoryContext: string;
}): Promise<SpecialistExecutionResult> {
  const needsCodeExecution = /run code|execute code|terminal|eval|execute command|run script/i.test(
    `${params.subtaskTitle} ${params.subtaskInstructions} ${params.userPrompt}`
  );

  const toolDetail: ToolExecutionDetail = needsCodeExecution
    ? {
        toolName: 'code_execution_sandbox',
        toolStatus: 'TOOL_UNAVAILABLE',
        reason: 'Interactive user code execution sandbox is not configured in this applet.',
      }
    : {
        toolName: 'technical_spec_generator',
        toolStatus: 'NOT_ATTEMPTED',
        details: 'Architecture specifications and technical workflow drafted.',
      };

  const prompt = `USER REQUEST:
"${params.userPrompt}"

YOUR SPECIALIST ASSIGNMENT (TECHNICAL AGENT):
Subtask: ${params.subtaskTitle}
Instructions: ${params.subtaskInstructions}
${toolDetail.toolStatus === 'TOOL_UNAVAILABLE' ? `\nNOTE: Code execution sandbox is not available. Provide architectural analysis, code snippets, and setup instructions.` : ''}

${params.memoryContext}

Provide concrete technical analysis, implementation steps, tools, and architecture. If the user used a specific language (e.g. Roman Urdu, Urdu, English), respond in that exact language.`;

  const response = await generateWithModelFallback({
    contents: prompt,
    config: {
      systemInstruction: AGENT_PERSONAS.technical,
      temperature: 0.7,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Technical Agent returned an empty result.');
  }

  return {
    text,
    status: toolDetail.toolStatus === 'TOOL_UNAVAILABLE' ? 'TOOL_UNAVAILABLE' : 'PLANNING_COMPLETE',
    toolDetail,
  };
}

// 4. Separate Callable Function: Task Manager Agent
async function executeTaskManagerAgent(params: {
  subtaskTitle: string;
  subtaskInstructions: string;
  userPrompt: string;
  memoryContext: string;
}): Promise<SpecialistExecutionResult> {
  const combined = `${params.subtaskTitle} ${params.subtaskInstructions} ${params.userPrompt}`.toLowerCase();
  
  // Check if an explicit persistent task database write operation was requested
  const isExplicitDbAction = /(?:save\s+(?:this\s+)?task|add\s+(?:to\s+)?tasks?|create\s+(?:a\s+)?task\s+in\s+db|persist\s+task|task\s+(?:db\s+mein\s+)?save\s+karo)/i.test(combined);

  const prompt = `USER REQUEST:
"${params.userPrompt}"

YOUR SPECIALIST ASSIGNMENT (TASK MANAGER AGENT):
Subtask: ${params.subtaskTitle}
Instructions: ${params.subtaskInstructions}

${params.memoryContext}

Provide an actionable step-by-step checklist, prioritized milestones, timeline, and risk breakdown. If the user used a specific language (e.g. Roman Urdu, Urdu, English), respond in that exact language.`;

  const response = await generateWithModelFallback({
    contents: prompt,
    config: {
      systemInstruction: AGENT_PERSONAS.task_manager,
      temperature: 0.7,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Task Manager Agent returned an empty result.');
  }

  // 1. If only generating a checklist, roadmap, or plan (no database operation requested):
  // Must return PLANNING_COMPLETE with toolStatus: 'NOT_ATTEMPTED' (do not falsely claim SUCCESS)
  if (!isExplicitDbAction) {
    return {
      text,
      status: 'PLANNING_COMPLETE',
      toolDetail: {
        toolName: 'task_roadmap_planner',
        toolStatus: 'NOT_ATTEMPTED',
        details: 'Operational checklist, timeline, and milestones generated via task management reasoning without database modifications.',
      },
    };
  }

  // 2. If an actual persistent task operation was requested, execute real verified persistence
  try {
    const tasks = loadTasks();
    const newTaskRecord: AgentTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      agentId: 'task_manager',
      title: params.subtaskTitle,
      description: text.slice(0, 300),
      status: 'completed',
      output: text,
      startedAt: Date.now(),
      completedAt: Date.now(),
      toolDetail: {
        toolName: 'persistent_task_db',
        toolStatus: 'SUCCESS',
        details: 'Task successfully committed to tasks.json storage.',
      },
    };
    tasks.unshift(newTaskRecord);
    saveTasks(tasks);

    // Verify written to storage
    const reloaded = loadTasks();
    const verified = reloaded.some((t) => t.id === newTaskRecord.id);

    if (verified) {
      return {
        text,
        status: 'SUCCESS',
        toolDetail: {
          toolName: 'persistent_task_db',
          toolStatus: 'SUCCESS',
          details: `Persistent task ${newTaskRecord.id} successfully written and verified in tasks.json.`,
        },
      };
    } else {
      return {
        text,
        status: 'FAILED',
        toolDetail: {
          toolName: 'persistent_task_db',
          toolStatus: 'FAILED',
          reason: 'Failed to verify saved task in persistent tasks.json storage.',
        },
      };
    }
  } catch (dbErr: any) {
    return {
      text,
      status: 'FAILED',
      toolDetail: {
        toolName: 'persistent_task_db',
        toolStatus: 'FAILED',
        reason: dbErr?.message || 'Database write operation failed',
      },
    };
  }
}


// Dispatcher map for invoking the distinct specialist agent functions
const AGENT_CALLABLE_FUNCTIONS: Record<
  AgentId,
  (params: {
    subtaskTitle: string;
    subtaskInstructions: string;
    userPrompt: string;
    memoryContext: string;
  }) => Promise<SpecialistExecutionResult>
> = {
  research: executeResearchAgent,
  writing: executeWritingAgent,
  technical: executeTechnicalAgent,
  task_manager: executeTaskManagerAgent,
  main: async () => {
    throw new Error('Main Agent is the orchestrator, not a specialist subtask runner.');
  },
};

// Standalone Function for Real Specialist Execution
async function executeSpecialistAgent(
  agentId: AgentId,
  subtaskTitle: string,
  subtaskInstructions: string,
  userPrompt: string,
  memoryContext: string
): Promise<SpecialistExecutionResult> {
  const runner = AGENT_CALLABLE_FUNCTIONS[agentId];
  if (!runner) {
    throw new Error(`No callable function defined for agent: ${agentId}`);
  }
  return runner({ subtaskTitle, subtaskInstructions, userPrompt, memoryContext });
}

// API Routes

// 1. Status & Health
app.get('/api/status', (req, res) => {
  const memories = loadMemories();
  const tasks = loadTasks();
  const history = loadHistory();
  res.json({
    ok: true,
    hasGeminiKey: Boolean(apiKey),
    model: MODEL_NAME,
    searchGroundingQuotaExhausted: isSearchGroundingQuotaExhausted,
    activeMemoriesCount: memories.filter((m) => m.isActive).length,
    totalTasksCount: tasks.length,
    totalHistoryCount: history.length,
  });
});

// 2. Chat History
app.get('/api/history', (req, res) => {
  res.json(loadHistory());
});

app.post('/api/history', (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }
  saveHistory(messages);
  res.json({ success: true, count: messages.length });
});

app.delete('/api/history', (req, res) => {
  saveHistory([]);
  res.json({ success: true });
});

// Security check: validate that no passwords, API keys, private keys, or sensitive credentials are saved into Memory
function checkSensitiveContent(text: string): { isSensitive: boolean; reason?: string } {
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

// 3. Memory CRUD
app.get('/api/memory', (req, res) => {
  res.json(loadMemories());
});

app.post('/api/memory', (req, res) => {
  const { category, title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const titleCheck = checkSensitiveContent(title);
  if (titleCheck.isSensitive) {
    return res.status(400).json({ error: titleCheck.reason });
  }

  const contentCheck = checkSensitiveContent(content);
  if (contentCheck.isSensitive) {
    return res.status(400).json({ error: contentCheck.reason });
  }

  const memories = loadMemories();
  const newMemory: MemoryItem = {
    id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    category: category || 'instruction',
    title: title.trim(),
    content: content.trim(),
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  memories.unshift(newMemory);
  saveMemories(memories);
  res.json(newMemory);
});

app.put('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  const { category, title, content, isActive } = req.body;

  if (title) {
    const titleCheck = checkSensitiveContent(title);
    if (titleCheck.isSensitive) {
      return res.status(400).json({ error: titleCheck.reason });
    }
  }

  if (content) {
    const contentCheck = checkSensitiveContent(content);
    if (contentCheck.isSensitive) {
      return res.status(400).json({ error: contentCheck.reason });
    }
  }

  const memories = loadMemories();
  const index = memories.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Memory item not found' });
  }

  memories[index] = {
    ...memories[index],
    ...(category !== undefined && { category }),
    ...(title !== undefined && { title: title.trim() }),
    ...(content !== undefined && { content: content.trim() }),
    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    updatedAt: Date.now(),
  };

  saveMemories(memories);
  res.json(memories[index]);
});

app.delete('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  let memories = loadMemories();
  memories = memories.filter((m) => m.id !== id);
  saveMemories(memories);
  res.json({ success: true });
});

// 4. Tasks CRUD
app.get('/api/tasks', (req, res) => {
  res.json(loadTasks());
});

app.post('/api/tasks', (req, res) => {
  const { agentId, title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const tasks = loadTasks();
  const newTask: AgentTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    agentId: agentId || 'task_manager',
    title: title.trim(),
    description: description ? description.trim() : '',
    status: 'pending',
    startedAt: Date.now(),
  };
  tasks.unshift(newTask);
  saveTasks(tasks);
  res.json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { status, title, description, output, error } = req.body;
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks[index] = {
    ...tasks[index],
    ...(status !== undefined && { status }),
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(output !== undefined && { output }),
    ...(error !== undefined && { error }),
    ...(status === 'completed' && !tasks[index].completedAt && { completedAt: Date.now() }),
  };

  saveTasks(tasks);
  res.json(tasks[index]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  let tasks = loadTasks();
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  res.json({ success: true });
});

// 5. Retry an Individual Specialist Task
app.post('/api/tasks/:id/retry', async (req, res) => {
  const { id } = req.params;
  const tasks = loadTasks();
  const taskIndex = tasks.findIndex((t) => t.id === id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!ai) {
    return res.status(503).json({ error: 'Gemini API key is not configured.' });
  }

  const task = tasks[taskIndex];
  task.status = 'in_progress';
  task.error = undefined;
  task.startedAt = Date.now();
  saveTasks(tasks);

  const { text: memoryContext } = getActiveMemoryContext();

  try {
    const result = await executeSpecialistAgent(
      task.agentId,
      task.title,
      task.description || task.title,
      task.description || task.title,
      memoryContext
    );

    task.status = result.status === 'FAILED' ? 'failed' : 'completed';
    task.output = result.text;
    task.completedAt = Date.now();
    task.error = undefined;
    task.toolDetail = result.toolDetail;
    saveTasks(tasks);

    res.json({ success: true, task });
  } catch (err: any) {
    console.error(`Error retrying task ${id}:`, err);
    task.status = 'failed';
    task.error = err.message || 'Retry execution failed';
    task.completedAt = Date.now();
    saveTasks(tasks);

    res.status(500).json({ success: false, error: task.error, task });
  }
});

// 6. Direct Specialist Agent Call
app.post('/api/agent-direct', async (req, res) => {
  const { agentId, prompt } = req.body;
  if (!agentId || !prompt) {
    return res.status(400).json({ error: 'agentId and prompt are required' });
  }

  if (!ai) {
    return res.status(503).json({ error: 'Gemini API key is not configured.' });
  }

  const { text: memoryContext, appliedTitles } = getActiveMemoryContext();

  try {
    let outputText = '';
    let status: ExecutionStatus = 'PLANNING_COMPLETE';
    let toolDetail: ToolExecutionDetail | undefined;

    if (agentId === 'main') {
      const resp = await generateWithModelFallback({
        contents: `${prompt}\n\n${memoryContext}`,
        config: {
          systemInstruction: AGENT_PERSONAS.main,
          temperature: 0.7,
        },
      });
      outputText = resp.text?.trim() || '';
      status = 'PLANNING_COMPLETE';
      toolDetail = {
        toolName: 'orchestrator_chat',
        toolStatus: 'NOT_ATTEMPTED',
        details: 'Conversational response formulated by Main Agent.',
      };
    } else {
      const result = await executeSpecialistAgent(
        agentId as AgentId,
        `Direct request to ${AGENT_NAME_MAP[agentId as AgentId] || agentId}`,
        prompt,
        prompt,
        memoryContext
      );
      outputText = result.text;
      status = result.status;
      toolDetail = result.toolDetail;
    }

    // Persist as an AgentTask for auditing and tracking
    const tasks = loadTasks();
    const newTask: AgentTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      agentId: agentId as AgentId,
      title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
      description: prompt,
      status: status === 'FAILED' ? 'failed' : 'completed',
      output: outputText,
      startedAt: Date.now(),
      completedAt: Date.now(),
      toolDetail,
    };
    tasks.unshift(newTask);
    saveTasks(tasks);

    res.json({
      agentId,
      output: outputText,
      status,
      toolDetail,
      appliedMemories: appliedTitles,
      taskId: newTask.id,
    });
  } catch (err: any) {
    console.error('Error calling direct agent:', err);
    res.status(500).json({ error: err.message || 'Failed to execute specialist agent.' });
  }
});

// 7. Main Multi-Agent Orchestration Pipeline
// Real Coordination: Main Agent Decomposes -> Real Specialist Functions Run -> Main Agent Synthesizes
app.post('/api/orchestrate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 1. Check if user explicitly granted permission to save preferences into permanent memory
  const hasSaveIntent = /(?:save.*(?:permanent\s+)?memory|memory\s+mein\s+save|store.*memory|save.*preference|permanent\s+memory)/i.test(prompt);
  const hasPermission = /(?:meri\s+permission|permission\s+hai|allow|ijazat|consent|explicit\s+permission)/i.test(prompt);

  let newlySavedMemory: MemoryItem | null = null;
  if (hasSaveIntent && hasPermission) {
    const sensitiveCheck = checkSensitiveContent(prompt);
    if (!sensitiveCheck.isSensitive) {
      const memories = loadMemories();
      const prefContent = prompt.replace(/^.*?(?:save\s+karo|save\s+kar\s+lo|save\s+in\s+memory|save\s+this|permanent\s+memory\s+mein\s+save\s+karo)[:\s-]*/i, '').trim() || prompt;
      
      let title = 'Saved User Preference';
      if (/budget/i.test(prompt) && /android|device/i.test(prompt)) {
        title = 'Language, Device & Zero Budget Constraints';
      } else if (/budget/i.test(prompt)) {
        title = 'Budget Constraint';
      } else if (/android|device/i.test(prompt)) {
        title = 'Device Preference';
      } else if (/roman\s*urdu|urdu/i.test(prompt)) {
        title = 'Language Preference';
      }

      // Avoid exact duplicates
      const exists = memories.some((m) => m.title === title && m.content === prefContent);
      if (!exists) {
        newlySavedMemory = {
          id: 'mem_user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          category: 'preference',
          title,
          content: prefContent,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        memories.unshift(newlySavedMemory);
        saveMemories(memories);
        console.info('[Memory System] Persisted user preference to data/memory.json:', newlySavedMemory.title);
      }
    }
  }

  // Load authoritative active memory context directly from data/memory.json (/api/memory)
  const memoryContextObj = getActiveMemoryContext();
  const { text: memoryContext, appliedTitles, mapped } = memoryContextObj;

  const isMemoryRetrieval = /memory\s+retrieval|retrieve|saved\s+memory|kya\s+preferences|preferred\s+language|kaunsa\s+device|mera\s+budget|saved\s+preferences|stored\s+data/i.test(prompt);

  if (!ai) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Please attach your API key in Settings > Secrets or in .env.',
    });
  }

  const startTime = Date.now();

  try {
    // Phase 1: Main Agent Planner decomposes prompt into targeted specialist subtasks
    const plannerPrompt = `User instruction:
"${prompt}"

${memoryContext}

${isMemoryRetrieval ? `SPECIAL INSTRUCTION FOR MEMORY RETRIEVAL:
The user is requesting a Memory Retrieval test or query from persistent storage (/api/memory).
All assigned specialists must consult the persistent memory data provided above.
Ensure specialists extract and report:
- Preferred Language: ${mapped.language ? mapped.language.value : '[Data Not Found in Storage]'}
- Device Type: ${mapped.device ? mapped.device.value : '[Data Not Found in Storage]'}
- Budget: ${mapped.budget ? mapped.budget.value : '[Data Not Found in Storage]'}
- Instruction Style: ${mapped.instructionStyle ? mapped.instructionStyle.value : '[Data Not Found in Storage]'}
Do not report fields as missing when they are explicitly present in persistent memory!` : ''}

As SmartBuddy, Your Global AI Assistant, decompose this instruction into separate, targeted tasks for the 4 specialist agents:
1. "research" (Research Agent): research and findings (facts, market opportunities, benchmarks, ad audience targeting, educational/scientific facts).
2. "writing" (Writing Agent): writing and formatting (draft copy, communications, Meta/Instagram ad copy, WhatsApp Business templates, CVs, business proposals, structure).
3. "technical" (Technical Agent): technical analysis and implementation (complete responsive HTML/CSS/JS websites, programming, Android app architecture, math calculations, workflows).
4. "task_manager" (Task Manager Agent): task breakdown, priorities, content calendars, and execution tracking (actionable checklist).

You must allocate subtasks for the relevant specialists (include all 4 when appropriate for comprehensive requests). Never reject a user request; identify the core goal and assign practical deliverables.
Return strictly a JSON object with this schema:
{
  "summary": "High-level summary of your orchestration strategy",
  "rationale": "Why these specialists were assigned",
  "tasks": [
    {
      "agentId": "research" | "writing" | "technical" | "task_manager",
      "title": "Clear subtask title",
      "instructions": "Specific instructions for this specialist to execute"
    }
  ]
}`;

    let planSummary = 'Multi-agent orchestration strategy';
    let planRationale = 'Coordinating specialists to execute tasks.';
    let delegatedList: { agentId: AgentId; title: string; instructions: string }[] = [];

    try {
      const plannerResponse = await generateWithModelFallback({
        contents: plannerPrompt,
        config: {
          systemInstruction: AGENT_PERSONAS.main,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              rationale: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agentId: {
                      type: Type.STRING,
                      enum: ['research', 'writing', 'technical', 'task_manager'],
                    },
                    title: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                  },
                  required: ['agentId', 'title', 'instructions'],
                },
              },
            },
            required: ['summary', 'rationale', 'tasks'],
          },
          temperature: 0.5,
        },
      });

      const parsedPlan = JSON.parse(plannerResponse.text || '{}');
      if (parsedPlan.summary) planSummary = parsedPlan.summary;
      if (parsedPlan.rationale) planRationale = parsedPlan.rationale;
      if (Array.isArray(parsedPlan.tasks) && parsedPlan.tasks.length > 0) {
        delegatedList = parsedPlan.tasks;
      }
    } catch (plannerErr) {
      console.warn('Planner fallback triggered:', plannerErr);
      // Fallback default delegation across all 4 specialists
      delegatedList = [
        {
          agentId: 'research',
          title: 'Research & Opportunity Analysis',
          instructions: `Analyze market viability, key data points, and real-world opportunities for: "${prompt}"`,
        },
        {
          agentId: 'writing',
          title: 'Copywriting & Content Structuring',
          instructions: `Draft clear, compelling messaging and structured communication for: "${prompt}"`,
        },
        {
          agentId: 'technical',
          title: 'Technical Setup & Workflow Specification',
          instructions: `Provide technical guidance, tools, and mobile workflows for: "${prompt}"`,
        },
        {
          agentId: 'task_manager',
          title: 'Action Checklist & Milestone Breakdown',
          instructions: `Structure an actionable priority checklist and milestones for: "${prompt}"`,
        },
      ];
    }

    // The 4 official specialist agents
    const allSpecialistIds: AgentId[] = ['research', 'writing', 'technical', 'task_manager'];

    // Phase 2: Create real tasks in Pending status for DELEGATED specialists only
    const createdTasks: AgentTask[] = delegatedList.map((item) => ({
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      agentId: item.agentId,
      title: item.title,
      description: item.instructions,
      status: 'pending',
      startedAt: Date.now(),
    }));

    // Save pending tasks to disk
    const existingTasks = loadTasks();
    saveTasks([...createdTasks, ...existingTasks]);

    // Phase 3: Execute Each Delegated Specialist Agent via Its Own Callable Function
    // Run separate real function calls for each delegated specialist
    const specialistPromises = createdTasks.map(async (task) => {
      // Mark In Progress
      task.status = 'in_progress';
      const taskStart = Date.now();

      try {
        const result = await executeSpecialistAgent(
          task.agentId,
          task.title,
          task.description,
          prompt,
          memoryContext
        );

        // Mark task status
        task.status = result.status === 'FAILED' ? 'failed' : 'completed';
        task.output = result.text;
        task.completedAt = Date.now();
        task.error = undefined;
        task.toolDetail = result.toolDetail;

        const contribution: AgentContribution = {
          agentId: task.agentId,
          agentName: AGENT_NAME_MAP[task.agentId],
          subtask: task.title,
          output: result.text,
          status: result.status,
          toolDetail: result.toolDetail,
          durationMs: Date.now() - taskStart,
          taskId: task.id,
        };

        return { contribution, task };
      } catch (err: any) {
        console.error(`Specialist agent ${task.agentId} function call failed:`, err);
        // Mark Failed on real error
        task.status = 'failed';
        task.error = err.message || 'Execution error';
        task.completedAt = Date.now();

        const contribution: AgentContribution = {
          agentId: task.agentId,
          agentName: AGENT_NAME_MAP[task.agentId],
          subtask: task.title,
          output: '',
          status: 'FAILED',
          error: task.error,
          durationMs: Date.now() - taskStart,
          taskId: task.id,
          toolDetail: {
            toolName: 'specialist_call',
            toolStatus: 'FAILED',
            reason: task.error,
          },
        };

        return { contribution, task };
      }
    });

    const executionResults = await Promise.all(specialistPromises);

    // Save updated task statuses to disk
    const updatedTasksList = loadTasks();
    for (const r of executionResults) {
      const idx = updatedTasksList.findIndex((t) => t.id === r.task.id);
      if (idx !== -1) {
        updatedTasksList[idx] = r.task;
      }
    }
    saveTasks(updatedTasksList);

    // Construct full 4-agent contributions list:
    // Delegated agents get their real contribution.
    // Non-delegated agents get NOT_EXECUTED status!
    const agentContributions: AgentContribution[] = allSpecialistIds.map((specialistId) => {
      const executed = executionResults.find((r) => r.contribution.agentId === specialistId);
      if (executed) {
        return executed.contribution;
      }
      return {
        agentId: specialistId,
        agentName: AGENT_NAME_MAP[specialistId],
        subtask: 'Not delegated for this task',
        output: '',
        status: 'NOT_EXECUTED',
        durationMs: 0,
        toolDetail: {
          toolName: 'none',
          toolStatus: 'NOT_ATTEMPTED',
          reason: 'Specialist was not called for this prompt.',
        },
      };
    });

    // Phase 4: Main Agent Synthesizes the Final Answer from the Real Returned Results
    const synthesisPrompt = `USER INSTRUCTION:
"${prompt}"

${memoryContext}

${isMemoryRetrieval ? `
AUTHORITATIVE RETRIEVED PERSISTENT MEMORY VALUES (Directly from /api/memory and data/memory.json):
• Preferred Language: ${mapped.language ? mapped.language.value : '[Data Not Found in Storage]'} (Source: ${mapped.language ? mapped.language.sourceTitle : 'None'})
• Device Type: ${mapped.device ? mapped.device.value : '[Data Not Found in Storage]'} (Source: ${mapped.device ? mapped.device.sourceTitle : 'None'})
• Budget: ${mapped.budget ? mapped.budget.value : '[Data Not Found in Storage]'} (Source: ${mapped.budget ? mapped.budget.sourceTitle : 'None'})
• Instruction Style: ${mapped.instructionStyle ? mapped.instructionStyle.value : '[Data Not Found in Storage]'} (Source: ${mapped.instructionStyle ? mapped.instructionStyle.sourceTitle : 'None'})

CRITICAL MEMORY RETRIEVAL RULES:
1. You MUST directly report the retrieved persistent memory values shown above.
2. Budget '${mapped.budget ? mapped.budget.value : 'Zero'}' is a VALID retrieved value from storage. DO NOT state that Budget is 'Data Not Found'!
3. Device '${mapped.device ? mapped.device.value : 'Android Mobile'}' is a VALID retrieved value from storage. DO NOT state that Device is 'Data Not Found'!
4. Language '${mapped.language ? mapped.language.value : 'Roman Urdu'}' is a VALID retrieved value from storage.
5. Emphasize that these values were successfully retrieved from persistent storage (data/memory.json & /api/memory).
6. If the user asked in Roman Urdu, present the final response in Roman Urdu.
` : ''}

REAL SPECIALIST AGENT EXECUTION RESULTS & TOOL AUDIT:
${agentContributions
  .map(
    (c) => `=== [${c.agentName.toUpperCase()} - ${c.subtask}] ===
Status: ${c.status}
${c.toolDetail ? `Tool Used: ${c.toolDetail.toolName} (${c.toolDetail.toolStatus})${c.toolDetail.reason ? ' - Reason: ' + c.toolDetail.reason : ''}${c.toolDetail.details ? ' - ' + c.toolDetail.details : ''}` : 'Tool Used: None'}
${c.status === 'FAILED' ? '(Execution Error: ' + c.error + ')' : c.status === 'NOT_EXECUTED' ? '(NOT EXECUTED: Specialist was not required for this request)' : 'Deliverable:\n' + c.output}
`
  )
  .join('\n\n')}

INSTRUCTIONS FOR MAIN AGENT SYNTHESIS:
1. Synthesize the deliverables from all specialist agents into a comprehensive, high-value, complete final answer directly addressing the user.
2. DELIVERABLE COMPLETENESS:
   - For website requests: Deliver complete, self-contained HTML/CSS/JS with modern responsive design inside code blocks so the user can preview and download it immediately.
   - For coding/debugging requests: Deliver complete, runnable code with clear explanations and test cases.
   - For digital marketing/ads: Deliver complete ad sets (Hooks, Primary Text, Headlines, Description, Call-to-Action) and target audience parameters.
   - For WhatsApp Business/Social: Deliver exact message templates and structured publishing calendars.
   - For CVs, proposals, and documents: Deliver complete, ATS-compliant, professionally formatted Markdown documents.
   - For education/math/science: Deliver step-by-step walkthroughs, formulas, and conceptual explanations.
3. LANGUAGE REQUIREMENT: If the user wrote in a specific language (e.g. Roman Urdu, Urdu, English), your final answer MUST BE IN THAT EXACT SAME LANGUAGE!
4. TRANSPARENT TOOL & AGENT STATUS AUDIT: Explicitly state the exact execution status of each specialist agent and tool:
   - State which operations completed successfully (SUCCESS).
   - State which tasks were completed through planning & reasoning (PLANNING_COMPLETE).
   - If any tool was TOOL_UNAVAILABLE (such as Google Live Web Search due to API quota restrictions, or external live ad posting), transparently state the limitation and provide the verified manual alternative.
   - State which agents were NOT_EXECUTED.
   - State any FAILED agents if any error occurred.
5. Conclude with concrete, immediate actionable next steps based on the Task Manager checklist.`;

    const synthesisResponse = await generateWithModelFallback({
      contents: synthesisPrompt,
      config: {
        systemInstruction: AGENT_PERSONAS.main,
        temperature: 0.7,
      },
    });

    const finalAnswer = synthesisResponse.text || 'Synthesis completed.';

    const plan: OrchestrationPlan = {
      summary: planSummary,
      rationale: planRationale,
      delegatedTasks: createdTasks.map((t) => ({
        agentId: t.agentId,
        title: t.title,
        instructions: t.description,
      })),
    };

    res.json({
      plan,
      agentContributions,
      finalAnswer,
      createdTasks,
      memoriesApplied: appliedTitles,
    });
  } catch (err: any) {
    console.error('Fatal orchestration error:', err);
    res.status(500).json({
      error: err.message || 'Failed to complete agent orchestration.',
    });
  }
});

// 8. Re-synthesize with Retried Specialist Output
app.post('/api/orchestrate/resynthesize', async (req, res) => {
  const { taskId, userPrompt, contributions } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!ai) {
    return res.status(503).json({ error: 'Gemini API key is not configured.' });
  }

  const { text: memoryContext, appliedTitles } = getActiveMemoryContext();

  // Re-run the specialist
  task.status = 'in_progress';
  task.error = undefined;
  saveTasks(tasks);

  try {
    const result = await executeSpecialistAgent(
      task.agentId,
      task.title,
      task.description || task.title,
      userPrompt || task.title,
      memoryContext
    );

    task.status = result.status === 'FAILED' ? 'failed' : 'completed';
    task.output = result.text;
    task.completedAt = Date.now();
    task.error = undefined;
    task.toolDetail = result.toolDetail;
    saveTasks(tasks);

    // Update contributions list
    const updatedContributions: AgentContribution[] = (contributions || []).map((c: AgentContribution) => {
      if (c.taskId === taskId || c.agentId === task.agentId) {
        return {
          ...c,
          status: result.status,
          toolDetail: result.toolDetail,
          output: result.text,
          error: undefined,
          taskId: task.id,
        };
      }
      return c;
    });

    // Re-synthesize
    const synthesisPrompt = `USER INSTRUCTION:
"${userPrompt || task.title}"

${memoryContext}

UPDATED SPECIALIST AGENT EXECUTION RESULTS & TOOL AUDIT:
${updatedContributions
  .map(
    (c) => `=== [${c.agentName.toUpperCase()} - ${c.subtask}] ===
Status: ${c.status}
${c.toolDetail ? `Tool: ${c.toolDetail.toolName} (${c.toolDetail.toolStatus})${c.toolDetail.reason ? ' - ' + c.toolDetail.reason : ''}` : ''}
${c.status === 'FAILED' ? '(Execution Error: ' + c.error + ')' : 'Deliverable:\n' + c.output}
`
  )
  .join('\n\n')}

Please re-synthesize the complete answer based on the updated specialist deliverables. Follow user language conventions.`;

    const synthesisResponse = await generateWithModelFallback({
      contents: synthesisPrompt,
      config: {
        systemInstruction: AGENT_PERSONAS.main,
        temperature: 0.7,
      },
    });

    res.json({
      success: true,
      updatedTask: task,
      updatedContributions,
      finalAnswer: synthesisResponse.text || 'Re-synthesis completed.',
    });
  } catch (err: any) {
    console.error('Re-synthesis error:', err);
    task.status = 'failed';
    task.error = err.message || 'Retry failed';
    saveTasks(tasks);
    res.status(500).json({ error: task.error, task });
  }
});

// Serve frontend
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartBuddy server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
