import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ComputeBudgetProgram, Connection, Keypair, MessageV1, PublicKey,
  SystemProgram, VersionedTransaction,
} from '@solana/web3.js'
import { collectComputeBudget } from '../lib/receipt-evidence.ts'
import { normalizeReceipt, type Receipt } from '../research/execution-casefile/core.ts'

/**
 * Phase 2 of research/v1-budget-source/preregistration.md — CONSTRUCTS AND SENDS.
 *
 * Phase 1 found V1 on devnet but only in a shape that could not test the hypothesis: the one
 * organic V1 transaction carried no Compute Budget instructions. Arm A is that missing shape.
 *
 *   Arm A — V1, Compute Budget instructions only, no config budget (all fields null)
 *   Arm B — V1, transactionConfig budget set, no Compute Budget instructions
 *
 * This sends two transactions on DEVNET from an ephemeral keypair generated in memory for this
 * run. The secret key is never written to disk or logged. Devnet only; no mainnet endpoint is
 * accepted. Requires an explicit opt-in flag because every other Breadlines artifact sends
 * nothing:
 *
 *   BREADLINES_PHASE2_SEND=1 node --experimental-strip-types scripts/v1-budget-phase2.ts
 */
const ENDPOINT = process.env.BREADLINES_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const OUT = 'research/v1-budget-source'

if (process.env.BREADLINES_PHASE2_SEND !== '1') {
  console.error('Refusing to run: Phase 2 sends transactions. Set BREADLINES_PHASE2_SEND=1 to opt in.')
  process.exit(2)
}
if (/mainnet/i.test(ENDPOINT)) {
  console.error(`Refusing to run against a mainnet endpoint: ${ENDPOINT}`)
  process.exit(2)
}

async function atomic(file: string, value: unknown) {
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temp, file)
}

const NULL_CONFIG = { computeUnitLimit: null, heapSize: null, loadedAccountsDataSizeLimit: null, priorityFee: null }

function buildArm(
  payer: PublicKey, blockhash: string,
  arm: 'A' | 'B',
) {
  // Both arms carry the same trivial payload — a 0-lamport self transfer — so the only
  // difference between them is where the budget is declared.
  const payload = SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: 0 })
  const instructions = arm === 'A'
    ? [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
        payload,
      ]
    : [payload]
  const transactionConfig = arm === 'A'
    ? { ...NULL_CONFIG }
    : { computeUnitLimit: 120_000, heapSize: null, loadedAccountsDataSizeLimit: null, priorityFee: 120 }

  // Compile by hand: account keys are payer plus each distinct program, payer first and signing.
  const programIds = [...new Set(instructions.map((ix) => ix.programId.toBase58()))]
  const staticAccountKeys = [payer, ...programIds.map((id) => new PublicKey(id))]
  const indexOf = (key: PublicKey) => staticAccountKeys.findIndex((k) => k.equals(key))

  return new MessageV1({
    header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: programIds.length },
    staticAccountKeys,
    recentBlockhash: blockhash,
    compiledInstructions: instructions.map((ix) => ({
      programIdIndex: indexOf(ix.programId),
      accountKeyIndexes: ix.keys.map((meta) => indexOf(meta.pubkey)),
      data: new Uint8Array(ix.data),
    })),
    transactionConfig,
  })
}

/**
 * Can this SDK build a V1 transaction at all? web3.js 1.99.0 deserializes V1 (that is how a V1
 * receipt is read) but MessageV1.serialize() is an unconditional throw. Check that before
 * touching the network, so the real blocker is not masked by a faucet failure.
 */
function serializationSupported() {
  const key = Keypair.generate().publicKey
  const probe = new MessageV1({
    header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 },
    staticAccountKeys: [key, SystemProgram.programId],
    recentBlockhash: '11111111111111111111111111111111',
    compiledInstructions: [{ programIdIndex: 1, accountKeyIndexes: [0], data: new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) }],
    transactionConfig: { ...NULL_CONFIG },
  })
  try { probe.serialize(); return { supported: true, reason: null } }
  catch (error) { return { supported: false, reason: (error as Error).message } }
}

async function main() {
  const support = serializationSupported()
  if (!support.supported) {
    console.error('BLOCKED: this SDK cannot construct a V1 transaction.')
    console.error(`  ${support.reason}`)
    console.error('  @solana/web3.js@1.99.0 deserializes V1 but does not serialize it, so neither arm')
    console.error('  can be built. This is a tooling gate, not a funding or permission problem.')
    console.error('  Re-run when an SDK release can serialize a V1 message.')
    process.exitCode = 3
    return
  }

  const connection = new Connection(ENDPOINT, 'confirmed')
  // A caller-supplied devnet key lets this run where the public faucet refuses. Devnet
  // throwaway keys only: it is read from the environment, never logged and never written out.
  const supplied = process.env.BREADLINES_PHASE2_SECRET_KEY
  const payer = supplied
    ? Keypair.fromSecretKey(Uint8Array.from(supplied.trim().startsWith('[') ? JSON.parse(supplied) : Buffer.from(supplied, 'base64')))
    : Keypair.generate()
  console.log(`endpoint ${ENDPOINT}`)
  console.log(`payer ${payer.publicKey.toBase58()} (${supplied ? 'supplied' : 'ephemeral'}; secret key never persisted)`)

  let balance = await connection.getBalance(payer.publicKey)
  if (balance === 0) {
    try {
      const signature = await connection.requestAirdrop(payer.publicKey, 20_000_000)
      await connection.confirmTransaction(signature, 'confirmed')
      balance = await connection.getBalance(payer.publicKey)
    } catch (error) {
      console.error(`BLOCKED: could not fund the payer. ${(error as Error).message}`)
      console.error('  The public devnet faucet is rate-limited. Supply a funded devnet key via')
      console.error('  BREADLINES_PHASE2_SECRET_KEY (JSON array or base64) and re-run.')
      process.exitCode = 4
      return
    }
  }
  console.log(`payer balance ${balance} lamports`)

  const results: Record<string, unknown> = {}
  for (const arm of ['A', 'B'] as const) {
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    const message = buildArm(payer.publicKey, blockhash, arm)
    const transaction = new VersionedTransaction(message)
    transaction.sign([payer])

    const sig = await connection.sendTransaction(transaction, { skipPreflight: false, maxRetries: 3 })
    console.log(`arm ${arm} sent ${sig}`)
    await connection.confirmTransaction(sig, 'confirmed')

    const raw = await (connection as unknown as { _rpcRequest: (m: string, p: unknown[]) => Promise<{ result?: unknown }> })
      ._rpcRequest('getTransaction', [sig, { encoding: 'json', maxSupportedTransactionVersion: 3, commitment: 'confirmed' }])
    const receipt = raw.result as Record<string, unknown> | null
    if (!receipt) throw new Error(`arm ${arm}: no receipt returned for ${sig}`)

    const asReceipt = { ...receipt, slot: receipt.slot } as unknown as Receipt
    let disposition = 'ACCEPTED'
    let rejectionMessage: string | null = null
    let budgetIfAccepted: unknown = null
    try {
      normalizeReceipt(asReceipt)
      budgetIfAccepted = collectComputeBudget(asReceipt as never)
    } catch (error) {
      rejectionMessage = (error as Error).message
      disposition = /transaction version/i.test(rejectionMessage) ? 'REJECTED_VERSION'
        : /transaction configuration/i.test(rejectionMessage) ? 'REJECTED_CONFIG' : 'REJECTED_OTHER'
    }

    const message_ = (receipt.transaction as { message?: Record<string, unknown> }).message ?? {}
    results[`arm${arm}`] = {
      signature: sig,
      declared: arm === 'A' ? 'ComputeBudget instructions only, transactionConfig all null'
        : 'transactionConfig budget set, no ComputeBudget instructions',
      servedVersion: JSON.stringify((receipt as { version?: unknown }).version),
      servedTransactionConfig: message_.transactionConfig ?? null,
      computeBudgetIxCount: ((message_.instructions ?? []) as Array<{ programIdIndex?: number }>).length,
      metaFee: (receipt.meta as { fee?: number } | undefined)?.fee ?? null,
      metaComputeUnitsConsumed: (receipt.meta as { computeUnitsConsumed?: number } | undefined)?.computeUnitsConsumed ?? null,
      parserDisposition: disposition,
      rejectionMessage,
      budgetIfAccepted,
      receipt,
    }
  }

  await mkdir(OUT, { recursive: true })
  await atomic(path.join(OUT, 'phase2-records.json'), {
    generatedAt: new Date().toISOString(),
    protocol: 'research/v1-budget-source/preregistration.md — Phase 2, constructed A/B',
    endpoint: ENDPOINT, cluster: 'devnet',
    payerPublicKey: payer.publicKey.toBase58(),
    note: 'Ephemeral keypair generated in memory for this run. The secret key was never written to disk. Devnet only.',
    sdk: '@solana/web3.js@1.99.0',
    results,
  })
  console.log(`wrote ${path.join(OUT, 'phase2-records.json')}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
