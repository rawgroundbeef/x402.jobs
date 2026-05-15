import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";
import { inngest } from "../../lib/inngest";
import { getSupabase } from "../../lib/supabase";
import { encryptWalletForStorage } from "../../lib/wallet-keys";

/**
 * Ensure a user has Solana + Base wallets.
 * Idempotent — safe to call multiple times for the same user.
 * Triggered on first authenticated API request when no wallet exists.
 */
export const ensureUserWallet = inngest.createFunction(
  {
    id: "ensure-user-wallet",
    retries: 3,
    concurrency: {
      limit: 1,
      key: "event.data.userId",
    },
  },
  { event: "x402/user.ensure-wallet" },
  async ({ event, step, logger }) => {
    const { userId } = event.data as { userId: string };

    // Step 1: Check if wallet already exists
    const existing = await step.run("check-existing-wallet", async () => {
      const { data } = await getSupabase()
        .from("x402_user_wallets")
        .select("id, address, base_address")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    });

    if (existing?.address && existing?.base_address) {
      logger.info(`Wallet already exists for user ${userId}`);
      return { status: "exists", userId };
    }

    // Step 2: If wallet exists but missing Base address, add it
    if (existing && !existing.base_address) {
      await step.run("add-base-wallet", async () => {
        const baseWallet = Wallet.createRandom();
        const baseAddress = baseWallet.address;
        const encrypted = encryptWalletForStorage(
          new Uint8Array(),
          baseWallet.privateKey,
        );

        const { error } = await getSupabase()
          .from("x402_user_wallets")
          .update({
            base_address: baseAddress,
            base_private_key_ciphertext: encrypted.baseCiphertext,
          })
          .eq("user_id", userId);

        if (error) throw new Error(`Failed to add Base wallet: ${error.message}`);
        logger.info(`Added Base wallet for user ${userId}: ${baseAddress.substring(0, 10)}...`);
      });

      return { status: "updated", userId };
    }

    // Step 3: Create both wallets from scratch
    await step.run("create-wallets", async () => {
      // Generate Solana wallet
      const solKeypair = Keypair.generate();
      const solAddress = solKeypair.publicKey.toString();

      // Generate Base/Ethereum wallet
      const baseWallet = Wallet.createRandom();
      const baseAddress = baseWallet.address;

      const encrypted = encryptWalletForStorage(
        solKeypair.secretKey,
        baseWallet.privateKey,
      );

      const { error } = await getSupabase()
        .from("x402_user_wallets")
        .insert({
          user_id: userId,
          address: solAddress,
          balance_usdc: 0,
          solana_private_key_ciphertext: encrypted.solanaCiphertext,
          base_address: baseAddress,
          base_private_key_ciphertext: encrypted.baseCiphertext,
        });

      if (error) throw new Error(`Failed to create wallets: ${error.message}`);
      logger.info(
        `Created wallets for user ${userId}: Solana ${solAddress.substring(0, 8)}... | Base ${baseAddress.substring(0, 10)}...`,
      );
    });

    return { status: "created", userId };
  },
);
