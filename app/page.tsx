'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip
} from 'recharts'
import { 
  Zap, 
  Clock, 
  Ban, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  Clipboard,
  Share2
} from 'lucide-react'
import { simulateBlock, type SimParams as SimulationParams, type SimResult as Metrics } from '@/lib/simulateBlock'
import {
  buildFailedReceiptShareText,
  contextualPressureSentence,
  documentedErrorHeadline,
  failedReceiptFutureText,
  failedReceiptUnknowns,
} from '@/lib/receipt-evidence'
import {
  getBreadlinesReceipt,
  getCoinActivityReceipt,
  getLiveData,
  getTransfersByAddress,
  type BreadlinesReceipt,
  type CoinActivityReceipt,
  type CoinActivityInsight,
  type CoinActivityTransaction,
  type CoinReceiptConfidence,
  type HeliusTransferSummary,
  type ReceiptConfidence,
  type ReceiptEvidenceType,
  type ReceiptSensitivityLevel,
} from '@/lib/helius'

// Types
interface Transaction {
  id: number
  x: number
  y: number
  targetX: number
  targetY: number
  speed: number
  color: string
  size: number
}

function generateLatencyData(metrics: Metrics, mode: 'fcfs' | 'batching' | 'mcp') {
  const baseSpread = mode === 'fcfs' ? 3.4 : mode === 'batching' ? 2.1 : 1.1
  const peak = mode === 'fcfs' ? 130 : mode === 'batching' ? 88 : 34
  return Array.from({ length: 8 }, (_, i) => ({
    bucket: `${(i + 1) * 50}ms`,
    count: Math.max(0, Math.round(
      Math.exp(-Math.pow((i + 1) * 50 - metrics.avgInclusionLatency, 2) / (2 * Math.pow(metrics.avgInclusionLatency * baseSpread / 3, 2))) * peak
    )),
  }))
}

function getChartDomain(mode: 'fcfs' | 'batching' | 'mcp'): [number, number] {
  return mode === 'fcfs' ? [0, 140] : mode === 'batching' ? [0, 95] : [0, 40]
}

function formatLamports(value: number) {
  return value.toFixed(3).replace(/\.?0+$/, '')
}

function HighlightValue({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-primary">{children}</span>
}

function StatusDot({
  color,
  label,
  pulse = false,
  pulseDuration,
}: {
  color: string
  label: string
  pulse?: boolean
  pulseDuration?: number
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span
        className={pulse ? 'animate-pulse' : ''}
        style={{
          backgroundColor: color,
          animationDuration: pulse && pulseDuration ? `${pulseDuration}s` : undefined,
        }}
      >
        <span className="block h-2.5 w-2.5 rounded-full" />
      </span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
    </div>
  )
}

function OrderingIndicator({ replayPriority }: { replayPriority: number }) {
  const roundRobinActive = replayPriority === 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="rounded-lg border border-primary/40 bg-primary/8 px-3 py-2 text-primary">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/60 bg-transparent text-primary"
            >
              {roundRobinActive ? 'Round-Robin Active' : 'Priority Auction Active'}
            </Badge>
            {roundRobinActive ? (
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3], x: [0, 4, 0] }}
                    transition={{
                      duration: 0.9,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: dot * 0.12,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {roundRobinActive
              ? 'Same priority = FCFS still lives inside MCP'
              : 'Oracle replay priority dominates ordering'}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {roundRobinActive
          ? 'When txs share the same priority, MCP uses round-robin merge — composable FCFS inside MCP'
          : 'Oracle replay priority takes precedence over same-priority round-robin ordering'}
      </TooltipContent>
    </Tooltip>
  )
}

// Transaction Animation Canvas Component
function TransactionRace({ 
  mode, 
  params,
  metrics,
  isActive 
}: { 
  mode: 'fcfs' | 'batching' | 'mcp'
  params: SimulationParams
  metrics: Metrics
  isActive: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transactionsRef = useRef<Transaction[]>([])
  const animationRef = useRef<number | undefined>(undefined)
  const lastSpawnRef = useRef(0)
  
  const colors = {
    fcfs: ['#ff4444', '#ff6644', '#ff8844', '#ffaa44'],
    batching: ['#666680', '#777790', '#8888a0', '#9999b0'],
    mcp: ['#22ff88', '#44ffaa', '#66ffcc', '#88ffee'],
  }

  const spawnTransaction = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const color = colors[mode][Math.floor(Math.random() * colors[mode].length)]
    const chaos = metrics.percentCensored / (mode === 'fcfs' ? 10 : mode === 'batching' ? 16 : 24)
    
    const tx: Transaction = {
      id: Date.now() + Math.random(),
      x: Math.random() * canvas.width * 0.3,
      y: 10 + Math.random() * (canvas.height - 40),
      targetX: canvas.width - 20,
      targetY: mode === 'mcp' 
        ? 20 + Math.floor(Math.random() * 3) * ((canvas.height - 40) / 3) + (canvas.height - 40) / 6
        : 10 + Math.random() * (canvas.height - 40),
      speed: mode === 'fcfs' 
        ? 1 + Math.random() * 3 * (1 - params.spamVolume / 200)
        : mode === 'batching'
          ? 1.5 + Math.random() * 2
          : 2 + Math.random() * 1.5,
      color,
      size: 3 + Math.random() * 3 + chaos * 0.3,
    }
    
    transactionsRef.current.push(tx)
  }, [metrics.percentCensored, mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = (timestamp: number) => {
      if (!isActive) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Spawn new transactions
      const spawnRate = Math.max(50, 200 - metrics.percentCensored * 1.5)
      if (timestamp - lastSpawnRef.current > spawnRate) {
        spawnTransaction()
        lastSpawnRef.current = timestamp
      }

      // Clear canvas
      ctx.fillStyle = mode === 'fcfs' 
        ? 'rgba(15, 10, 10, 0.15)' 
        : mode === 'batching' 
          ? 'rgba(15, 15, 20, 0.15)' 
          : 'rgba(10, 15, 12, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw grid lines for MCP mode
      if (mode === 'mcp') {
        ctx.strokeStyle = 'rgba(34, 255, 136, 0.1)'
        ctx.lineWidth = 1
        for (let i = 1; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(0, (canvas.height / 4) * i)
          ctx.lineTo(canvas.width, (canvas.height / 4) * i)
          ctx.stroke()
        }
      }

      // Update and draw transactions
      transactionsRef.current = transactionsRef.current.filter(tx => {
        // Move towards target
        const dx = tx.targetX - tx.x
        const dy = tx.targetY - tx.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist > tx.speed) {
          const chaos = mode === 'fcfs' ? (Math.random() - 0.5) * metrics.percentCensored / 12 : 0
          tx.x += (dx / dist) * tx.speed + chaos
          tx.y += (dy / dist) * tx.speed * 0.5 + chaos
        } else {
          return false // Remove transaction when it reaches target
        }

        // Draw transaction
        ctx.beginPath()
        ctx.arc(tx.x, tx.y, tx.size, 0, Math.PI * 2)
        ctx.fillStyle = tx.color
        ctx.fill()
        
        // Add glow effect
        ctx.shadowColor = tx.color
        ctx.shadowBlur = mode === 'mcp' ? 10 : mode === 'fcfs' ? 5 : 7
        ctx.fill()
        ctx.shadowBlur = 0

        return true
      })

      // Draw target zone
      ctx.fillStyle = mode === 'fcfs' 
        ? 'rgba(255, 68, 68, 0.2)' 
        : mode === 'batching' 
          ? 'rgba(102, 102, 128, 0.2)' 
          : 'rgba(34, 255, 136, 0.2)'
      ctx.fillRect(canvas.width - 30, 0, 30, canvas.height)

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive, metrics.percentCensored, mode, spawnTransaction])

  // Reset on mode change
  useEffect(() => {
    transactionsRef.current = []
  }, [mode, params.blockTime])

  return (
    <canvas 
      ref={canvasRef} 
      width={280} 
      height={120}
      className="w-full h-[120px] rounded-lg"
      style={{ 
        background: mode === 'fcfs' 
          ? 'linear-gradient(135deg, rgba(255,68,68,0.05) 0%, rgba(15,10,10,1) 100%)' 
          : mode === 'batching'
            ? 'linear-gradient(135deg, rgba(102,102,128,0.05) 0%, rgba(15,15,20,1) 100%)'
            : 'linear-gradient(135deg, rgba(34,255,136,0.05) 0%, rgba(10,15,12,1) 100%)'
      }}
    />
  )
}

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  unit, 
  icon: Icon, 
  trend,
  color,
  muted = false,
}: { 
  label: string
  value: number | string
  unit: string
  icon: React.ElementType
  trend?: 'good' | 'bad' | 'neutral'
  color: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
      <div 
        className="p-2 rounded-md"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <motion.p 
          key={value}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold tabular-nums"
          style={{ color: muted ? '#8b8b9a' : color }}
        >
          {value}{unit}
        </motion.p>
      </div>
      {trend && !muted && (
        <Badge 
          variant={trend === 'good' ? 'default' : trend === 'bad' ? 'destructive' : 'secondary'}
          className="text-[10px] px-1.5"
        >
          {trend === 'good' ? 'Low' : trend === 'bad' ? 'High' : 'Med'}
        </Badge>
      )}
    </div>
  )
}

const SAMPLE_SIGNATURE = '2GMEDJP6vf4Yw8iKBQVfLs311f5kjAo8WtvaJRo6LMuv5LbQDFBdsZho94ij7YAUcA1T9SxYhDn7jw181x4mpAA2'
const SAMPLE_TRANSFER_ADDRESS = '86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY'
const SAMPLE_COIN_MINT = '8cLSy3rjyCuVzzE1PuQ7AwALQNERrTZx9T8R52pRpump'
const COIN_SCAN_WINDOW_OPTIONS = [50, 100, 250] as const
const COIN_EXAMPLES = [
  {
    label: '$BREADLINES',
    value: SAMPLE_COIN_MINT,
    note: 'Breadlines market activity receipt sample.',
  },
  {
    label: '$LMAO',
    value: 'H74CYmXgMkYHYuSRsZt6RJb4NYp2u72Vw8BS5huApump',
    note: 'Sling-aligned activity case study candidate.',
  },
  {
    label: '$percolator',
    value: '8PzFWyLpCVEmbZmVJcaRTU5r69XKJx1rd7YGpWvnpump',
    note: 'Percolator conversation coin activity receipt.',
  },
  {
    label: '$BURNIE',
    value: 'CGEDT9QZDvvH5GmVkWJH2BXiMJqMJySC9ihWyr7Spump',
    note: 'High-attention coin activity receipt sample.',
  },
] as const
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const RECEIPT_EXAMPLES = [
  {
    label: 'Successful swap',
    value: '2GMEDJP6vf4Yw8iKBQVfLs311f5kjAo8WtvaJRo6LMuv5LbQDFBdsZho94ij7YAUcA1T9SxYhDn7jw181x4mpAA2',
    note: 'Observed successful Jupiter route.',
  },
  {
    label: 'Failed route',
    value: '4NBrMsedNEtTzYBTfQf73Z8m9951WYP68shBLi7PTFSZsQ795i2QLGEEMgP3iX2qq4Ku2H1jQjWTZNizNKrQAa56',
    note: 'Observed failed Jupiter route.',
  },
  {
    label: 'High-fee attempt',
    value: '2LsQeiLFT4Wn4Rcv3YswEF5ppALk3dNbF4DW9jCFHakt9E6CL1gozPEasvN2nijaSCsBfxB2rGGCKcBwpXXPQVnv',
    note: 'Higher fee route attempt in a busy Jupiter slot sample.',
  },
] as const
const PERP_EXAMPLES = [
  {
    label: 'Drift fill',
    value: 'drift:5wGkQ7mZp9YvN2rT8xB4sLdHqP6aJcE3fUvK1nMxR92QbCdEfGhJkLmNpRsTuVwX',
  },
  {
    label: 'Jupiter perps',
    value: 'jupiter-perps:4sBxH7kLmQp9YvN2rT8xB4sLdHqP6aJcE3fUvK1nMxR92QbCdEfGhJkLmNpRs',
  },
  {
    label: 'Phoenix route',
    value: 'phoenix:2rT8xB4sLdHqP6aJcE3fUvK1nMxR92QbCdEfGhJkLmNpRsTuVwX5wGkQ7mZp9YvN',
  },
] as const
type PerpsResult = {
  venue: string
  blocksWaited: number
  spammersCut: number
  slippagePaid: string
  liqRisk: string
  fundingExposure: string
  fillTime: string
  mcpMessage: string
}

function formatSol(value: number | null | undefined) {
  if (value == null) return 'Unavailable'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`
}

function formatLamportsValue(value: number | null | undefined) {
  if (value == null) return 'Unavailable'
  return `${value.toLocaleString()} lamports`
}

function formatComputeUnits(value: number | null | undefined) {
  if (value == null) return 'Unavailable'
  return value.toLocaleString()
}

function formatComputeUnitPrice(value: number | null | undefined) {
  if (value == null) return 'Unavailable'
  return `${value.toLocaleString()} micro-lamports/CU`
}

function formatBlockTime(value: number | null) {
  if (!value) return 'Unavailable'
  return new Date(value * 1000).toLocaleString()
}

function confidenceTone(confidence: ReceiptConfidence) {
  if (confidence === 'observed') return 'border-emerald-400/35 bg-emerald-400/[0.06] text-emerald-200'
  if (confidence === 'estimated') return 'border-amber-300/35 bg-amber-300/[0.06] text-amber-200'
  return 'border-sky-300/35 bg-sky-300/[0.06] text-sky-200'
}

function receiptEvidenceTone(evidence: ReceiptEvidenceType) {
  if (evidence === 'observed') return 'border-emerald-400/35 bg-emerald-400/[0.06] text-emerald-200'
  if (evidence === 'derived') return 'border-sky-300/35 bg-sky-300/[0.06] text-sky-200'
  if (evidence === 'inferred') return 'border-amber-300/35 bg-amber-300/[0.06] text-amber-200'
  return 'border-sky-300/35 bg-sky-300/[0.06] text-sky-200'
}

function coinConfidenceTone(confidence: CoinReceiptConfidence) {
  if (confidence === 'needs inspection') return 'border-sky-300/35 bg-sky-300/[0.06] text-sky-200'
  if (confidence === 'unclear') return 'border-border/70 bg-secondary/20 text-muted-foreground'
  return confidenceTone(confidence)
}

function coinInsightTone(level: CoinActivityInsight['level']) {
  if (level === 'high') return 'border-rose-400/35 bg-rose-400/[0.05]'
  if (level === 'medium') return 'border-amber-300/35 bg-amber-300/[0.05]'
  if (level === 'low') return 'border-emerald-400/35 bg-emerald-400/[0.04]'
  if (level === 'needs inspection') return 'border-sky-300/35 bg-sky-300/[0.04]'
  return 'border-border/60 bg-background/35'
}

function sensitivityTone(level: ReceiptSensitivityLevel | 'moderate') {
  if (level === 'high') return 'border-rose-400/40 bg-rose-400/[0.06] text-rose-200'
  if (level === 'medium' || level === 'moderate') return 'border-amber-300/35 bg-amber-300/[0.06] text-amber-200'
  return 'border-emerald-400/35 bg-emerald-400/[0.06] text-emerald-200'
}

function ConfidenceBadge({ confidence }: { confidence: ReceiptEvidenceType }) {
  return (
    <Badge variant="outline" className={`shrink-0 max-w-none text-[10px] uppercase tracking-[0.14em] ${receiptEvidenceTone(confidence)}`}>
      {confidence}
    </Badge>
  )
}

function SensitivityBadge({ level }: { level: ReceiptSensitivityLevel | 'moderate' }) {
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-[0.14em] ${sensitivityTone(level)}`}>
      {level}
    </Badge>
  )
}

function CoinConfidenceBadge({ confidence }: { confidence: CoinReceiptConfidence }) {
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-[0.14em] ${coinConfidenceTone(confidence)}`}>
      {confidence}
    </Badge>
  )
}

function InclusionConfidenceBadge({ confidence }: { confidence: ReceiptEvidenceType | 'needs inspection' }) {
  return (
    <Badge variant="outline" className={`shrink-0 max-w-none text-[10px] uppercase tracking-[0.14em] ${confidence === 'needs inspection' ? coinConfidenceTone(confidence) : receiptEvidenceTone(confidence)}`}>
      {confidence}
    </Badge>
  )
}

function inclusionSymptomTone(label: string) {
  if (label === 'needs inspection') return 'border-sky-300/35 bg-sky-300/[0.06] text-sky-200'
  if (label.includes('high') || label.includes('hot')) return 'border-rose-400/35 bg-rose-400/[0.06] text-rose-200'
  if (label.includes('zero') || label.includes('omitted') || label.includes('repeat')) {
    return 'border-amber-300/35 bg-amber-300/[0.06] text-amber-200'
  }
  return 'border-border/70 bg-background/35 text-muted-foreground'
}

function formatTokenValue(value: number | null | undefined) {
  if (value == null) return 'Unclear'
  return value.toLocaleString(undefined, { maximumFractionDigits: value >= 1 ? 2 : 6 })
}

function formatPercentValue(value: number | null | undefined) {
  if (value == null) return 'Unclear'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function formatExecutionState(state: BreadlinesReceipt['executionState']) {
  if (state === 'landed-but-failed') return 'landed but failed'
  if (state === 'did-not-land') return 'did not land'
  return 'landed'
}

function buildReceiptShareText(receipt: BreadlinesReceipt) {
  if (receipt.executionState === 'landed-but-failed' && receipt.executionError) {
    return buildFailedReceiptShareText({
      shortSignature: receipt.shortSignature,
      slot: receipt.slot,
      executionError: receipt.executionError,
      feePaidLamports: receipt.feePaidLamports,
      priorityFeeDerivation: receipt.priorityFeeDerivation,
      slotPressure: receipt.slotPressure,
    })
  }

  const activePercolatorLens = receipt.executionState === 'landed-but-failed' ? null : receipt.percolatorLens
  const showPercolatorLens = activePercolatorLens != null
  const errorLine = receipt.executionError
    ? `Documented error: ${receipt.executionError.program}${receipt.executionError.code != null ? ` ${receipt.executionError.code}` : ''}${receipt.executionError.name ? ` (${receipt.executionError.name})` : ''} - ${receipt.executionError.message}`
    : null

  return [
    `Breadlines receipt for ${receipt.shortSignature}`,
    receipt.inclusionSymptoms.shareText,
    '',
    `Execution: ${formatExecutionState(receipt.executionState)} | Slot: ${receipt.slot}`,
    errorLine,
    `Fee paid: ${formatLamportsValue(receipt.feePaidLamports)}`,
    receipt.priorityFeeDerivation
      ? `Priority fee: ${formatLamportsValue(receipt.priorityFeeLamportsEstimated)} (derived: ${receipt.priorityFeeDerivation.formula})`
      : 'Priority fee: unavailable (no complete Compute Budget price and limit pair)',
    `Inclusion symptoms: ${receipt.inclusionSymptoms.symptomBadges.map((badge) => badge.label).join(', ') || 'none flagged'}`,
    `Slot pressure: ${receipt.slotPressure.label} (${receipt.slotPressure.confidence})`,
    ...(activePercolatorLens
      ? [
          `Queue-sensitive: ${activePercolatorLens.queueSensitive.level}`,
          `Price-sensitive: ${activePercolatorLens.priceSensitive.level}`,
          `Risk/oracle-sensitive: ${activePercolatorLens.riskOracleSensitive.level}`,
        ]
      : []),
    '',
    receipt.inclusionSymptoms.disclaimer,
    showPercolatorLens
      ? 'Observed tx data + derived fee + inferred pressure + conceptual Percolator Lens.'
      : 'Observed tx data + derived fee + inferred pressure.',
    'https://breadlinesmarkets.com',
  ].filter((line): line is string => line !== null).join('\n')
}

function buildWhatThisMeans(receipt: BreadlinesReceipt) {
  const notes: Array<{ confidence: ReceiptEvidenceType; text: string }> = []

  if (receipt.executionError) {
    notes.push({
      confidence: 'observed',
      text: `${receipt.executionError.program} reported${receipt.executionError.code != null ? ` error ${receipt.executionError.code}` : ' an error'}${receipt.executionError.name ? ` (${receipt.executionError.name})` : ''}: ${receipt.executionError.message}.`,
    })
  }

  notes.push(
    {
      confidence: 'observed',
      text:
        receipt.executionState === 'landed'
          ? 'This transaction landed successfully, so the execution facts above are pulled from confirmed on-chain data.'
          : receipt.executionState === 'landed-but-failed'
            ? `This transaction landed in observed slot ${receipt.slot.toLocaleString()} but failed during program execution.`
            : 'This transaction did not land, so a confirmed execution result is unavailable.',
    },
    {
      confidence: 'inferred',
      text: `The ${receipt.slotPressure.label} pressure label is contextual: it is an inference about slot conditions, not an established cause of this transaction's result.`,
    },
  )

  if (receipt.executionState !== 'landed-but-failed' && receipt.percolatorLens) {
    notes.push({
      confidence: 'conceptual',
      text:
        'The Percolator Lens is a framing tool: it highlights whether queueing, price freshness, or oracle/risk state may matter for similar future transactions, without asserting a different outcome for this one.',
    })
  }

  if (receipt.executionState !== 'landed-but-failed' && receipt.percolatorLens?.priceSensitive.level !== 'low') {
    notes.push({
      confidence: 'inferred',
      text: 'This path has price-sensitive signals. That is context for future runs, not evidence that slot conditions caused this execution result.',
    })
  }

  return notes
}

function buildCasebookSignals(receipt: BreadlinesReceipt) {
  const tags = [
    receipt.status === 'success' ? 'successful' : 'failed',
    `${receipt.slotPressure.label}-pressure-inference`,
    `${receipt.programs.length}-programs`,
    `${receipt.writableAccountCount}-writable-accounts`,
  ]

  if (receipt.priorityFeeLamportsEstimated && receipt.priorityFeeLamportsEstimated > 0) tags.push('priority-fee-derived')
  if (receipt.executionState !== 'landed-but-failed' && receipt.percolatorLens) {
    if (receipt.percolatorLens.queueSensitive.level !== 'low') tags.push('queue-sensitive')
    if (receipt.percolatorLens.priceSensitive.level !== 'low') tags.push('price-sensitive')
    if (receipt.percolatorLens.riskOracleSensitive.level !== 'low') tags.push('risk-oracle-sensitive')
  }

  return tags
}

function buildReceiptStory(receipt: BreadlinesReceipt) {
  const summary = documentedErrorHeadline(receipt)

  const feeSentence = receipt.feePaidSol != null
    ? `It paid ${formatSol(receipt.feePaidSol)} in fees.`
    : 'Fee data was unavailable from the transaction response.'

  const pathSentence = `It touched ${receipt.programs.length} program${receipt.programs.length === 1 ? '' : 's'} and ${receipt.writableAccountCount} writable account${receipt.writableAccountCount === 1 ? '' : 's'}.`

  const pressureContext = contextualPressureSentence(receipt.slotPressure.label, receipt.slotPressure.basis)

  const priorityFeeSentence = receipt.priorityFeeDerivation
    ? `The priority fee is derived from observed Compute Budget instructions: ${receipt.priorityFeeDerivation.formula}.`
    : 'Priority fee is unavailable because this transaction did not provide both an observed Compute Budget price and limit.'

  const narrative = [summary, feeSentence, pathSentence, priorityFeeSentence, pressureContext].join(' ')

  const reasons = [
    {
      label: 'Execution state',
      text: receipt.executionState === 'landed-but-failed'
        ? `Landed in observed slot ${receipt.slot.toLocaleString()}, then failed during program execution.`
        : receipt.executionState === 'landed'
          ? `Landed successfully in observed slot ${receipt.slot.toLocaleString()}.`
          : 'Did not land, so no confirmed execution state is available.',
    },
    {
      label: 'Documented program error',
      text: receipt.executionError
        ? `${receipt.executionError.program}${receipt.executionError.code != null ? ` error ${receipt.executionError.code}` : ''}${receipt.executionError.name ? ` (${receipt.executionError.name})` : ''}: ${receipt.executionError.message}.`
        : 'No human-readable program error was present in the RPC logs.',
      technicalText: receipt.executionError?.technicalError
        ? `${receipt.executionError.technicalError.program}${receipt.executionError.technicalError.code != null ? ` error ${receipt.executionError.technicalError.code}` : ''}${receipt.executionError.technicalError.name ? ` (${receipt.executionError.technicalError.name})` : ''}: ${receipt.executionError.technicalError.message}.`
        : undefined,
    },
    {
      label: 'Deterministic facts',
      text: `${feeSentence} ${receipt.computeUnitsConsumed != null ? `${formatComputeUnits(receipt.computeUnitsConsumed)} CUs consumed${receipt.inclusionSymptoms.computeUnitLimit != null ? ` of a ${formatComputeUnits(receipt.inclusionSymptoms.computeUnitLimit)} CU limit` : ''}.` : 'Compute usage was unavailable.'}`,
    },
    {
      label: 'Contextual pressure',
      text: `${receipt.slotPressure.label} slot pressure is inferred from ${receipt.slotPressure.basis.join(', ') || 'available slot data'}. It is not an established cause of this failure.`,
    },
  ]

  const futureText = receipt.executionState === 'landed-but-failed'
    ? failedReceiptFutureText(receipt.executionError)
    : 'Future transactions with a similar program path should watch slot pressure and queue sensitivity, because they are more likely to be affected by congestion or stale state.'

  return {
    narrative,
    details: reasons,
    futureText,
  }
}

function mergeTransferScans(previous: HeliusTransferSummary, next: HeliusTransferSummary): HeliusTransferSummary {
  const transfers = [...previous.transfers, ...next.transfers]

  return {
    ...next,
    transfers,
    stats: {
      transferRows: transfers.length,
      uniqueTransactions: new Set(transfers.map((transfer) => transfer.signature)).size,
      inboundRows: previous.stats.inboundRows + next.stats.inboundRows,
      outboundRows: previous.stats.outboundRows + next.stats.outboundRows,
      mintRows: previous.stats.mintRows + next.stats.mintRows,
      burnRows: previous.stats.burnRows + next.stats.burnRows,
      token2022FeeRows: previous.stats.token2022FeeRows + next.stats.token2022FeeRows,
      batchedSignatureRows: previous.stats.batchedSignatureRows + next.stats.batchedSignatureRows,
    },
  }
}

function hashString(value: string) {
  let hash = 2166136261

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function detectPerpVenue(value: string) {
  const lower = value.toLowerCase()

  if (lower.includes('drift')) return 'Drift'
  if (lower.includes('jupiter') || lower.includes('jup')) return 'Jupiter Perps'
  if (lower.includes('phoenix')) return 'Phoenix'
  if (lower.includes('zeta')) return 'Zeta'
  if (lower.includes('mango')) return 'Mango'
  if (SOLANA_SIGNATURE_PATTERN.test(value.trim())) return 'Signature-only tx'

  return 'Perps route'
}

function buildPerpsResult(input: string, params: SimulationParams, fcfsMetrics: Metrics, mcpMetrics: Metrics): PerpsResult {
  const hash = hashString(input)
  const pressure = Math.max(1, Math.round(params.spamVolume * 0.5 + (hash % 24)))
  const blocksWaited = Math.max(1, Math.round((fcfsMetrics.avgInclusionLatency / params.blockTime) + 1 + (hash % 4)))
  const slippageBps = Math.max(4, Math.round(fcfsMetrics.effectiveSpread * 0.9 + (hash % 18)))
  const fundingBps = Math.max(1, Math.round(slippageBps * 0.22 + (hash % 6)))
  const fillMs = Math.max(18, Math.round(mcpMetrics.avgInclusionLatency + (hash % 21)))

  return {
    venue: detectPerpVenue(input),
    blocksWaited,
    spammersCut: pressure,
    slippagePaid: `${slippageBps}bp`,
    liqRisk: `+${Math.max(6, Math.round(slippageBps * 1.4))}%`,
    fundingExposure: `+${fundingBps}bp`,
    fillTime: `${fillMs}ms`,
    mcpMessage: 'MCP-style lanes make queue pressure, state freshness, and fill quality easier to reason about.',
  }
}

function PerpsSketchResult({ result }: { result: PerpsResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-border/70 text-muted-foreground">
          Detected: {result.venue}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Conceptual sketch. Real tx parsing is not active in this tab.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/35 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                FCFS queue sketch
              </p>
              <p className="mt-1 text-sm text-muted-foreground">A rough model of queue pressure under contention.</p>
            </div>
            <Badge variant="outline" className="border-border/70 text-muted-foreground">
              Conceptual
            </Badge>
          </div>
          <div className="grid gap-2">
            {[
              ['Blocks waited', result.blocksWaited],
              ['Contention score', result.spammersCut],
              ['Modeled slippage', result.slippagePaid],
              ['Modeled liq risk', result.liqRisk],
              ['Modeled funding exposure', result.fundingExposure],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border/55 bg-secondary/20 px-3 py-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/35 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                MCP-style sketch
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Concurrent lanes as a market-structure thought model.</p>
            </div>
            <Badge variant="outline" className="border-border/70 text-muted-foreground">
              Conceptual
            </Badge>
          </div>
          <div className="rounded-lg border border-border/55 bg-secondary/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Modeled fill time</p>
            <p className="mt-2 text-4xl font-bold text-foreground">{result.fillTime}</p>
            <p className="mt-3 text-sm font-medium leading-6 text-foreground">
              {result.mcpMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyLinkButton({ receipt }: { receipt: BreadlinesReceipt }) {
  const [copiedLink, setCopiedLink] = useState(false)

  const handleCopyLink = useCallback(async () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tx', receipt.signature)
      const link = url.toString()
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 1500)
    } catch {
      setCopiedLink(false)
    }
  }, [receipt.signature])

  return (
    <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
      <Clipboard className="h-4 w-4" />
      {copiedLink ? 'Copied link' : 'Copy link'}
    </Button>
  )
}

function ReceiptResult({
  receipt,
  receiptText,
  shareUrl,
  copiedReceipt,
  onCopyReceipt,
}: {
  receipt: BreadlinesReceipt
  receiptText: string
  shareUrl: string
  copiedReceipt: boolean
  onCopyReceipt: () => void
}) {
  const receiptStory = buildReceiptStory(receipt)
  const whatThisMeans = buildWhatThisMeans(receipt)
  const lens = receipt.executionState === 'landed-but-failed' ? null : receipt.percolatorLens
  const showPercolatorLens = lens != null
  const whatRemainsUnknown = failedReceiptUnknowns({
    executionState: receipt.executionState,
    executionError: receipt.executionError,
  })
  const collapseExecutionContext = receipt.executionState === 'landed-but-failed' && receipt.executionError != null
  const lensItems = lens ? [
    ['Queue-sensitive?', lens.queueSensitive],
    ['Price-sensitive?', lens.priceSensitive],
    ['Risk/oracle-sensitive?', lens.riskOracleSensitive],
  ] as const : []
  const inclusion = receipt.inclusionSymptoms
  const repeatedProgramAccountActivity = inclusion.repeatedProgramAccountActivity
    .filter((activity) => activity.available && (activity.otherRecentSignatureCount ?? 0) > 0)
  const inclusionMetrics: Array<{
    label: string
    value: string
    confidence: ReceiptEvidenceType | 'needs inspection'
    detail?: string
  }> = [
    { label: 'Execution state', value: formatExecutionState(inclusion.status), confidence: 'observed' },
    { label: 'Total fee', value: formatLamportsValue(inclusion.totalFeeLamports), confidence: 'observed' },
    {
      label: 'Derived priority fee',
      value: formatLamportsValue(inclusion.priorityFeeLamportsEstimated),
      confidence: inclusion.priorityFeeDerivation ? 'derived' : 'needs inspection',
      detail: inclusion.priorityFeeDerivation?.formula ?? 'Unavailable: an observed Compute Budget limit and price pair is required for this derivation.',
    },
    {
      label: 'CU price',
      value: formatComputeUnitPrice(inclusion.computeUnitPriceMicroLamports),
      confidence: inclusion.computeUnitPriceMicroLamports == null ? 'needs inspection' : 'observed',
    },
    {
      label: 'CU price status',
      value: inclusion.computeUnitPriceStatus,
      confidence: inclusion.computeUnitPriceStatus === 'unknown' ? 'needs inspection' : 'observed',
    },
    {
      label: 'CU limit',
      value: formatComputeUnits(inclusion.computeUnitLimit),
      confidence: inclusion.computeUnitLimit == null ? 'needs inspection' : 'observed',
    },
    {
      label: 'CUs consumed',
      value: formatComputeUnits(inclusion.computeUnitsConsumed),
      confidence: inclusion.computeUnitsConsumed == null ? 'needs inspection' : 'observed',
    },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-background/45 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Slot</p>
            <ConfidenceBadge confidence="observed" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{receipt.slot.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/45 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Execution</p>
            <ConfidenceBadge confidence="observed" />
          </div>
          <p className={`mt-1 text-2xl font-semibold ${receipt.status === 'success' ? 'text-emerald-200' : 'text-rose-200'}`}>
            {formatExecutionState(receipt.executionState)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/45 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fee Paid</p>
            <ConfidenceBadge confidence="observed" />
          </div>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatSol(receipt.feePaidSol)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{formatLamportsValue(receipt.feePaidLamports)}</p>
        </div>
        <div className={`rounded-lg border p-3 ${sensitivityTone(receipt.slotPressure.label)}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Slot Pressure</p>
            <ConfidenceBadge confidence={receipt.slotPressure.confidence} />
          </div>
          <p className="mt-1 text-2xl font-semibold capitalize">{receipt.slotPressure.label}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">score {receipt.slotPressure.score}/100</p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/45 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Executive summary</p>
          <ConfidenceBadge confidence="observed" />
        </div>
        <p className="mt-2 text-sm leading-6 text-foreground">
          {receiptStory.narrative}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {receiptStory.details.map((detail) => (
            <div key={detail.label} className="rounded-lg border border-border/55 bg-secondary/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{detail.label}</p>
              <p className="mt-1 text-sm leading-6 text-foreground">{detail.text}</p>
              {detail.technicalText ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Technical evidence: {detail.technicalText}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/45 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs font-semibold text-foreground">{receipt.shortSignature}</p>
              <Badge variant="outline" className="border-border/70 text-muted-foreground">
                {receipt.confirmationStatus}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {showPercolatorLens
                ? 'RPC data is separated into observed, derived, inferred, and conceptual evidence. This receipt does not infer user intent or claim an alternate outcome.'
                : 'RPC data is separated into observed, derived, and inferred evidence. This receipt does not infer user intent or claim an alternate outcome.'}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Observed block time: {formatBlockTime(receipt.blockTime)}
              {receipt.computeUnitsConsumed != null ? ` | Compute units: ${receipt.computeUnitsConsumed.toLocaleString()}` : ' | Compute units unavailable'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <InclusionConfidenceBadge confidence={receipt.priorityFeeDerivation ? 'derived' : 'needs inspection'} />
              <span>
                {receipt.priorityFeeDerivation
                  ? `Derived priority fee: ${formatLamportsValue(receipt.priorityFeeLamportsEstimated)}`
                  : 'Priority fee unavailable'}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {receipt.priorityFeeDerivation?.formula ?? 'No observed Compute Budget price and limit pair was available to derive a priority fee.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCopyReceipt} className="gap-2">
              <Clipboard className="h-4 w-4" />
              {copiedReceipt ? 'Copied' : 'Copy'}
            </Button>
            <Button asChild size="sm" className="gap-2">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                Share
                <Share2 className="h-4 w-4" />
              </a>
            </Button>
            <CopyLinkButton receipt={receipt} />
          </div>
        </div>
      </div>

      <details open={!collapseExecutionContext} className={collapseExecutionContext ? 'rounded-lg border border-border/60 bg-background/35' : 'contents'}>
        <summary className={collapseExecutionContext ? 'cursor-pointer list-none px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground' : 'sr-only'}>
          Execution context (secondary)
        </summary>
      <div className="rounded-lg border border-border/60 bg-background/35 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Inclusion / MEV Symptoms</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Readable tx receipt for inclusion/MEV inspection. These are tx-level symptoms for manual review, not claims about private lanes, MEV capture, or validator favoritism.
            </p>
          </div>
          <InclusionConfidenceBadge confidence="needs inspection" />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {inclusion.symptomBadges.map((badge) => (
            <Tooltip key={badge.label}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-[10px] uppercase tracking-[0.12em] ${inclusionSymptomTone(badge.label)}`}>
                  {badge.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                {badge.detail}
              </TooltipContent>
            </Tooltip>
          ))}
          {!inclusion.symptomBadges.length ? (
            <Badge variant="outline" className="border-border/70 bg-background/35 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              no symptom badge flagged
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {inclusionMetrics.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/55 bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                <InclusionConfidenceBadge confidence={item.confidence} />
              </div>
              <p className={`mt-2 truncate text-sm font-semibold ${item.label === 'Execution state' && inclusion.status === 'landed-but-failed' ? 'text-rose-200' : 'text-foreground'}`}>
                {item.value}
              </p>
              {item.detail ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.detail}</p> : null}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1fr_1fr]">
          <div className="rounded-lg border border-border/55 bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Signer wallet</p>
              {inclusion.signerWallet ? <InclusionConfidenceBadge confidence={inclusion.signerWallet.confidence} /> : null}
            </div>
            {inclusion.signerWallet ? (
              <p className="truncate font-mono text-xs text-muted-foreground">{inclusion.signerWallet.address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Signer metadata unavailable from RPC.</p>
            )}
            <div className="mt-3 rounded-md border border-border/50 bg-secondary/20 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Repeated signer activity</p>
              {inclusion.repeatedSignerActivity ? (
                <p className="mt-1 text-xs leading-5 text-foreground">
                  {inclusion.repeatedSignerActivity.available
                    ? `${inclusion.repeatedSignerActivity.otherRecentSignatureCount ?? 0} other recent signatures in ${inclusion.repeatedSignerActivity.recentSignatureCount ?? 0} sampled`
                    : 'Recent signer signatures unavailable'}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No signer address available to scan.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/55 bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Programs touched</p>
              <InclusionConfidenceBadge confidence="observed" />
            </div>
            <div className="space-y-2">
              {inclusion.programsTouched.slice(0, 4).map((program) => (
                <div key={program.id} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{program.label}</p>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{program.instructionCount} ix</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{program.id}</p>
                </div>
              ))}
              {!inclusion.programsTouched.length ? (
                <p className="text-xs text-muted-foreground">No parsed programs returned by RPC.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-border/55 bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Main writable accounts</p>
              <InclusionConfidenceBadge confidence={inclusion.mainWritableAccounts.length ? 'observed' : 'needs inspection'} />
            </div>
            <div className="space-y-2">
              {inclusion.mainWritableAccounts.slice(0, 4).map((account) => (
                <div key={account.address} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{account.address}</p>
                    {account.signer ? (
                      <Badge variant="outline" className="shrink-0 border-border/70 text-[10px] text-muted-foreground">
                        signer
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{account.source ?? 'transaction'}</p>
                </div>
              ))}
              {!inclusion.mainWritableAccounts.length ? (
                <p className="text-xs text-muted-foreground">Writable account metadata unavailable from RPC.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/55 bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">Repeated program/account activity</p>
            <InclusionConfidenceBadge confidence={repeatedProgramAccountActivity.length ? 'inferred' : 'needs inspection'} />
          </div>
          {repeatedProgramAccountActivity.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {repeatedProgramAccountActivity.slice(0, 4).map((activity) => (
                <div key={`${activity.kind}-${activity.address}`} className="rounded-md border border-border/50 bg-background/35 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{activity.label}</p>
                    <Badge variant="outline" className="border-border/70 text-[10px] text-muted-foreground">
                      {activity.kind}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{activity.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.otherRecentSignatureCount ?? 0} other recent signatures in {activity.recentSignatureCount ?? 0} sampled
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              No repeated program/account activity was available in the small recent-signature scan.
            </p>
          )}
        </div>

        <p className="mt-3 rounded-md border border-sky-300/25 bg-sky-300/[0.04] px-3 py-2 text-xs leading-5 text-sky-100">
          {inclusion.disclaimer}
        </p>
      </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border/60 bg-background/35 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">What happened</p>
              <p className="mt-1 text-xs text-muted-foreground">Observed execution details about how this transaction moved through programs and which accounts it wrote.</p>
            </div>
            <ConfidenceBadge confidence="observed" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Programs Touched
              </p>
              <div className="space-y-2">
                {receipt.programs.slice(0, 6).map((program) => (
                  <div key={program.id} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">{program.label}</p>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{program.instructionCount} ix</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{program.id}</p>
                  </div>
                ))}
                {!receipt.programs.length ? (
                  <p className="text-xs text-muted-foreground">No parsed programs returned by RPC.</p>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Writable Accounts ({receipt.writableAccountCount})
              </p>
              <div className="space-y-2">
                {receipt.writableAccounts.slice(0, 6).map((account) => (
                  <div key={account.address} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{account.address}</p>
                      {account.signer ? (
                        <Badge variant="outline" className="shrink-0 border-border/70 text-[10px] text-muted-foreground">
                          signer
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{account.source ?? 'transaction'}</p>
                  </div>
                ))}
                {!receipt.writableAccounts.length ? (
                  <p className="text-xs text-muted-foreground">Writable account metadata unavailable from RPC.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/35 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Contextual pressure</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Inferred slot and contention context. It is not a documented explanation of this transaction's failure.
              </p>
            </div>
            <ConfidenceBadge confidence={receipt.slotPressure.confidence} />
          </div>
          <div className="grid gap-2">
            {receipt.slotPressure.basis.map((basis) => (
              <div key={basis} className="rounded-md border border-border/55 bg-secondary/20 px-3 py-2 text-xs text-foreground">
                {basis}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-border/50 bg-secondary/20 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Recent tx / slot</p>
              <p className="mt-1 font-mono text-sm text-foreground">{receipt.slotPressure.sample.txPerSlot ?? 'n/a'}</p>
            </div>
            <div className="rounded-md border border-border/50 bg-secondary/20 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Recent non-vote / slot</p>
              <p className="mt-1 font-mono text-sm text-foreground">{receipt.slotPressure.sample.nonVoteTxPerSlot ?? 'n/a'}</p>
            </div>
            <div className="rounded-md border border-border/50 bg-secondary/20 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Recent avg slot ms</p>
              <p className="mt-1 font-mono text-sm text-foreground">{receipt.slotPressure.sample.avgSlotMs ?? 'n/a'}</p>
            </div>
          </div>
        </div>
      </div>

      {showPercolatorLens && lens ? (
        <div className="rounded-lg border border-border/60 bg-background/35 p-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Why this matters</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                This section explains whether this execution path is sensitive to queueing, price freshness, or oracle/risk state.
              </p>
            </div>
            <ConfidenceBadge confidence={lens.whyMarketStructureMayMatter.confidence} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {lensItems.map(([label, item]) => (
              <div key={label} className="rounded-lg border border-border/55 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <SensitivityBadge level={item.level} />
                </div>
                <div className="space-y-1.5">
                  {item.reasons.slice(0, 3).map((reason) => (
                    <p key={reason} className="text-xs leading-5 text-muted-foreground">
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">Why better market structure may matter</p>
              <ConfidenceBadge confidence={lens.whyMarketStructureMayMatter.confidence} />
            </div>
            <p className="text-sm leading-6 text-foreground">
              {lens.whyMarketStructureMayMatter.text}
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-background/35 p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What this means for future transactions</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Plain-English notes that explain how this execution story may matter for similar future transactions.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="rounded-md border border-border/55 bg-secondary/20 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Future implications</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{receiptStory.futureText}</p>
          </div>
          <div className="grid gap-2">
            {whatThisMeans.map((note) => (
              <div key={note.text} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                <div className="mb-1">
                  <ConfidenceBadge confidence={note.confidence} />
                </div>
                <p className="text-xs leading-5 text-foreground">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {whatRemainsUnknown ? (
        <div className="rounded-lg border border-sky-300/30 bg-sky-300/[0.04] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">What remains unknown</p>
            <InclusionConfidenceBadge confidence="needs inspection" />
          </div>
          <p className="text-sm leading-6 text-foreground">{whatRemainsUnknown}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-background/35 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Shareable receipt text</p>
            <p className="mt-1 text-xs text-muted-foreground">Short enough for X, honest enough for builders.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onCopyReceipt} className="w-fit gap-2">
            <Clipboard className="h-4 w-4" />
            {copiedReceipt ? 'Copied' : 'Copy text'}
          </Button>
        </div>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md border border-border/50 bg-background/45 p-3 text-xs leading-5 text-muted-foreground">
          {receiptText}
        </pre>
      </div>
    </div>
  )
}

function CoinTxRow({
  tx,
  onOpenReceipt,
}: {
  tx: CoinActivityTransaction
  onOpenReceipt: (signature: string) => void
}) {
  return (
    <div className="rounded-md border border-border/55 bg-background/35 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold text-foreground">{tx.shortSignature}</p>
            <Badge variant="outline" className="border-border/70 text-[10px] text-muted-foreground">
              {tx.typeHint}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${tx.status === 'failed' ? 'border-rose-400/35 text-rose-200' : 'border-emerald-400/35 text-emerald-200'}`}
            >
              {tx.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatBlockTime(tx.blockTime)} | Fee {formatLamportsValue(tx.feePaidLamports)}
            {tx.computeUnitsConsumed != null ? ` | ${tx.computeUnitsConsumed.toLocaleString()} CUs` : ''}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Movement: {formatTokenValue(tx.tokenDeltaUiAmount)} {tx.tokenDeltaDirection !== 'unknown' ? `(${tx.tokenDeltaDirection})` : ''}
          </p>
          {tx.signals.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tx.signals.slice(0, 4).map((signal) => (
                <Badge key={signal} variant="outline" className="border-border/60 bg-secondary/20 text-[10px] text-muted-foreground">
                  {signal}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenReceipt(tx.signature)}
          className="w-fit shrink-0 gap-2 border-border/70 bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
        >
          Open receipt
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CoinInsightCard({ insight }: { insight: CoinActivityInsight }) {
  return (
    <div className={`rounded-lg border p-4 ${coinInsightTone(insight.level)}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{insight.title}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{insight.label}</p>
        </div>
        <CoinConfidenceBadge confidence={insight.confidence} />
      </div>
      <p className="text-xs leading-5 text-foreground">{insight.text}</p>
      {insight.detail ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{insight.detail}</p>
      ) : null}
    </div>
  )
}

function CoinActivityResult({
  receipt,
  shareUrl,
  copiedCoinReceipt,
  onCopyCoinReceipt,
  onOpenReceipt,
}: {
  receipt: CoinActivityReceipt
  shareUrl: string
  copiedCoinReceipt: boolean
  onCopyCoinReceipt: () => void
  onOpenReceipt: (signature: string) => void
}) {
  const metricItems = [
    ['Observed window', `${receipt.stats.observedTxCount.toLocaleString()} / ${receipt.window.requestedLimit.toLocaleString()}`, receipt.window.confidence],
    ['Success / failed', `${receipt.stats.successCount.toLocaleString()} / ${receipt.stats.failedCount.toLocaleString()}`, 'observed' as CoinReceiptConfidence],
    ['Unique wallets', receipt.stats.uniqueWalletCount.toLocaleString(), 'observed' as CoinReceiptConfidence],
    ['High-fee signals', `${receipt.stats.highFeeSignalCount.toLocaleString()} (${formatPercentValue(receipt.stats.highFeeRatePercent)})`, 'estimated' as CoinReceiptConfidence],
    ['Repeat-wallet signals', receipt.stats.repeatedWalletCount.toLocaleString(), 'estimated' as CoinReceiptConfidence],
    ['Largest movement', formatTokenValue(receipt.stats.largestObservedMovement.uiAmount), receipt.stats.largestObservedMovement.confidence],
  ] as const
  const insightItems = [
    receipt.insights.executionHealth,
    receipt.insights.feePressure,
    receipt.insights.walletParticipation,
    receipt.insights.largestMovement,
    receipt.insights.breadlineSignal,
  ]
  const timelinePreview = receipt.timeline.slice(0, Math.min(15, receipt.timeline.length))

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-background/45 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {receipt.token.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receipt.token.image} alt="" className="h-8 w-8 rounded-full border border-border/60 bg-secondary/30 object-cover" />
              ) : null}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Coin Activity Receipt</p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">
                  {receipt.token.name} {receipt.token.symbol ? `(${receipt.token.symbol})` : ''}
                </h3>
              </div>
              <CoinConfidenceBadge confidence={receipt.token.confidence} />
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground">
              Every coin has a chart. This receipt analyzes a wider observed activity window and translates execution health, fee pressure, wallet participation, movement, and retry-like signals into readable context.
            </p>
            <div className="mt-3 rounded-md border border-border/60 bg-secondary/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold text-foreground">Signal summary</p>
                <CoinConfidenceBadge confidence="estimated" />
              </div>
              <p className="text-sm leading-6 text-foreground">{receipt.signalSummary}</p>
            </div>
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
              CA: {receipt.mint}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={onCopyCoinReceipt} className="gap-2">
              <Clipboard className="h-4 w-4" />
              {copiedCoinReceipt ? 'Copied' : 'Copy'}
            </Button>
            <Button asChild size="sm" className="gap-2">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                Share
                <Share2 className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricItems.map(([label, value, confidence]) => (
          <div key={label} className="rounded-lg border border-border/60 bg-background/45 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <CoinConfidenceBadge confidence={confidence} />
            </div>
            <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {insightItems.map((insight) => (
          <CoinInsightCard key={insight.title} insight={insight} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-border/60 bg-background/35 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Recent activity timeline</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Recent indexed signatures for this mint. Insights use the full observed window; this preview shows up to 15 rows.
              </p>
            </div>
            <CoinConfidenceBadge confidence={receipt.confidence.activity} />
          </div>
          <div className="space-y-2">
            {timelinePreview.map((tx) => (
              <CoinTxRow key={tx.signature} tx={tx} onOpenReceipt={onOpenReceipt} />
            ))}
            {!receipt.timeline.length ? (
              <p className="rounded-md border border-border/55 bg-background/35 p-3 text-xs text-muted-foreground">
                No indexed transactions were returned for this mint window.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-background/35 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Execution signals</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Failed txs, higher fees, compute-heavy paths, and movement hints found across the observed window.
                </p>
              </div>
              <CoinConfidenceBadge confidence={receipt.confidence.executionSignals} />
            </div>
            <div className="space-y-2">
              {receipt.executionSignals.slice(0, 4).map((tx) => (
                <CoinTxRow key={tx.signature} tx={tx} onOpenReceipt={onOpenReceipt} />
              ))}
              {!receipt.executionSignals.length ? (
                <p className="text-xs text-muted-foreground">No strong execution signals in this observed window.</p>
              ) : null}
              {receipt.failedThenLandedRetrySignals.length ? (
                <div className="rounded-md border border-sky-300/25 bg-sky-300/[0.04] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">Failed-then-landed patterns</p>
                    <CoinConfidenceBadge confidence="needs inspection" />
                  </div>
                  <div className="space-y-1.5">
                    {receipt.failedThenLandedRetrySignals.slice(0, 3).map((signal) => (
                      <p key={`${signal.failedSignature}-${signal.landedSignature}`} className="font-mono text-[10px] leading-4 text-muted-foreground">
                        {signal.failedSignature.slice(0, 6)}...{signal.failedSignature.slice(-6)}{' -> '}{signal.landedSignature.slice(0, 6)}...{signal.landedSignature.slice(-6)}
                        {signal.slotDistance != null ? ` | ${signal.slotDistance} slots` : ''}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/35 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wallet participation</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Unique owners, repeated-wallet signals, and top token accounts. This is triage, not full holder analytics.
                </p>
              </div>
              <CoinConfidenceBadge confidence={receipt.confidence.walletSignals} />
            </div>
            <div className="space-y-2">
              {receipt.repeatedWalletSignals.slice(0, 4).map((wallet) => (
                <div key={wallet.owner} className="rounded-md border border-border/55 bg-background/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-xs text-foreground">{wallet.owner}</p>
                    <CoinConfidenceBadge confidence={wallet.confidence} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {wallet.transactionCount} txs | observed movement {formatTokenValue(wallet.totalAbsUiAmount)}
                  </p>
                </div>
              ))}
              {!receipt.repeatedWalletSignals.length ? (
                <p className="text-xs text-muted-foreground">No repeated-wallet signal in this observed window.</p>
              ) : null}
              {receipt.topTokenAccounts.slice(0, 3).map((account) => (
                <div key={account.address} className="rounded-md border border-border/55 bg-secondary/20 p-3">
                  <p className="truncate font-mono text-xs text-foreground">{account.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Top token account: {account.uiAmountString}
                    {account.supplyPct != null ? ` | ${account.supplyPct}% of supply` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sky-300/25 bg-sky-300/[0.04] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">What this means</p>
        <div className="mt-3 space-y-2">
          {receipt.whatThisMeans.map((note) => (
            <div key={note.text} className="rounded-md border border-border/50 bg-background/35 p-3">
              <CoinConfidenceBadge confidence={note.confidence} />
              <p className="mt-2 text-xs leading-5 text-foreground">{note.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/35 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Shareable coin receipt text</p>
            <p className="mt-1 text-xs text-muted-foreground">A concise activity readout, not a price call.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onCopyCoinReceipt} className="w-fit gap-2">
            <Clipboard className="h-4 w-4" />
            {copiedCoinReceipt ? 'Copied' : 'Copy text'}
          </Button>
        </div>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md border border-border/50 bg-background/45 p-3 text-xs leading-5 text-muted-foreground">
          {receipt.shareText}
        </pre>
      </div>
    </div>
  )
}

function TxReceiptPanel({
  params,
  fcfsMetrics,
  mcpMetrics,
}: {
  params: SimulationParams
  fcfsMetrics: Metrics
  mcpMetrics: Metrics
}) {
  const [mode, setMode] = useState<'normal' | 'coin' | 'perps'>('normal')
  const [txInput, setTxInput] = useState('')
  const [receipt, setReceipt] = useState<BreadlinesReceipt | null>(null)
  const [coinMintInput, setCoinMintInput] = useState('')
  const [coinScanWindow, setCoinScanWindow] = useState<(typeof COIN_SCAN_WINDOW_OPTIONS)[number]>(100)
  const [coinReceipt, setCoinReceipt] = useState<CoinActivityReceipt | null>(null)
  const [perpsResult, setPerpsResult] = useState<PerpsResult | null>(null)
  const [activeReceiptView, setActiveReceiptView] = useState<'transaction' | 'coin' | 'perps' | null>(null)
  const [receiptReturnTarget, setReceiptReturnTarget] = useState<'coin' | null>(null)
  const [receiptError, setReceiptError] = useState('')
  const [copiedReceipt, setCopiedReceipt] = useState(false)
  const [copiedCoinReceipt, setCopiedCoinReceipt] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [transferScan, setTransferScan] = useState<HeliusTransferSummary | null>(null)
  const [transferScanError, setTransferScanError] = useState('')
  const [isTransferScanning, setIsTransferScanning] = useState(false)
  const [isLoadingMoreTransfers, setIsLoadingMoreTransfers] = useState(false)

  const receiptText = receipt ? buildReceiptShareText(receipt) : ''
  const shareUrl = receipt
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(receiptText)}`
    : ''
  const coinReceiptText = coinReceipt?.shareText ?? ''
  const coinShareUrl = coinReceipt
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(coinReceiptText)}`
    : ''

  const runReceipt = useCallback(async (rawSignature = txInput, options?: { fromCoin?: boolean }) => {
    const signature = rawSignature.trim()

    if (!SOLANA_SIGNATURE_PATTERN.test(signature)) {
      setReceipt(null)
      setActiveReceiptView(null)
      setReceiptError('Paste a valid Solana transaction signature to generate a receipt.')
      return
    }

    if (!options?.fromCoin) {
      setReceiptReturnTarget(null)
    }
    setReceipt(null)
    setReceiptError('')
    setIsSimulating(true)
    setCopiedReceipt(false)

    try {
      const nextReceipt = await getBreadlinesReceipt(signature)
      setReceipt(nextReceipt)
      setActiveReceiptView('transaction')
    } catch (error) {
      setReceipt(null)
      setActiveReceiptView(null)
      setReceiptError(error instanceof Error ? error.message : 'Unable to build receipt.')
    } finally {
      setIsSimulating(false)
    }
  }, [txInput])

  // On mount, check for ?tx= query param and auto-run receipt if valid
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const txParam = params.get('tx')
      if (txParam && SOLANA_SIGNATURE_PATTERN.test(txParam)) {
        setTxInput(txParam)
        // auto-run after pre-filling
        void runReceipt(txParam)
      }
    } catch (e) {
      // ignore URL parsing errors
    }
  }, [runReceipt])

  // When a receipt is generated, push the tx param into the URL for deep-linking
  useEffect(() => {
    if (!receipt) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tx', receipt.signature)
      window.history.replaceState({}, '', url.toString())
    } catch (e) {
      // ignore
    }
  }, [receipt])

  const runCoinReceipt = useCallback(async (rawMint = coinMintInput, scanWindow = coinScanWindow) => {
    const mint = rawMint.trim()

    if (!SOLANA_ADDRESS_PATTERN.test(mint)) {
      setCoinReceipt(null)
      setActiveReceiptView(null)
      setReceiptError('Paste a valid Solana coin CA to build a coin activity receipt.')
      return
    }

    setCoinReceipt(null)
    setReceiptReturnTarget(null)
    setReceiptError('')
    setIsSimulating(true)
    setCopiedCoinReceipt(false)

    try {
      const nextReceipt = await getCoinActivityReceipt(mint, scanWindow)
      setCoinReceipt(nextReceipt)
      setActiveReceiptView('coin')
    } catch (error) {
      setCoinReceipt(null)
      setActiveReceiptView(null)
      setReceiptError(error instanceof Error ? error.message : 'Unable to build coin activity receipt.')
    } finally {
      setIsSimulating(false)
    }
  }, [coinMintInput, coinScanWindow])

  const handleCopyReceipt = useCallback(async () => {
    if (!receiptText) return

    try {
      await navigator.clipboard.writeText(receiptText)
      setCopiedReceipt(true)
      window.setTimeout(() => setCopiedReceipt(false), 1500)
    } catch {
      setCopiedReceipt(false)
    }
  }, [receiptText])

  const handleCopyCoinReceipt = useCallback(async () => {
    if (!coinReceiptText) return

    try {
      await navigator.clipboard.writeText(coinReceiptText)
      setCopiedCoinReceipt(true)
      window.setTimeout(() => setCopiedCoinReceipt(false), 1500)
    } catch {
      setCopiedCoinReceipt(false)
    }
  }, [coinReceiptText])

  const runPerpsSimulation = useCallback((rawInput = txInput) => {
    const value = rawInput.trim()

    if (!value) {
      setPerpsResult(null)
      setActiveReceiptView(null)
      setReceiptError('Paste a perp tx signature, venue, or use one of the quick examples.')
      return
    }

    setPerpsResult(null)
    setReceiptReturnTarget(null)
    setReceiptError('')
    setIsSimulating(true)

    window.setTimeout(() => {
      setPerpsResult(buildPerpsResult(value, params, fcfsMetrics, mcpMetrics))
      setActiveReceiptView('perps')
      setIsSimulating(false)
    }, 450)
  }, [fcfsMetrics, mcpMetrics, params, txInput])

  const runSimulation = useCallback(() => {
    if (mode === 'normal') {
      runReceipt()
      return
    }

    if (mode === 'coin') {
      runCoinReceipt()
      return
    }

    runPerpsSimulation()
  }, [mode, runCoinReceipt, runPerpsSimulation, runReceipt])

  const openTxReceiptFromCoin = useCallback((signature: string) => {
    setTxInput(signature)
    setReceiptError('')
    setReceiptReturnTarget('coin')
    setActiveReceiptView('transaction')
    void runReceipt(signature, { fromCoin: true })
  }, [runReceipt])

  const scanTransferHistory = useCallback(async (rawAddress = transferAddress) => {
    const address = rawAddress.trim()

    if (!SOLANA_ADDRESS_PATTERN.test(address)) {
      setTransferScan(null)
      setTransferScanError('Paste a valid Solana wallet address, not a transaction signature.')
      return
    }

    setTransferScanError('')
    setIsTransferScanning(true)

    try {
      const scan = await getTransfersByAddress(address)
      setTransferScan(scan)
    } catch (error) {
      setTransferScan(null)
      setTransferScanError(error instanceof Error ? error.message : 'Unable to scan transfer history.')
    } finally {
      setIsTransferScanning(false)
    }
  }, [transferAddress])

  const loadMoreTransferHistory = useCallback(async () => {
    if (!transferScan?.paginationToken) return

    setTransferScanError('')
    setIsLoadingMoreTransfers(true)

    try {
      const nextScan = await getTransfersByAddress(transferScan.address, 25, transferScan.paginationToken)
      setTransferScan((current) => current ? mergeTransferScans(current, nextScan) : nextScan)
    } catch (error) {
      setTransferScanError(error instanceof Error ? error.message : 'Unable to load more transfer history.')
    } finally {
      setIsLoadingMoreTransfers(false)
    }
  }, [transferScan])

  const inputValue = mode === 'coin' ? coinMintInput : txInput
  const inputLabel = mode === 'coin' ? 'Coin CA' : 'Transaction signature'
  const inputPlaceholder =
    mode === 'coin'
      ? 'Paste Solana coin CA'
      : mode === 'normal'
        ? 'Paste Solana tx signature'
        : 'Paste perp tx signature, Drift / Jupiter Perps / Phoenix route'
  const actionLabel =
    mode === 'coin'
      ? 'Build Coin Receipt'
      : mode === 'normal'
        ? 'Build Receipt'
        : 'Run Perps Simulation'

  return (
    <Card id="receipt-builder" className="scroll-mt-24 border-border/70 bg-card/80 shadow-none">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Breadlines Receipts
            </p>
            <CardTitle className="text-xl">
              {mode === 'coin' ? 'Coin Activity Receipt' : mode === 'normal' ? 'Execution Receipt' : 'Perps Sketch'}
            </CardTitle>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {mode === 'normal'
                ? 'Paste a Solana transaction signature. Understand what happened through observed facts, estimated pressure, and conceptual context.'
                : mode === 'coin'
                  ? 'Paste a coin CA. See recent indexed activity, notable movements, failed attempts, and the receipts behind them.'
                : 'A secondary sketch for perps queue sensitivity. It is not a Percolator trading UI.'}
            </p>
          </div>
          <div className="inline-flex w-fit rounded-md border border-border/60 bg-background/55 p-1">
            {[
              ['normal', 'Receipt'],
              ['coin', 'Coin'],
              ['perps', 'Perps sketch'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value as 'normal' | 'coin' | 'perps')
                  setReceiptError('')
                }}
                className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition-all md:px-4 ${
                  mode === value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="rounded-lg border border-border/60 bg-background/45 p-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {inputLabel}
          </label>
          <div className="mt-2 flex flex-col gap-2 lg:flex-row">
          <Input
            value={inputValue}
            onChange={(event) => {
              if (mode === 'coin') {
                setCoinMintInput(event.target.value)
              } else {
                setTxInput(event.target.value)
              }
              setReceiptError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSimulation()
            }}
            placeholder={inputPlaceholder}
            className="h-11 border-border/70 bg-background/70 font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={runSimulation} className="h-11 shrink-0 bg-foreground px-5 text-xs font-semibold text-background hover:bg-foreground/90">
              {isSimulating ? 'Building' : actionLabel}
            </Button>
            {mode === 'normal' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTxInput(SAMPLE_SIGNATURE)
                  runReceipt(SAMPLE_SIGNATURE)
                }}
                className="h-11 shrink-0"
              >
                Sample
              </Button>
            ) : mode === 'coin' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCoinMintInput(SAMPLE_COIN_MINT)
                  void runCoinReceipt(SAMPLE_COIN_MINT)
                }}
                className="h-11 shrink-0"
              >
                Sample
              </Button>
            ) : null}
          </div>
          </div>
        </div>

        {mode === 'coin' ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/35 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Scan window
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Analyze recent indexed txs. Result lists stay readable, but metrics use the selected window.
              </p>
            </div>
            <div className="inline-flex w-fit rounded-md border border-border/60 bg-background/55 p-1">
              {COIN_SCAN_WINDOW_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCoinScanWindow(option)}
                  className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition-all ${
                    coinScanWindow === option
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mode === 'perps' ? (
          <div className="flex flex-wrap gap-2">
            {PERP_EXAMPLES.map((example) => (
              <Button
                key={example.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTxInput(example.value)
                  setReceiptError('')
                }}
                className="border-border/70 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              >
                {example.label}
              </Button>
            ))}
          </div>
        ) : null}

        {mode === 'normal' ? (
          <div className="rounded-lg border border-border/60 bg-background/35 p-3">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Receipt Examples
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Three real mainnet signatures for smoke-testing observed, estimated, and conceptual labels.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-border/70 text-muted-foreground">
                Casebook-ready
              </Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {RECEIPT_EXAMPLES.map((example) => (
                <button
                  key={example.value}
                  type="button"
                  onClick={() => {
                    setTxInput(example.value)
                    setReceiptError('')
                    void runReceipt(example.value)
                  }}
                  disabled={isSimulating}
                  className="rounded-md border border-border/60 bg-background/45 px-3 py-2 text-left transition hover:border-border hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block text-xs font-semibold text-foreground">{example.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{example.note}</span>
                  <span className="mt-2 block truncate font-mono text-[10px] text-muted-foreground">
                    {example.value.slice(0, 8)}...{example.value.slice(-8)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mode === 'coin' ? (
          <div className="rounded-lg border border-border/60 bg-background/35 p-3">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Coin Receipt Examples
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start with a built-in example, or paste any Solana coin CA.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-border/70 text-muted-foreground">
                Casebook-ready
              </Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {COIN_EXAMPLES.map((example) => (
                <button
                  key={example.value}
                  type="button"
                  onClick={() => {
                    setCoinMintInput(example.value)
                    setReceiptError('')
                    void runCoinReceipt(example.value)
                  }}
                  disabled={isSimulating}
                  className="rounded-md border border-border/60 bg-background/45 px-3 py-2 text-left transition hover:border-border hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block text-xs font-semibold text-foreground">{example.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                    {example.note}
                  </span>
                  <span className="mt-2 block truncate font-mono text-[10px] text-muted-foreground">
                    {example.value.slice(0, 8)}...{example.value.slice(-8)}
                  </span>
                </button>
              ))}
              <div className="rounded-md border border-border/60 bg-background/25 px-3 py-2">
                <span className="block text-xs font-semibold text-foreground">Any Solana CA</span>
                <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                  Paste a CA and Breadlines will build the same observed/estimated/unclear activity receipt.
                </span>
                <span className="mt-2 block text-[10px] text-muted-foreground">
                  No price call. No safety rating. Just the execution story.
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <details className="group rounded-lg border border-border/60 bg-background/25 p-3">
          <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Optional wallet flow scan
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                Secondary tool for scanning wallet transfers. The receipt builder above is the primary flow.
              </p>
            </div>
            <span className="inline-flex h-8 w-fit items-center rounded-md border border-border/70 bg-secondary/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-secondary/70 hover:text-foreground">
              Secondary
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Helius Transfer Intel
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Bring real wallet flow into the simulator. Scan parsed transfer rows, then see where queue-heavy activity becomes breadline-sensitive.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-border/70 text-muted-foreground">
                Real flow lens
              </Badge>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row">
              <Input
                value={transferAddress}
                onChange={(event) => {
                  setTransferAddress(event.target.value)
                  setTransferScanError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') scanTransferHistory()
                }}
                placeholder="Paste wallet address to scan real flow"
                className="h-11 border-border/70 bg-background/70 font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => scanTransferHistory()}
                  className="h-11 shrink-0 gap-2 border-border/70 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  disabled={isTransferScanning}
                >
                  {isTransferScanning ? 'Scanning' : 'Scan History'}
                  <Activity className={`h-4 w-4 ${isTransferScanning ? 'animate-pulse' : ''}`} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTransferAddress(SAMPLE_TRANSFER_ADDRESS)
                    setTransferScanError('')
                  }}
                  className="h-11 shrink-0"
                >
                  Sample
                </Button>
              </div>
            </div>

            {transferScanError ? (
              <p className="text-xs text-destructive">{transferScanError}</p>
            ) : null}

            {transferScan ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Transfer rows', transferScan.stats.transferRows],
                    ['Unique txs', transferScan.stats.uniqueTransactions],
                    ['Token-2022 fees', transferScan.stats.token2022FeeRows],
                    ['Queue-sensitive rows', transferScan.stats.batchedSignatureRows],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border/55 bg-secondary/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-foreground">Latest real wallet flow</p>
                    {transferScan.paginationToken ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={loadMoreTransferHistory}
                        disabled={isLoadingMoreTransfers}
                        className="h-8 border-border/70 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      >
                        {isLoadingMoreTransfers ? 'Loading more' : 'Load more history'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    {transferScan.transfers.slice(0, 3).map((transfer, index) => (
                      <div key={`${transfer.signature}-${index}`} className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/35 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {transfer.type ?? 'transfer'} {transfer.uiAmount ? `- ${transfer.uiAmount}` : ''}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {transfer.signature.slice(0, 8)}...{transfer.signature.slice(-8)}
                          </p>
                        </div>
                        <p className="max-w-full truncate font-mono text-[10px] text-muted-foreground sm:max-w-[220px]">
                          {transfer.mint ?? 'native SOL'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </details>

        {receiptError ? (
          <p className="text-xs text-destructive">{receiptError}</p>
        ) : null}

        <Dialog
          open={activeReceiptView !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActiveReceiptView(null)
              setReceiptReturnTarget(null)
            }
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="max-h-[90vh] overflow-hidden border-border/70 bg-background/95 p-0 sm:max-w-[min(1120px,94vw)]"
          >
            <DialogTitle className="sr-only">
              {activeReceiptView === 'coin'
                ? 'Coin activity receipt'
                : activeReceiptView === 'perps'
                  ? 'Perps sketch'
                  : 'Execution receipt'}
            </DialogTitle>
            <div className="flex flex-col gap-3 border-b border-border/60 bg-card/90 p-4 pr-12 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Breadlines result
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {activeReceiptView === 'coin'
                    ? 'Coin Activity Receipt'
                    : activeReceiptView === 'perps'
                      ? 'Perps Sketch'
                      : 'Execution Receipt'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeReceiptView === 'transaction' && receiptReturnTarget === 'coin'
                    ? 'Close this view to return to the builder, or go back to the coin activity receipt.'
                    : 'Close this view to return to the builder.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeReceiptView === 'transaction' && receiptReturnTarget === 'coin' && coinReceipt ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveReceiptView('coin')
                      setReceiptReturnTarget(null)
                    }}
                    className="w-fit border-border/70 bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
                  >
                    Back to coin receipt
                  </Button>
                ) : null}
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit border-border/70 bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
                  >
                    Close
                  </Button>
                </DialogClose>
              </div>
            </div>
            <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-4 sm:p-5">
              {activeReceiptView === 'transaction' ? (
                receipt ? (
                  <ReceiptResult
                    receipt={receipt}
                    receiptText={receiptText}
                    shareUrl={shareUrl}
                    copiedReceipt={copiedReceipt}
                    onCopyReceipt={handleCopyReceipt}
                  />
                ) : (
                  <div className="rounded-lg border border-border/60 bg-background/45 p-6 text-sm text-muted-foreground">
                    Building transaction receipt...
                  </div>
                )
              ) : null}

              {activeReceiptView === 'coin' ? (
                coinReceipt ? (
                  <CoinActivityResult
                    receipt={coinReceipt}
                    shareUrl={coinShareUrl}
                    copiedCoinReceipt={copiedCoinReceipt}
                    onCopyCoinReceipt={handleCopyCoinReceipt}
                    onOpenReceipt={openTxReceiptFromCoin}
                  />
                ) : (
                  <div className="rounded-lg border border-border/60 bg-background/45 p-6 text-sm text-muted-foreground">
                    Building coin activity receipt...
                  </div>
                )
              ) : null}

              {activeReceiptView === 'perps' ? (
                perpsResult ? (
                  <PerpsSketchResult result={perpsResult} />
                ) : (
                  <div className="rounded-lg border border-border/60 bg-background/45 p-6 text-sm text-muted-foreground">
                    Building perps sketch...
                  </div>
                )
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  )
}

// Protocol Column Component
function ProtocolColumn({ 
  title, 
  subtitle,
  mode, 
  metrics, 
  params,
  postFeeWorld,
  twoSlotsPerLeader,
  color,
  isActive
}: { 
  title: string
  subtitle: string
  mode: 'fcfs' | 'batching' | 'mcp'
  metrics: Metrics
  params: SimulationParams
  postFeeWorld: boolean
  twoSlotsPerLeader: boolean
  color: string
  isActive: boolean
}) {
  const latencyData = generateLatencyData(metrics, mode)
  const chartDomain = getChartDomain(mode)
  const showOracleEdge = mode === 'mcp' || metrics.oracleLatencyEdge > 0
  const fcfsPulseDuration = Math.max(0.45, 1.8 - params.spamVolume / 70)
  
  const getTrend = (value: number, thresholds: [number, number], inverse: boolean = false): 'good' | 'bad' | 'neutral' => {
    if (inverse) {
      if (value >= thresholds[1]) return 'good'
      if (value <= thresholds[0]) return 'bad'
      return 'neutral'
    }
    if (value <= thresholds[0]) return 'good'
    if (value >= thresholds[1]) return 'bad'
    return 'neutral'
  }

  return (
    <Card 
      className="flex-1 border-2 transition-all duration-300 overflow-hidden"
      style={{ 
        borderColor: `${color}40`,
        background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle 
              className="text-base font-bold"
              style={{ color }}
            >
              {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            {mode === 'fcfs' ? (
              <StatusDot color="#ff4444" label="Stale Prices" pulse pulseDuration={fcfsPulseDuration} />
            ) : mode === 'mcp' ? (
              <StatusDot color="#22ff88" label="Fresh Prices" />
            ) : null}
          </div>
          <Badge 
            variant="outline" 
            className="text-[10px]"
            style={{ borderColor: color, color }}
          >
            {mode.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {postFeeWorld && mode === 'mcp' ? (
          <div className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            Structure Wins - Latency + Fairness Dominate
          </div>
        ) : null}
        {postFeeWorld && mode === 'fcfs' ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            Fees Can&apos;t Save You Here
          </div>
        ) : null}
        {twoSlotsPerLeader && mode === 'mcp' ? (
          <div className="rounded-lg border border-primary/40 bg-primary/8 px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Concurrent Proposer Lanes
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-md border border-primary/40 bg-primary/10 p-2">
                <div className="mb-1 h-2 w-8 rounded-full bg-primary/70" />
                <div className="space-y-1">
                  <div className="h-2 rounded bg-primary/25" />
                  <div className="h-2 rounded bg-primary/40" />
                  <div className="h-2 rounded bg-primary/25" />
                </div>
              </div>
              <div className="flex-1 rounded-md border border-primary/40 bg-primary/10 p-2">
                <div className="mb-1 h-2 w-8 rounded-full bg-primary/70" />
                <div className="space-y-1">
                  <div className="h-2 rounded bg-primary/40" />
                  <div className="h-2 rounded bg-primary/25" />
                  <div className="h-2 rounded bg-primary/40" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {mode === 'mcp' ? <OrderingIndicator replayPriority={params.replayPriority} /> : null}

        {/* Transaction Race Visualization */}
        <div className="rounded-lg overflow-hidden border border-border/50">
          <TransactionRace mode={mode} params={params} metrics={metrics} isActive={isActive} />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 gap-2">
          <MetricCard 
            label="Wait Time" 
            value={metrics.avgInclusionLatency} 
            unit="ms" 
            icon={Clock}
            trend={getTrend(metrics.avgInclusionLatency, [100, 300])}
            color={color}
          />
          <MetricCard 
            label="Txs Blocked" 
            value={metrics.percentCensored} 
            unit="%" 
            icon={Ban}
            trend={getTrend(metrics.percentCensored, [10, 40])}
            color={color}
          />
          <MetricCard 
            label="Oracle Edge" 
            value={showOracleEdge ? metrics.oracleLatencyEdge : '—'} 
            unit={showOracleEdge ? 'ms' : ''} 
            icon={TrendingUp}
            trend={showOracleEdge ? getTrend(Math.max(0, metrics.oracleLatencyEdge), [20, 60], true) : undefined}
            color={color}
            muted={!showOracleEdge}
          />
          <MetricCard 
            label="Price Staleness" 
            value={metrics.oracleStaleness}
            unit="ms" 
            icon={Clock}
            trend={getTrend(metrics.oracleStaleness, [40, 100])}
            color={mode === 'fcfs' && metrics.oracleStaleness > 100 ? '#ff4444' : color}
          />
          <MetricCard 
            label="Market Cost" 
            value={metrics.effectiveSpread} 
            unit="bp" 
            icon={Activity}
            trend={getTrend(metrics.effectiveSpread, [10, 30])}
            color={color}
          />
        </div>

        {/* Latency Distribution Chart */}
        <div className="h-[100px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={latencyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis 
                dataKey="bucket" 
                tick={{ fontSize: 9, fill: '#666680' }} 
                axisLine={{ stroke: '#2a2a3a' }}
                tickLine={false}
              />
              <YAxis hide domain={chartDomain} />
              <RechartsTooltip 
                contentStyle={{ 
                  background: '#0f0f18', 
                  border: `1px solid ${color}40`,
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#e5e5e5' }}
                itemStyle={{ color }}
              />
              <Bar 
                dataKey="count" 
                fill={color} 
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

type Insight = {
  id: string
  content: React.ReactNode
}

// Insights Generator - returns array of insights for cycling
function generateInsights(
  params: SimulationParams,
  fcfsMetrics: Metrics,
  mcpMetrics: Metrics,
  postFeeWorld: boolean,
  twoSlotsPerLeader: boolean,
): Insight[] {
  const insights: Array<Insight | string> = []
  
  if (params.replayPriority > 0) {
    insights.push({
      id: 'oracle-edge',
      content: (
        <>
          MCP gives oracles a <HighlightValue>{Math.round(mcpMetrics.oracleLatencyEdge)}ms</HighlightValue> edge vs FCFS&apos;s{' '}
          <HighlightValue>{Math.round(fcfsMetrics.avgInclusionLatency)}ms</HighlightValue> wait - at only {params.replayPriority} lamport extra
        </>
      ),
    })
  }
  
  if (params.spamVolume > 50) {
    insights.push({
      id: 'spam-bread-line',
      content: (
        <>
          FCFS turns into a Soviet bread line under spam - <HighlightValue>{Math.round(fcfsMetrics.percentCensored)}%</HighlightValue> of transactions blocked while MCP holds at{' '}
          <HighlightValue>{Math.round(mcpMetrics.percentCensored)}%</HighlightValue>
        </>
      ),
    })
  }
  
  if (params.enable200ms) {
    insights.push({
      id: 'future-slots',
      content: (
        <>
          200ms slots are on: MCP still keeps wait time to <HighlightValue>{Math.round(mcpMetrics.avgInclusionLatency)}ms</HighlightValue> despite tighter competition windows
        </>
      ),
    })
  }

  if (params.priorityFee < 0.1) {
    insights.push({
      id: 'future-of-finance',
      content: <>When median priority fee &lt; 0.001, latency & fairness dominate → MCP wins hard. This is the future of finance.</>,
    })
  }

  if (false && false && params.priorityFee < 0.1) {
    insights.push('At near-zero priority fees, latency + fairness dominate — this is why MCP is critical for the future of finance.')
  }
  
  if (mcpMetrics.effectiveSpread < fcfsMetrics.effectiveSpread / 3) {
    insights.push({
      id: 'market-cost',
      content: <>Market cost drops from {Math.round(fcfsMetrics.effectiveSpread)}bp in FCFS to {Math.round(mcpMetrics.effectiveSpread)}bp in MCP</>,
    })
  }

  if (params.propAMMMode) {
    insights.push({
      id: 'prop-amm',
      content: (
        <>
          PropAMM is active: MCP is pairing a <HighlightValue>{Math.round(mcpMetrics.oracleLatencyEdge)}ms</HighlightValue> oracle edge with {Math.round(mcpMetrics.effectiveSpread)}bp market cost
        </>
      ),
    })
  }

  if (params.replayPriority >= 1) {
    insights.push({
      id: 'replay-priority',
      content: <>1 lamport replay priority = oracle lands first in every batch frame. That&apos;s the whole trick.</>,
    })
  }

  if (postFeeWorld) {
    insights.push({
      id: 'post-fee-world',
      content: <>In a post-fee world, MCP&apos;s structural advantage is the ONLY edge left. FCFS has nothing.</>,
    })
  }

  if (twoSlotsPerLeader) {
    insights.push({
      id: 'two-slots-per-leader',
      content: <>2 slots per leader + MCP = concurrent proposers racing to fill blocks. FCFS can&apos;t compete with parallel execution.</>,
    })
  }

  if (params.replayPriority === 0) {
    insights.push({
      id: 'round-robin-merge',
      content: <>FCFS still lives inside MCP — same-priority txs use round-robin merge. Composable by design.</>,
    })
  }

  insights.push({
    id: 'oracle-freshness',
    content: (
      <>
        Under FCFS, takers execute against prices that are <HighlightValue>{fcfsMetrics.oracleStaleness}ms</HighlightValue> stale - that&apos;s basis points leaking from every trade. MCP keeps oracle freshness within{' '}
        <HighlightValue>{mcpMetrics.oracleStaleness}ms</HighlightValue>.
      </>
    ),
  })

  insights.push({
    id: 'toly-line',
    content: <>MCP and fba == markets; fcfs == bread lines - Toly</>,
  })

  return insights as Insight[]
}

// Main Dashboard Component
export default function Breadlines() {
  const [params, setParams] = useState<SimulationParams>({
    blockTime: 400,
    enable200ms: false,
    priorityFee: 1,
    replayPriority: 1,
    spamVolume: 30,
    propAMMMode: false,
    liveSolanaData: false,
  })
  
  const [insightIndex, setInsightIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [postFeeWorld, setPostFeeWorld] = useState(false)
  const [twoSlotsPerLeader, setTwoSlotsPerLeader] = useState(false)
  const [isLiveSyncing, setIsLiveSyncing] = useState(false)
  const livePollRef = useRef<number | null>(null)
  const ca = '8cLSy3rjyCuVzzE1PuQ7AwALQNERrTZx9T8R52pRpump'

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ca)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }, [ca])

  const fcfsMetrics = simulateBlock(params, 'fcfs')
  const batchingMetrics = simulateBlock(params, 'batching')
  const mcpMetrics = simulateBlock(params, 'mcp')

  const insights = generateInsights(params, fcfsMetrics, mcpMetrics, postFeeWorld, twoSlotsPerLeader)
  const insight = insights[insightIndex % insights.length]
  
  // Cycle through insights client-side only
  useEffect(() => {
    const interval = setInterval(() => {
      setInsightIndex(i => i + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Cycle through Toly quotes
  const quotes = [
    "MCP and fba == markets; fcfs == bread lines",
    "Multiple Concurrent Proposers BLVD",
    "The future of Solana is parallel execution",
    "Latency is the enemy of fair markets"
  ]
  const [quoteIndex, setQuoteIndex] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(i => (i + 1) % quotes.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!postFeeWorld) return

    setParams((p) => ({
      ...p,
      priorityFee: 0.0001,
    }))
  }, [postFeeWorld])

  useEffect(() => {
    if (!twoSlotsPerLeader) return

    setParams((p) => ({
      ...p,
      blockTime: 200,
      enable200ms: true,
    }))
  }, [twoSlotsPerLeader])

  useEffect(() => {
    const syncLiveSolanaData = async () => {
      setIsLiveSyncing(true)

      try {
        const { spamVolume, priorityFee } = await getLiveData()

        console.log('[Live Solana Data] Applying live values', {
          spamVolume,
          priorityFee,
        })

        setParams((p) => ({
          ...p,
          spamVolume: Math.round(Math.max(0, Math.min(100, spamVolume))),
          priorityFee: postFeeWorld ? 0.0001 : Number(Math.max(0.001, Math.min(10, priorityFee)).toFixed(3)),
        }))
      } catch (error) {
        console.error('Failed to sync live Solana data from Helius', error)
      } finally {
        setIsLiveSyncing(false)
      }
    }

    if (!params.liveSolanaData) {
      if (livePollRef.current) {
        window.clearInterval(livePollRef.current)
        livePollRef.current = null
      }

      setIsLiveSyncing(false)
      return
    }

    syncLiveSolanaData()

    livePollRef.current = window.setInterval(() => {
      syncLiveSolanaData()
    }, 10000)

    return () => {
      if (livePollRef.current) {
        window.clearInterval(livePollRef.current)
        livePollRef.current = null
      }
    }
  }, [params.liveSolanaData, postFeeWorld])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                <span className="text-destructive">Bread</span>
                <span className="text-primary">lines</span>
              </h1>
              <div className="mt-1">
                <p className="text-sm text-foreground">Your Solana transaction did something you didn't expect here's why.</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Paste a Solana transaction. Understand what happened.</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="border-border/70 bg-transparent text-muted-foreground"
                      >
                        MCP &gt; MPC
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                      Multiple Concurrent Proposers, not multi-party computation
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Execution receipts for Solana. Observed facts first.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="bg-foreground px-4 text-background hover:bg-foreground/90">
                <a href="#receipt-builder">
                  Build Receipt
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-6">
        <TxReceiptPanel params={params} fcfsMetrics={fcfsMetrics} mcpMetrics={mcpMetrics} />

        <details className="group mt-6 border-t border-border/60 pt-4">
          <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Model Lab</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional simulator for FCFS, batching, and MCP assumptions.
              </p>
            </div>
            <span className="inline-flex h-8 w-fit items-center rounded-md border border-border/70 bg-secondary/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-secondary/70 hover:text-foreground group-open:hidden">
              Open
            </span>
            <span className="hidden h-8 w-fit items-center rounded-md border border-border/70 bg-secondary/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-secondary/70 hover:text-foreground group-open:inline-flex">
              Hide
            </span>
          </summary>

          <p className="mt-3 text-sm text-muted-foreground">This simulates how a Solana transaction's wait time and fees change depending on how the network orders transactions — try the sliders below.</p>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row">
          {/* Sidebar Controls */}
          <aside className="w-full lg:w-72 shrink-0">
            <Card className="sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Lab controls
                  {params.liveSolanaData ? (
                    <Badge
                      variant="outline"
                      className={`ml-1 border-primary/60 bg-primary/10 text-primary ${isLiveSyncing ? 'animate-pulse' : 'animate-pulse'}`}
                    >
                      Live
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Assumptions note */}
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground leading-relaxed space-y-1">
                  <p className="font-semibold text-primary uppercase tracking-widest">Model Assumptions</p>
                  <p>Spam filter identical across FCFS &amp; MCP</p>
                  <p>MCP latency = end-of-batch + ~100ms pipeline</p>
                  <p className="text-muted-foreground/60 pt-0.5">
                    Updated May 6 2026 — symmetric spam + end-of-batch MCP latency per{' '}
                    <a
                      href="https://twitter.com/moonshiesty"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary/60 hover:text-primary"
                    >
                      @moonshiesty
                    </a>
                  </p>
                </div>
                {/* Block Time */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Block Time</label>
                    <span className="text-xs text-primary font-mono">{params.blockTime}ms</span>
                  </div>
                  <Slider
                    value={[params.blockTime]}
                    onValueChange={([v]) => setParams(p => ({ ...p, blockTime: v }))}
                    min={200}
                    max={800}
                    step={50}
                    disabled={twoSlotsPerLeader}
                    className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-xs text-muted-foreground">Enable 200ms Future Slots</label>
                    <Switch
                      checked={params.enable200ms}
                      onCheckedChange={(v) => setParams(p => ({ ...p, enable200ms: v }))}
                      disabled={twoSlotsPerLeader}
                    />
                  </div>
                </div>

                {/* Replay Priority */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Oracle Replay Priority</label>
                    <span className="text-xs text-primary font-mono">{params.replayPriority} lamports</span>
                  </div>
                  <Slider
                    value={[params.replayPriority]}
                    onValueChange={([v]) => setParams(p => ({ ...p, replayPriority: v }))}
                    min={0}
                    max={10}
                    step={1}
                    className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground">1 lamport advantage for oracle updates</p>
                </div>

                {/* Priority Fee */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Median Priority Fee</label>
                    <span className="text-xs text-primary font-mono">
                      {formatLamports(params.priorityFee)} lamports
                    </span>
                  </div>
                  <Slider
                    value={[params.priorityFee]}
                    onValueChange={([v]) => setParams(p => ({ ...p, priorityFee: v }))}
                    min={0.001}
                    max={10}
                    step={0.001}
                    disabled={params.liveSolanaData || postFeeWorld}
                    className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary"
                  />
                  <p className="text-[10px] text-muted-foreground">Future of Finance Mode</p>
                </div>

                {/* Spam Volume */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Spam / Adversarial %</label>
                    <span className="text-xs text-destructive font-mono">{params.spamVolume}%</span>
                  </div>
                  <Slider
                    value={[params.spamVolume]}
                    onValueChange={([v]) => setParams(p => ({ ...p, spamVolume: v }))}
                    min={0}
                    max={100}
                    step={5}
                    disabled={params.liveSolanaData}
                    className="[&_[data-slot=slider-range]]:bg-destructive [&_[data-slot=slider-thumb]]:border-destructive"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">PropAMM Mode</label>
                    <Switch
                      checked={params.propAMMMode}
                      onCheckedChange={(v) => setParams(p => ({ ...p, propAMMMode: v }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Post-Fee World</label>
                      <Switch
                        checked={postFeeWorld}
                        onCheckedChange={setPostFeeWorld}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Priority fees → 0. Only structure wins.</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm">2 Slots per Leader</label>
                      <Switch
                        checked={twoSlotsPerLeader}
                        onCheckedChange={setTwoSlotsPerLeader}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">200ms blocks â€” Toly&apos;s mandate</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Live Solana Data</label>
                    <Switch
                      checked={params.liveSolanaData}
                      onCheckedChange={(v) => setParams(p => ({ ...p, liveSolanaData: v }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </aside>

          {/* Main Content */}
          <main className="flex-1 space-y-6">
            {/* Protocol Comparison Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ProtocolColumn
                title="FCFS"
                subtitle="Bread Lines"
                mode="fcfs"
                metrics={fcfsMetrics}
                params={params}
                postFeeWorld={postFeeWorld}
                twoSlotsPerLeader={twoSlotsPerLeader}
                color="#ff4444"
                isActive
              />
              <ProtocolColumn
                title="Basic Batching"
                subtitle="Neutral Zone"
                mode="batching"
                metrics={batchingMetrics}
                params={params}
                postFeeWorld={postFeeWorld}
                twoSlotsPerLeader={twoSlotsPerLeader}
                color="#666680"
                isActive
              />
              <ProtocolColumn
                title="MCP + FBO"
                subtitle="Markets"
                mode="mcp"
                metrics={mcpMetrics}
                params={params}
                postFeeWorld={postFeeWorld}
                twoSlotsPerLeader={twoSlotsPerLeader}
                color="#22ff88"
                isActive
              />
            </div>

            {/* Insights Panel */}
            <Card className="border-border/60 bg-card/60">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary mb-1">Live Insight</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={insight.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-sm text-foreground"
                      >
                        {insight.content}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Toly Quote */}
            <Card className="border-border/60 bg-card/60 overflow-hidden relative">
              <CardContent className="py-6 relative">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Toly Says</p>
                  <AnimatePresence mode="wait">
                    <motion.blockquote
                      key={quoteIndex}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="text-lg md:text-xl font-medium italic"
                    >
                      {`"${quotes[quoteIndex]}"`}
                    </motion.blockquote>
                  </AnimatePresence>
                  <p className="text-xs text-muted-foreground mt-3">— Anatoly Yakovenko, Solana Co-founder</p>
                </div>
              </CardContent>
            </Card>
          </main>
          </div>
        </details>

        <footer className="mt-8">
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Project Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Breadlines is an independent Solana execution receipts project.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Special thanks to{' '}
                <a
                  href="https://twitter.com/moonshiesty"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary/70 hover:text-primary transition-colors"
                >
                  @moonshiesty
                </a>{' '}
                for the model review.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="text-xs"
                >
                  {copied ? 'Copied' : 'Copy CA'}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="text-xs"
                >
                  <a
                    href="https://pump.fun/coin/8cLSy3rjyCuVzzE1PuQ7AwALQNERrTZx9T8R52pRpump"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on pump.fun
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </footer>
      </div>
    </div>
  )
}
