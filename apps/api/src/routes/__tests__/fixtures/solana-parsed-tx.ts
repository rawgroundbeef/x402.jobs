// Test fixtures for verifySolanaPayment (HIGH-07 + HIGH-10).
//
// Each fixture mirrors the shape returned by
// `Connection.getParsedTransaction(...)` for a single-instruction USDC
// transfer. We only populate the fields the verifier actually reads
// (`transaction.message.instructions[*].parsed`, `transaction.message.instructions[*].program`,
// and `meta.err` / `meta.innerInstructions`); everything else is omitted.
//
// USDC mints:
//   mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
//   devnet:  4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
//
// FAKE_MINT = wSOL — used as a "not USDC" stand-in.
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const USDC_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const FAKE_MINT = new PublicKey("So11111111111111111111111111111111111111112"); // wSOL

// Two arbitrary valid Solana pubkeys (not real wallets — just need to be
// well-formed base58 of correct length).
export const RECIPIENT_WALLET = "5xoBq7f7CDgZwqHrDBdRWM84ExRetg4gZq2eYK5xQ2pY";
export const ATTACKER_WALLET = "7vYjBzGtsozBVD8tFvbUujkB6w9b1JV4uPSswkcjPECC";

export interface SolanaParsedTxFixtures {
  recipientAta: string;
  attackerAta: string;
  wrongMintAta: string;
  validTx: any;
  wrongDestinationTx: any;
  wrongMintTx: any;
  legacyTransferTx: any;
}

/**
 * Build the canned parsed-tx fixtures used by webhooks.test.ts.
 * Returns a struct with one tx per test case in the locked HIGH-07 + HIGH-10 matrix.
 */
export async function buildFixtures(): Promise<SolanaParsedTxFixtures> {
  const recipientAta = (
    await getAssociatedTokenAddress(USDC_MAINNET, new PublicKey(RECIPIENT_WALLET))
  ).toBase58();
  const attackerAta = (
    await getAssociatedTokenAddress(USDC_MAINNET, new PublicKey(ATTACKER_WALLET))
  ).toBase58();
  const wrongMintAta = (
    await getAssociatedTokenAddress(FAKE_MINT, new PublicKey(RECIPIENT_WALLET))
  ).toBase58();

  // Wrap a single parsed spl-token instruction in the minimum tx shape the
  // verifier reads. `program: 'spl-token'` matches the current guard at
  // webhooks.ts:250 (`ix.program === "spl-token"`).
  const buildTx = (parsed: any) => ({
    transaction: {
      message: {
        instructions: [
          {
            program: "spl-token",
            parsed,
          },
        ],
      },
    },
    meta: { err: null, innerInstructions: [] },
  });

  return {
    recipientAta,
    attackerAta,
    wrongMintAta,
    // Case A: transferChecked + USDC mint + correct ATA = valid
    validTx: buildTx({
      type: "transferChecked",
      info: {
        source: "source-ata",
        destination: recipientAta,
        mint: USDC_MAINNET.toBase58(),
        authority: "payer-pubkey",
        tokenAmount: { amount: "100000", decimals: 6, uiAmount: 0.1 }, // 0.1 USDC
      },
    }),
    // Case B (HIGH-07): transferChecked + USDC mint + WRONG ATA = invalid
    wrongDestinationTx: buildTx({
      type: "transferChecked",
      info: {
        source: "source-ata",
        destination: attackerAta,
        mint: USDC_MAINNET.toBase58(),
        authority: "payer-pubkey",
        tokenAmount: { amount: "100000", decimals: 6, uiAmount: 0.1 },
      },
    }),
    // Case C (HIGH-10): transferChecked + WRONG mint = invalid
    wrongMintTx: buildTx({
      type: "transferChecked",
      info: {
        source: "source-ata",
        destination: wrongMintAta,
        mint: FAKE_MINT.toBase58(),
        authority: "payer-pubkey",
        tokenAmount: { amount: "100000", decimals: 6, uiAmount: 0.1 },
      },
    }),
    // Case D (HIGH-10): legacy `transfer` with no mint field = invalid
    legacyTransferTx: buildTx({
      type: "transfer",
      info: {
        source: "source-ata",
        destination: recipientAta,
        authority: "payer-pubkey",
        amount: "100000",
      },
    }),
  };
}
