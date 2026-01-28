"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";
import type {
  ConversationState,
  ConversationAction,
  ChatMessage,
  WorkflowState,
  ConversationStep,
  ResourceMatch,
  JobParameter,
} from "./types";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";

// Initial workflow state
const initialWorkflow: WorkflowState = {
  name: "",
  network: "solana",
  resources: [],
  selectedResourceIds: [],
  steps: [],
  connections: [],
  parameters: [],
  estimatedCost: 0,
};

// Initial conversation state
const initialState: ConversationState = {
  id: "",
  step: "initial",
  messages: [],
  workflow: initialWorkflow,
  isLoading: false,
  error: null,
};

// Reducer
function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };

    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case "UPDATE_WORKFLOW":
      return {
        ...state,
        workflow: { ...state.workflow, ...action.payload },
      };

    case "SET_STEP":
      return { ...state, step: action.payload };

    case "SELECT_RESOURCE":
      return {
        ...state,
        workflow: {
          ...state.workflow,
          selectedResourceIds: [
            ...state.workflow.selectedResourceIds,
            action.payload,
          ],
        },
      };

    case "DESELECT_RESOURCE":
      return {
        ...state,
        workflow: {
          ...state.workflow,
          selectedResourceIds: state.workflow.selectedResourceIds.filter(
            (id) => id !== action.payload,
          ),
        },
      };

    case "TOGGLE_PARAMETER": {
      const paramName = action.payload;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          parameters: state.workflow.parameters.map((p) =>
            p.name === paramName ? { ...p, exposed: !p.exposed } : p,
          ),
        },
      };
    }

    case "RESET":
      return {
        ...initialState,
        id: crypto.randomUUID(),
      };

    default:
      return state;
  }
}

// Context
interface ConversationContextValue {
  state: ConversationState;
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (
    content: string,
    structuredContent?: ChatMessage["structuredContent"],
  ) => void;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  setStep: (step: ConversationStep) => void;
  selectResource: (resourceId: string) => void;
  deselectResource: (resourceId: string) => void;
  toggleResource: (resourceId: string) => void;
  toggleParameter: (paramName: string) => void;
  setNetwork: (network: NetworkType) => void;
  setResources: (resources: ResourceMatch[]) => void;
  setParameters: (parameters: JobParameter[]) => void;
  reset: () => void;
  // Computed
  selectedResources: ResourceMatch[];
  exposedParameters: JobParameter[];
}

const ConversationContext = createContext<ConversationContextValue | null>(
  null,
);

// Provider
export function ConversationProvider({
  children,
  initialPrompt: _initialPrompt,
  initialNetwork = "solana",
}: {
  children: React.ReactNode;
  initialPrompt?: string;
  initialNetwork?: NetworkType;
}) {
  const [state, dispatch] = useReducer(conversationReducer, {
    ...initialState,
    id: crypto.randomUUID(),
    workflow: {
      ...initialWorkflow,
      network: initialNetwork,
    },
  });

  // Actions
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      });
    },
    [],
  );

  const addUserMessage = useCallback(
    (content: string) => {
      addMessage({ role: "user", content });
    },
    [addMessage],
  );

  const addAssistantMessage = useCallback(
    (content: string, structuredContent?: ChatMessage["structuredContent"]) => {
      addMessage({ role: "assistant", content, structuredContent });
    },
    [addMessage],
  );

  const updateWorkflow = useCallback((updates: Partial<WorkflowState>) => {
    dispatch({ type: "UPDATE_WORKFLOW", payload: updates });
  }, []);

  const setStep = useCallback((step: ConversationStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const selectResource = useCallback((resourceId: string) => {
    dispatch({ type: "SELECT_RESOURCE", payload: resourceId });
  }, []);

  const deselectResource = useCallback((resourceId: string) => {
    dispatch({ type: "DESELECT_RESOURCE", payload: resourceId });
  }, []);

  const toggleResource = useCallback(
    (resourceId: string) => {
      if (state.workflow.selectedResourceIds.includes(resourceId)) {
        deselectResource(resourceId);
      } else {
        selectResource(resourceId);
      }
    },
    [state.workflow.selectedResourceIds, selectResource, deselectResource],
  );

  const toggleParameter = useCallback((paramName: string) => {
    dispatch({ type: "TOGGLE_PARAMETER", payload: paramName });
  }, []);

  const setNetwork = useCallback(
    (network: NetworkType) => {
      updateWorkflow({ network });
    },
    [updateWorkflow],
  );

  const setResources = useCallback(
    (resources: ResourceMatch[]) => {
      updateWorkflow({ resources });
    },
    [updateWorkflow],
  );

  const setParameters = useCallback(
    (parameters: JobParameter[]) => {
      updateWorkflow({ parameters });
    },
    [updateWorkflow],
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Computed values
  const selectedResources = state.workflow.resources.filter((r) =>
    state.workflow.selectedResourceIds.includes(r.id),
  );

  const exposedParameters = state.workflow.parameters.filter((p) => p.exposed);

  const value: ConversationContextValue = {
    state,
    setLoading,
    setError,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    updateWorkflow,
    setStep,
    selectResource,
    deselectResource,
    toggleResource,
    toggleParameter,
    setNetwork,
    setResources,
    setParameters,
    reset,
    selectedResources,
    exposedParameters,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

// Hook
export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "useConversation must be used within a ConversationProvider",
    );
  }
  return context;
}
