/**
 * x402.storage API client
 * Uploads job outputs to IPFS via x402.storage service
 */

export interface X402StorageResult {
  success: boolean;
  url?: string; // Full URL: https://x402.storage/{cid}
  cid?: string; // IPFS CID (bafybei...)
  filename?: string; // Optional filename for display
  error?: string; // Error message if failed
}

/**
 * Upload content to x402.storage with retry logic
 *
 * @param content - Content to upload (string or object to be serialized)
 * @param filename - Optional filename for display
 * @returns Promise<X402StorageResult> with success status, URL/CID, or error
 */
export async function uploadToStorage(
  _content: string | object,
  _filename?: string,
): Promise<X402StorageResult> {
  // NOTE: x402.storage upload now happens on the backend (in post-to-destinations.ts)
  // This frontend function is kept for potential future use but currently returns
  // a placeholder since the backend handles the upload with proper wallet signing.
  console.log(
    "[x402-storage] Frontend upload disabled - backend handles this now",
  );

  return {
    success: false,
    error: "Upload handled by backend",
  };

  // Original implementation (disabled):
  /*
  // Serialize object content to JSON string if needed
  const contentString =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);

  const payload = {
    content: contentString,
    ...(filename && { filename }),
  };

  // TODO: Payment signature integration needed - requires wallet signing
  // For now, use placeholder header until payment flow is implemented
  const headers = {
    "Content-Type": "application/json",
    "PAYMENT-SIGNATURE": "pending-integration",
  };

  // Retry configuration: 2 attempts max with exponential backoff
  const maxAttempts = 2;
  const delays = [1000, 2000]; // 1s, then 2s

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.x402.storage/store", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `Storage API returned ${response.status}: ${errorText}`
        );
      }

      const result = await response.json();

      // API returns { cid: string, url: string }
      return {
        success: true,
        cid: result.cid,
        url: result.url || `https://x402.storage/${result.cid}`,
        filename,
      };
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1;

      if (isLastAttempt) {
        // Final attempt failed - return error result
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Storage upload failed: Unknown error",
        };
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      console.log(
        `[x402-storage] Retry attempt ${attempt + 2}/${maxAttempts} after error:`,
        error
      );
    }
  }

  // Should not reach here, but TypeScript requires it
  return {
    success: false,
    error: "Storage upload failed after retries",
  };
  */
}
