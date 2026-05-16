/**
 * Event record from database
 */
export interface EventRecord {
  id: string;
  sequence?: number;
  status?: string;
}

/**
 * Data for marking an event as completed
 */
export interface EventCompletedData {
  output: unknown;
  outputText: string;
  paymentSignature: string;
  amountPaid: number;
  resolvedInputs?: unknown;
}

/**
 * Step Execution Repository Interface
 *
 * Handles all database operations for workflow step execution.
 */
export interface IStepExecutionRepository {
  /**
   * Get run status
   */
  getRunStatus(runId: string): Promise<string | null>;

  /**
   * Get event record by run_id and sequence number
   */
  getEventRecordBySequence(
    runId: string,
    sequence: number,
  ): Promise<EventRecord | null>;

  /**
   * Get all event records for a run (for debugging)
   */
  getAllEventRecords(runId: string): Promise<EventRecord[]>;

  /**
   * Mark event as running
   */
  markEventRunning(eventId: string): Promise<void>;

  /**
   * Mark event as completed with output data
   */
  markEventCompleted(eventId: string, data: EventCompletedData): Promise<void>;

  /**
   * Mark event as failed with error message
   */
  markEventFailed(
    eventId: string,
    error: string,
    resolvedInputs?: unknown,
  ): Promise<void>;
}
