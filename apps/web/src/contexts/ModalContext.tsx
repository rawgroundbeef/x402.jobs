"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

// Resource type for the resource modal
export interface ModalResource {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  server_id?: string;
  server_name?: string;
  server_slug?: string;
  output_schema?: {
    input?: {
      type?: string;
      method?: string;
      bodyType?: string;
      bodyFields?: Record<string, unknown>;
      queryParams?: Record<string, unknown>;
    };
    output?: Record<string, unknown>;
  };
  extra?: Record<string, unknown>;
  // Prompt template parameters
  pt_parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
}

// Search options for canvas context
export interface SearchOptions {
  onAddResource?: (resource: ModalResource) => void;
  filterNetwork?: string;
}

interface ModalContextValue {
  // Search Modal
  isSearchOpen: boolean;
  searchOptions: SearchOptions | null;
  openSearch: (options?: SearchOptions) => void;
  closeSearch: () => void;

  // Create Job Modal
  isCreateJobOpen: boolean;
  openCreateJob: () => void;
  closeCreateJob: () => void;

  // Jobputer Chat Modal
  isJobputerChatOpen: boolean;
  openJobputerChat: () => void;
  closeJobputerChat: () => void;

  // Resource Modal (try/interact)
  resourceModalResource: ModalResource | null;
  openResourceModal: (resource: ModalResource) => void;
  closeResourceModal: () => void;

  // Register Resource Modal
  isRegisterResourceOpen: boolean;
  registerResourceOnSuccess: (() => void) | null;
  openRegisterResource: (onSuccess?: () => void) => void;
  closeRegisterResource: () => void;

  // My Jobs Modal
  isMyJobsOpen: boolean;
  openMyJobs: () => void;
  closeMyJobs: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchOptions | null>(
    null,
  );
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isJobputerChatOpen, setIsJobputerChatOpen] = useState(false);
  const [resourceModalResource, setResourceModalResource] =
    useState<ModalResource | null>(null);
  const [isRegisterResourceOpen, setIsRegisterResourceOpen] = useState(false);
  const [registerResourceOnSuccess, setRegisterResourceOnSuccess] = useState<
    (() => void) | null
  >(null);
  const [isMyJobsOpen, setIsMyJobsOpen] = useState(false);

  const openSearch = useCallback((options?: SearchOptions) => {
    setSearchOptions(options || null);
    setIsSearchOpen(true);
  }, []);
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchOptions(null);
  }, []);

  const openCreateJob = useCallback(() => setIsCreateJobOpen(true), []);
  const closeCreateJob = useCallback(() => setIsCreateJobOpen(false), []);

  const openJobputerChat = useCallback(() => setIsJobputerChatOpen(true), []);
  const closeJobputerChat = useCallback(() => setIsJobputerChatOpen(false), []);

  const openResourceModal = useCallback(
    (resource: ModalResource) => setResourceModalResource(resource),
    [],
  );
  const closeResourceModal = useCallback(
    () => setResourceModalResource(null),
    [],
  );

  const openRegisterResource = useCallback((onSuccess?: () => void) => {
    setRegisterResourceOnSuccess(() => onSuccess || null);
    setIsRegisterResourceOpen(true);
  }, []);
  const closeRegisterResource = useCallback(() => {
    setIsRegisterResourceOpen(false);
    setRegisterResourceOnSuccess(null);
  }, []);

  const openMyJobs = useCallback(() => setIsMyJobsOpen(true), []);
  const closeMyJobs = useCallback(() => setIsMyJobsOpen(false), []);

  return (
    <ModalContext.Provider
      value={{
        isSearchOpen,
        searchOptions,
        openSearch,
        closeSearch,
        isCreateJobOpen,
        openCreateJob,
        closeCreateJob,
        isJobputerChatOpen,
        openJobputerChat,
        closeJobputerChat,
        resourceModalResource,
        openResourceModal,
        closeResourceModal,
        isRegisterResourceOpen,
        registerResourceOnSuccess,
        openRegisterResource,
        closeRegisterResource,
        isMyJobsOpen,
        openMyJobs,
        closeMyJobs,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModals must be used within a ModalProvider");
  }
  return context;
}
