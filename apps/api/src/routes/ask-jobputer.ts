import { Router, Request, Response } from "express";
import { executeX402Request } from "../inngest/utils/execute-x402";
import { loadDecryptedUserWallet } from "../lib/wallet-keys";

export const askJobputerRouter: Router = Router();

// Jobputer chat endpoint (root level = chat with the agent)
const JOBPUTER_URL =
  process.env.JOBPUTER_URL ||
  "https://agents.memeputer.com/x402/solana/jobputer";

// POST /api/ask-jobputer - Ask Jobputer for help (costs $0.01)
askJobputerRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing question" });
    }

    // Get user's wallet — decrypted.
    const wallet = await loadDecryptedUserWallet(userId);
    if (!wallet) {
      return res
        .status(400)
        .json({ error: "No wallet found. Please set up your wallet first." });
    }

    console.log(`🤖 Asking Jobputer: "${question.substring(0, 50)}..."`);

    // Call Jobputer via x402 (root path = chat)
    const result = await executeX402Request({
      resourceUrl: JOBPUTER_URL,
      walletSecretKey: wallet.solanaSecretBase64,
      body: { message: question },
    });

    if (!result.success) {
      console.error(`❌ Jobputer error: ${result.error}`);
      return res
        .status(500)
        .json({ error: result.error || "Failed to get response" });
    }

    console.log(`✅ Jobputer responded! Cost: $${result.amountPaid || 0.01}`);

    // Extract the response text
    let response = result.responseText || "";

    // Try to parse if it's JSON
    if (result.response) {
      if (typeof result.response === "string") {
        response = result.response;
      } else if (typeof result.response === "object") {
        // Check common response patterns
        const respObj = result.response as Record<string, unknown>;
        response =
          (respObj.response as string) ||
          (respObj.answer as string) ||
          (respObj.message as string) ||
          (respObj.text as string) ||
          JSON.stringify(respObj);
      }
    }

    res.json({
      response,
      cost: result.amountPaid || 0.01,
      txSignature: result.paymentSignature || null,
    });
  } catch (error) {
    console.error("Ask Jobputer error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});
