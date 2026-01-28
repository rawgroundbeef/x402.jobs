/**
 * Conversational Workflow Builder Types
 */

import type { NetworkType } from "@/hooks/useWorkflowPersistence";

// Resource from search
export interface ResourceMatch {
  id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  serverSlug?: string;
  serverName?: string;
  network: string;
  outputSchema?: Record<string, unknown>;
  selected?: boolean;
}

// Workflow step after resource selection
export interface WorkflowStep {
  order: number;
  resourceId: string;
  resourceName: string;
  resourceSlug?: string;
  serverSlug?: string;
  price: number;
  inputs: string[];
  outputs: string[];
}

// Connection between steps
export interface StepConnection {
  fromStep: number;
  toStep: number;
  fromField: string;
  toField: string;
}

// Job parameter that can be exposed
export interface JobParameter {
  name: string;
  type: "string" | "number" | "boolean" | "date";
  defaultValue: string;
  description?: string;
  exposed: boolean;
  required: boolean;
}

// Current state of the workflow being built
export interface WorkflowState {
  name: string;
  network: NetworkType;
  resources: ResourceMatch[];
  selectedResourceIds: string[];
  steps: WorkflowStep[];
  connections: StepConnection[];
  parameters: JobParameter[];
  estimatedCost: number;
}

// Message types for the chat
export type MessageRole = "user" | "assistant";

export type MessageActionType =
  | "resource_suggestion"
  | "wiring_proposal"
  | "parameter_selection"
  | "final_summary"
  | "error"
  | "thinking";

// Structured content for AI messages
export interface ResourceSuggestionContent {
  type: "resource_suggestion";
  resources: ResourceMatch[];
  query: string;
}

export interface WiringProposalContent {
  type: "wiring_proposal";
  steps: WorkflowStep[];
  connections: StepConnection[];
  explanation: string;
}

export interface ParameterSelectionContent {
  type: "parameter_selection";
  parameters: JobParameter[];
  explanation: string;
}

export interface FinalSummaryContent {
  type: "final_summary";
  workflow: WorkflowState;
}

export interface ErrorContent {
  type: "error";
  message: string;
  suggestion?: string;
}

export interface ThinkingContent {
  type: "thinking";
  text: string;
}

export type StructuredContent =
  | ResourceSuggestionContent
  | WiringProposalContent
  | ParameterSelectionContent
  | FinalSummaryContent
  | ErrorContent
  | ThinkingContent;

// Chat message
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  structuredContent?: StructuredContent;
  timestamp: Date;
}

// Conversation step in the flow
export type ConversationStep =
  | "initial"
  | "resource_selection"
  | "wiring"
  | "parameters"
  | "review"
  | "complete";

// Full conversation state
export interface ConversationState {
  id: string;
  step: ConversationStep;
  messages: ChatMessage[];
  workflow: WorkflowState;
  isLoading: boolean;
  error: string | null;
}

// Actions for state management
export type ConversationAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "UPDATE_WORKFLOW"; payload: Partial<WorkflowState> }
  | { type: "SET_STEP"; payload: ConversationStep }
  | { type: "SELECT_RESOURCE"; payload: string }
  | { type: "DESELECT_RESOURCE"; payload: string }
  | { type: "TOGGLE_PARAMETER"; payload: string }
  | { type: "RESET" };
