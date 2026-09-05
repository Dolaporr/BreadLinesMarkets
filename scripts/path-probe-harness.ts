import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const PATHS = ['axiom', 'nozomi', 'bam', 'direct-tpu'] as const
export const FEE_TIERS = [
  { id: 'market-rate-reference', microLamportsPerCu: 10_000 },
  { id: 'deliberately-underpriced', microLamportsPerCu: 500 },
] as const
export const CONDITION_TARGET = 200
export const FINALIZED_DELAY_SECONDS = 90
export const CLOCK_WINDOW_UTC = '13:00–16:00 UTC'

export type PathId = typeof PATHS[number]
export type Condition = 'quiet' | 'active' | 'congested'
export type FeeTierId = typeof FEE_TIERS[number]['id']
export type TrialPlan = {
  schemaVersion: 'path-probe-plan-v1'
  studyId: 'breadlines-delivery-path-probe-v1'
  runId: string
  sequence: number
  condition: Condition
  path: PathId
  feeTier: FeeTierId
  computeUnitPriceMicroLamports: number
  finalizedCheckDelaySeconds: number
  clockWindowUtc: string
  status: 'PLANNED'
}

export type ProbeConfig = {
  runId: string
  condition: Condition
  p75MicroLamportsPerCu: number
  outputDirectory?: string
}

export function classifyCondition(p75MicroLamportsPerCu: number): Condition {
  if (!Number.isFinite(p75MicroLamportsPerCu) || p75MicroLamportsPerCu < 0) throw new Error('p75MicroLamportsPerCu must be a non-negative number')
  if (p75MicroLamportsPerCu < 5_000) return 'quiet'
  if (p75MicroLamportsPerCu < 25_000) return 'active'
  return 'congested'
}

export function buildConditionPlan(runId: string, condition: Condition): TrialPlan[] {
  const plan: TrialPlan[] = []
  let sequence = 0
  for (let round = 0; round < CONDITION_TARGET; round += 1) {
    for (const tier of FEE_TIERS) {
      for (const path of PATHS) {
        plan.push({
          schemaVersion: 'path-probe-plan-v1',
          studyId: 'breadlines-delivery-path-probe-v1',
          runId,
          sequence: sequence++,
          condition,
          path,
          feeTier: tier.id,
          computeUnitPriceMicroLamports: tier.microLamportsPerCu,
          finalizedCheckDelaySeconds: FINALIZED_DELAY_SECONDS,
          clockWindowUtc: CLOCK_WINDOW_UTC,
          status: 'PLANNED',
        })
      }
    }
  }
  return plan
}

export function validateConfig(config: ProbeConfig): void {
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(config.runId)) throw new Error('runId must be 3–81 URL-safe alphanumeric/hyphen characters')
  const derivedCondition = classifyCondition(config.p75MicroLamportsPerCu)
  if (derivedCondition !== config.condition) {
    throw new Error(`Refusing plan: p75 ${config.p75MicroLamportsPerCu} classifies as ${derivedCondition}, not declared ${config.condition}`)
  }
}

function acquireLock(lockPath: string): () => void {
  mkdirSync(dirname(lockPath), { recursive: true })
  if (existsSync(lockPath)) {
    const existing = readFileSync(lockPath, 'utf8').trim()
    throw new Error(`Refusing concurrent run: lock exists at ${lockPath}${existing ? ` (${existing})` : ''}`)
  }
  const descriptor = openSync(lockPath, 'wx')
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, acquiredAtUtc: new Date().toISOString() }) + '\n')
  closeSync(descriptor)
  return () => { if (existsSync(lockPath)) unlinkSync(lockPath) }
}

export function journalDryRun(config: ProbeConfig): { journalPath: string; plan: TrialPlan[] } {
  validateConfig(config)
  const outputDirectory = resolve(config.outputDirectory ?? join('research', 'path-probe-study', 'runs', config.runId))
  mkdirSync(outputDirectory, { recursive: true })
  const releaseLock = acquireLock(join(outputDirectory, '.lock'))
  try {
    const journalPath = join(outputDirectory, 'planned-trials.jsonl')
    const plan = buildConditionPlan(config.runId, config.condition)
    const header = {
      type: 'PLAN_HEADER',
      schemaVersion: 'path-probe-plan-v1',
      mode: 'DRY_RUN',
      createdAtUtc: new Date().toISOString(),
      p75MicroLamportsPerCu: config.p75MicroLamportsPerCu,
      derivedCondition: classifyCondition(config.p75MicroLamportsPerCu),
      transactionTransmission: 'NOT_ATTEMPTED',
    }
    appendFileSync(journalPath, JSON.stringify(header) + '\n', 'utf8')
    for (const trial of plan) appendFileSync(journalPath, JSON.stringify(trial) + '\n', 'utf8')
    return { journalPath, plan }
  } finally {
    releaseLock()
  }
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main(): void {
  if (process.argv.includes('--live')) {
    throw new Error('Live transmission is intentionally unavailable. It requires separately reviewed adapters, signed transaction construction, and explicit authorization after this preregistration.')
  }
  const condition = readArg('--condition') as Condition | undefined
  const p75 = readArg('--p75')
  const runId = readArg('--run-id') ?? `dry-run-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
  if (!condition || p75 == null) throw new Error('Usage: node --experimental-strip-types scripts/path-probe-harness.ts --condition quiet|active|congested --p75 <micro-lamports/CU> [--run-id id]')
  const result = journalDryRun({ runId, condition, p75MicroLamportsPerCu: Number(p75) })
  console.log(JSON.stringify({ mode: 'DRY_RUN', transactionTransmission: 'NOT_ATTEMPTED', plannedTrials: result.plan.length, journalPath: result.journalPath }, null, 2))
}

if (process.argv[1] && /path-probe-harness\.ts$/.test(process.argv[1])) main()
