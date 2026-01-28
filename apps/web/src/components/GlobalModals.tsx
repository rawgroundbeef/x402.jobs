"use client";

import { useModals } from "@/contexts/ModalContext";
import { AskJobputerModal } from "@/components/modals/AskJobputerModal";
import { CreateJobModal } from "@/components/modals/CreateJobModal";
import { SearchModal } from "@/components/modals/SearchModal";
import { ResourceInteractionModal } from "@/components/modals/ResourceInteractionModal";
import { CreateResourceModal } from "@/components/modals/CreateResourceModal";
import { JobsSidebar } from "@/components/sidebars/JobsSidebar";
import { useWallet } from "@/hooks/useWallet";
import { getNetworkBalance } from "@/lib/networks";

/**
 * Global modals and sidebars that are rendered at the app level.
 * These can be opened from anywhere using useModals().
 *
 * Note: JobCanvas renders its own sidebars with canvas-specific handlers.
 * These global sidebars are for use outside of the canvas context.
 */
export function GlobalModals() {
  const {
    isSearchOpen,
    searchOptions,
    closeSearch,
    isCreateJobOpen,
    closeCreateJob,
    isJobputerChatOpen,
    closeJobputerChat,
    resourceModalResource,
    closeResourceModal,
    isRegisterResourceOpen,
    registerResourceOnSuccess,
    closeRegisterResource,
    isMyJobsOpen,
    closeMyJobs,
  } = useModals();

  // Use shared wallet hook
  const { wallet } = useWallet();
  const solanaBalance = getNetworkBalance(wallet, "solana");

  return (
    <>
      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onAddResource={searchOptions?.onAddResource}
        filterNetwork={searchOptions?.filterNetwork}
      />

      {/* Create Job Modal */}
      <CreateJobModal isOpen={isCreateJobOpen} onClose={closeCreateJob} />

      {/* Jobputer Chat Modal */}
      <AskJobputerModal
        isOpen={isJobputerChatOpen}
        onClose={closeJobputerChat}
        walletBalance={solanaBalance}
      />

      {/* Resource Interaction Modal */}
      {}
      <ResourceInteractionModal
        isOpen={!!resourceModalResource}
        onClose={closeResourceModal}
        resource={resourceModalResource as any}
      />

      {/* Create Resource Modal */}
      <CreateResourceModal
        isOpen={isRegisterResourceOpen}
        onClose={closeRegisterResource}
        onSuccess={registerResourceOnSuccess || undefined}
      />

      {/* Jobs Sidebar - for browsing outside of canvas */}
      <JobsSidebar isOpen={isMyJobsOpen} onClose={closeMyJobs} />
    </>
  );
}
