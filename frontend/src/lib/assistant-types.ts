export type AssistantExecutionMode = 'local-vlm' | 'demo-fallback';

export type AssistantTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'awaiting_approval'
  | 'rejected'
  | 'failed';

export interface AssistantFileSummary {
  name: string;
  size: number;
  type: string;
  readableText: boolean;
}

export interface AssistantAgentTask {
  id: string;
  agentId: string;
  agentName: string;
  domain: string;
  objective: string;
  reason: string;
  status: AssistantTaskStatus;
  approvalRequired: boolean;
  coreDependencies: string[];
  modelId?: string;
}

export interface AssistantEvidence {
  id: string;
  source: string;
  label: string;
  excerpt: string;
  confidence: number;
}

export interface AssistantResponse {
  requestId: string;
  mode: AssistantExecutionMode;
  answer: string;
  tasks: AssistantAgentTask[];
  files: AssistantFileSummary[];
  evidence: AssistantEvidence[];
  warnings: string[];
  completedAt: string;
}

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}
