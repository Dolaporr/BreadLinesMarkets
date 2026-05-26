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
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  Bot, 
  Activity,
  Lock,
  Gift,
  Megaphone,
  Repeat2,
  Users,
  ArrowUpRight,
  Clipboard,
  FileText,
  Share2
} from 'lucide-react'
import { simulateBlock, type SimParams as SimulationParams, type SimResult as Metrics } from '@/lib/simulateBlock'
import { getLiveData, getTransfersByAddress, type HeliusTransferSummary } from '@/lib/helius'

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
          boxShadow: `0 0 10px ${color}`,
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
              className="border-primary/60 bg-transparent text-primary shadow-[0_0_12px_rgba(34,255,136,0.18)]"
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

function BuildSprintPanel() {
  const txIntent = encodeURIComponent(
    'Drop a Solana tx for the Breadlines public sim. Show me the Soviet queue vs MCP.\n\n$BREADLINES'
  )

  const sprintItems = [
    {
      icon: Users,
      label: 'Open community lane',
      text: 'Build in public first, then plug into aligned communities as the dialogue gets real.',
    },
    {
      icon: Repeat2,
      label: 'Creator rewards flywheel',
      text: 'Route part of creator rewards into market buys, community rewards, and simulator campaigns.',
    },
    {
      icon: Gift,
      label: 'Claim-based rewards',
      text: 'Reward people who help test receipts, share useful sims, and join weekly bagworking.',
    },
    {
      icon: Megaphone,
      label: 'Breadlinesbot upgrade',
      text: 'Move the bot from content noise to tx roasts, sim receipts, and weekly missions.',
    },
  ]

  return (
    <Card className="overflow-hidden border-primary/35 bg-primary/5">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
          <div className="border-b border-primary/15 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/60 bg-primary/10 text-primary">
                Breadlines Open Sprint
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-card/40 text-muted-foreground">
                Community Flywheel
              </Badge>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Turn the tweet into a working community flywheel.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              First move: build in public, reward real participation, and make Breadlines the simulation layer people can point to when the Solana queue debate heats up.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${txIntent}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Drop a tx for sim
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <a
                  href="https://pump.fun/coin/8cLSy3rjyCuVzzE1PuQ7AwALQNERrTZx9T8R52pRpump"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View coin
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-1">
            {sprintItems.map(({ icon: Icon, label, text }) => (
              <div key={label} className="rounded-lg border border-border/60 bg-card/45 p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      {label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const SAMPLE_SIGNATURE = '3zYxWvUtSrQpNmLkJhGfEdCbA98765432123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const SAMPLE_TRANSFER_ADDRESS = '86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY'
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
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
const QUICK_TESTS = [
  {
    label: 'Try Normal Swap',
    mode: 'normal',
    value: SAMPLE_SIGNATURE,
  },
  {
    label: 'Try Drift Perp',
    mode: 'perps',
    value: PERP_EXAMPLES[0].value,
  },
  {
    label: 'Try Jupiter Perps',
    mode: 'perps',
    value: PERP_EXAMPLES[1].value,
  },
] as const

type TxReceipt = {
  signature: string
  shortSignature: string
  spamAhead: number
  fcfsRank: number
  mcpRank: number
  fcfsWait: number
  mcpWait: number
  savedMs: number
  marketCostSaved: number
  heat: 'Clean' | 'Crowded' | 'Breadline'
}

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

function hashString(value: string) {
  let hash = 2166136261

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function makeShortSignature(signature: string) {
  return `${signature.slice(0, 6)}...${signature.slice(-6)}`
}

function buildTxReceipt(signature: string, params: SimulationParams, fcfsMetrics: Metrics, mcpMetrics: Metrics): TxReceipt {
  const hash = hashString(signature)
  const jitter = (hash % 1000) / 1000
  const spamAhead = Math.max(1, Math.round(params.spamVolume * 0.82 + (hash % 31) + jitter * 12))
  const fcfsWait = Math.max(1, Math.round(fcfsMetrics.avgInclusionLatency + spamAhead * 1.65 + (hash % 45)))
  const mcpWait = Math.max(1, Math.round(mcpMetrics.avgInclusionLatency + (hash % 19) - 6))
  const savedMs = Math.max(0, fcfsWait - mcpWait)
  const marketCostSaved = Math.max(0, Math.round((fcfsMetrics.effectiveSpread - mcpMetrics.effectiveSpread) * 100) / 100)
  const heat: TxReceipt['heat'] = spamAhead > 70 ? 'Breadline' : spamAhead > 35 ? 'Crowded' : 'Clean'

  return {
    signature,
    shortSignature: makeShortSignature(signature),
    spamAhead,
    fcfsRank: spamAhead + 1 + (hash % 18),
    mcpRank: Math.max(1, 1 + (hash % 6)),
    fcfsWait,
    mcpWait,
    savedMs,
    marketCostSaved,
    heat,
  }
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
    mcpMessage: 'No queue. No slippage tax. No surprise liquidations.',
  }
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
  const [mode, setMode] = useState<'normal' | 'perps'>('normal')
  const [txInput, setTxInput] = useState('')
  const [receipt, setReceipt] = useState<TxReceipt | null>(null)
  const [perpsResult, setPerpsResult] = useState<PerpsResult | null>(null)
  const [receiptError, setReceiptError] = useState('')
  const [copiedReceipt, setCopiedReceipt] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [transferScan, setTransferScan] = useState<HeliusTransferSummary | null>(null)
  const [transferScanError, setTransferScanError] = useState('')
  const [isTransferScanning, setIsTransferScanning] = useState(false)

  const receiptText = receipt
    ? `Breadlines receipt for ${receipt.shortSignature}\n\n${receipt.spamAhead} spam txs were modeled ahead of this tx.\nFCFS rank: #${receipt.fcfsRank} / ${receipt.fcfsWait}ms\nMCP rank: #${receipt.mcpRank} / ${receipt.mcpWait}ms\nMCP saved ~${receipt.savedMs}ms and ${receipt.marketCostSaved}bp market cost.\n\n$BREADLINES`
    : ''
  const shareUrl = receipt
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(receiptText)}`
    : ''

  const runReceipt = useCallback((rawSignature = txInput) => {
    const signature = rawSignature.trim()

    if (!SOLANA_SIGNATURE_PATTERN.test(signature)) {
      setReceipt(null)
      setReceiptError('Paste a valid Solana transaction signature to generate a receipt.')
      return
    }

    setReceipt(buildTxReceipt(signature, params, fcfsMetrics, mcpMetrics))
    setReceiptError('')
    setCopiedReceipt(false)
  }, [fcfsMetrics, mcpMetrics, params, txInput])

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

  const runPerpsSimulation = useCallback((rawInput = txInput) => {
    const value = rawInput.trim()

    if (!value) {
      setPerpsResult(null)
      setReceiptError('Paste a perp tx signature, venue, or use one of the quick examples.')
      return
    }

    setReceiptError('')
    setIsSimulating(true)

    window.setTimeout(() => {
      setPerpsResult(buildPerpsResult(value, params, fcfsMetrics, mcpMetrics))
      setIsSimulating(false)
    }, 450)
  }, [fcfsMetrics, mcpMetrics, params, txInput])

  const runSimulation = useCallback(() => {
    if (mode === 'normal') {
      runReceipt()
      return
    }

    runPerpsSimulation()
  }, [mode, runPerpsSimulation, runReceipt])

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

  return (
    <Card className="border-primary/30 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Breadline Simulator
            </CardTitle>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {mode === 'normal'
                ? 'Paste a Solana tx signature and generate a shareable simulator receipt for the current breadline versus the MCP path.'
                : 'Paste a perp tx, venue, or route and model how FCFS queue drama turns into MCP market structure.'}
            </p>
          </div>
          <div className="inline-flex w-fit rounded-full border border-primary/25 bg-background/70 p-1">
            {[
              ['normal', 'Normal Tx Simulator'],
              ['perps', 'Perps in the Breadline'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value as 'normal' | 'perps')
                  setReceiptError('')
                }}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all md:px-4 ${
                  mode === value
                    ? 'bg-yellow-400 text-black shadow-[0_0_18px_rgba(250,204,21,0.25)]'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <Input
            value={txInput}
            onChange={(event) => {
              setTxInput(event.target.value)
              setReceiptError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSimulation()
            }}
            placeholder={mode === 'normal' ? 'Paste Solana tx signature' : 'Paste perp tx signature, Drift / Jupiter Perps / Phoenix route'}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={runSimulation} className="h-11 shrink-0 gap-2 bg-yellow-400 px-5 text-xs font-bold uppercase tracking-[0.12em] text-black hover:bg-yellow-300">
              {isSimulating ? 'Simulating' : mode === 'normal' ? 'Run Simulation' : 'Run Perps Simulation'}
              <Zap className={`h-4 w-4 ${isSimulating ? 'animate-pulse' : ''}`} />
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
            ) : null}
          </div>
        </div>

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
                className="border-yellow-400/30 text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100"
              >
                {example.label}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/[0.04] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-200">
                Quick Test
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Prefill a realistic route and run the sim without hunting for a tx.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TESTS.map((test) => (
                <Button
                  key={test.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMode(test.mode)
                    setTxInput(test.value)
                    setReceiptError('')
                  }}
                  className="border-yellow-400/30 text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100"
                >
                  {test.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Helius Transfer Intel
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Bring real wallet flow into the simulator. Scan parsed transfer rows, then see where queue-heavy activity becomes breadline-sensitive.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/50 text-primary">
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
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => scanTransferHistory()}
                  className="h-11 shrink-0 gap-2 border-primary/40 text-primary hover:bg-primary/10"
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
                    <div key={label} className="rounded-lg border border-primary/20 bg-background/40 p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-semibold text-primary">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-foreground">Latest real wallet flow</p>
                    {transferScan.paginationToken ? (
                      <Badge variant="outline" className="border-yellow-400/40 text-yellow-200">
                        More history available
                      </Badge>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    {transferScan.transfers.slice(0, 3).map((transfer, index) => (
                      <div key={`${transfer.signature}-${index}`} className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/35 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold text-primary">
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
        </div>

        {receiptError ? (
          <p className="text-xs text-destructive">{receiptError}</p>
        ) : null}

        {mode === 'normal' && receipt ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Spam Ahead</p>
                <p className="mt-1 text-2xl font-semibold text-destructive">{receipt.spamAhead}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">FCFS Wait</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{receipt.fcfsWait}ms</p>
              </div>
              <div className="rounded-lg border border-primary/35 bg-primary/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">MCP Wait</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{receipt.mcpWait}ms</p>
              </div>
              <div className="rounded-lg border border-primary/35 bg-primary/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Time Saved</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{receipt.savedMs}ms</p>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary">{receipt.shortSignature}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground">
                    Modeled as <span className="font-semibold text-destructive">{receipt.heat}</span>: FCFS rank #{receipt.fcfsRank}, MCP rank #{receipt.mcpRank}, with ~{receipt.marketCostSaved}bp market cost saved.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyReceipt} className="gap-2">
                    <Clipboard className="h-4 w-4" />
                    {copiedReceipt ? 'Copied' : 'Copy'}
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
          </div>
        ) : null}

        {mode === 'perps' && perpsResult ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-yellow-400/50 bg-yellow-400/10 text-yellow-200">
                Detected: {perpsResult.venue}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Dummy model for now. Real tx parsing comes next.
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
                      Soviet Breadline
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">FCFS when the perp trade is already sweating.</p>
                  </div>
                  <Badge variant="outline" className="border-destructive/50 text-destructive">
                    Queue tax
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {[
                    ['Blocks waited', perpsResult.blocksWaited],
                    ['Spammers that cut you', perpsResult.spammersCut],
                    ['Slippage paid', perpsResult.slippagePaid],
                    ['Liq risk up', perpsResult.liqRisk],
                    ['Extra funding exposure', perpsResult.fundingExposure],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-background/40 px-3 py-2">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="font-mono text-sm font-semibold text-destructive">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      MCP World
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Concurrent proposer lanes. Actual market vibes.</p>
                  </div>
                  <Badge variant="outline" className="border-primary/60 text-primary">
                    Clean fill
                  </Badge>
                </div>
                <div className="rounded-lg border border-primary/30 bg-background/40 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Instant fill time</p>
                  <p className="mt-2 text-4xl font-bold text-primary">{perpsResult.fillTime}</p>
                  <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                    {perpsResult.mcpMessage}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
          <div className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-[0_0_20px_rgba(34,255,136,0.2)]">
            Structure Wins - Latency + Fairness Dominate
          </div>
        ) : null}
        {postFeeWorld && mode === 'fcfs' ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive shadow-[0_0_20px_rgba(255,68,68,0.18)]">
            Fees Can&apos;t Save You Here
          </div>
        ) : null}
        {twoSlotsPerLeader && mode === 'mcp' ? (
          <div className="rounded-lg border border-primary/40 bg-primary/8 px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Concurrent Proposer Lanes
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-md border border-primary/40 bg-primary/10 p-2 shadow-[0_0_16px_rgba(34,255,136,0.16)]">
                <div className="mb-1 h-2 w-8 rounded-full bg-primary/70" />
                <div className="space-y-1">
                  <div className="h-2 rounded bg-primary/25" />
                  <div className="h-2 rounded bg-primary/40" />
                  <div className="h-2 rounded bg-primary/25" />
                </div>
              </div>
              <div className="flex-1 rounded-md border border-primary/40 bg-primary/10 p-2 shadow-[0_0_16px_rgba(34,255,136,0.16)]">
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
export default function BreadLinesMarkets() {
  const [params, setParams] = useState<SimulationParams>({
    blockTime: 400,
    enable200ms: false,
    priorityFee: 1,
    replayPriority: 1,
    spamVolume: 30,
    propAMMMode: false,
    liveSolanaData: false,
  })
  
  const [isLocked, setIsLocked] = useState(false)
  const [botHover, setBotHover] = useState(false)
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
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                <span className="text-destructive text-glow-red">Bread</span>
                <span className="text-primary text-glow-green">Lines</span>
                <span className="text-foreground">Markets</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  <span className="text-primary">MCP + FBO == Markets</span>
                  {' | '}
                  <span className="text-destructive">FCFS == Bread Lines</span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="border-primary bg-transparent text-primary shadow-[0_0_12px_rgba(34,255,136,0.18)]"
                    >
                      MCP &gt; MPC
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    Multiple Concurrent Proposers — not multi-party computation
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {"Visualizing Toly's vision — Multiple Concurrent Proposers BLVD"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={isLocked ? "default" : "outline"}
                className={`gap-2 transition-all ${isLocked ? 'neon-green-glow' : ''}`}
                onMouseEnter={() => setBotHover(true)}
                onMouseLeave={() => setBotHover(false)}
                onClick={() => setIsLocked(!isLocked)}
              >
                <motion.div
                  animate={botHover ? { rotate: [0, -10, 10, -10, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {isLocked ? <Lock className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </motion.div>
                {isLocked ? 'Locked In' : 'Lock In'}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 border-yellow-400/35 bg-yellow-400/5 text-yellow-200 transition-all hover:-translate-y-0.5 hover:border-yellow-400/70 hover:bg-yellow-400/10 hover:text-yellow-100 hover:shadow-[0_0_18px_rgba(250,204,21,0.16)]"
                  >
                    <Megaphone className="h-4 w-4" />
                    Open Sprint
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] overflow-y-auto border-primary/35 bg-background/95 p-0 sm:max-w-4xl">
                  <DialogTitle className="sr-only">Breadlines Open Sprint</DialogTitle>
                  <BuildSprintPanel />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Changelog Banner */}
      <div className="border-b border-primary/20 bg-primary/5">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            <Badge variant="outline" className="border-primary/60 text-primary shrink-0 text-[10px]">
              v2 updates live
            </Badge>
            <span className="text-foreground/80 font-medium">
              <a
                href="https://twitter.com/moonshiesty"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @moonshiesty
              </a>{' '}
              feedback shipped
            </span>
            <span className="hidden sm:inline text-border/60">·</span>
            <span className="text-muted-foreground">FCFS: low/near-zero latency for high-fee txs (ideal streaming)</span>
            <span className="hidden sm:inline text-border/60">·</span>
            <span className="text-muted-foreground">MCP: ~150ms latency tax but wins on burst resistance, oracle freshness &amp; tighter spreads</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs mt-1">
            <span className="text-foreground/70 font-medium italic">FCFS is fast but fragile. MCP pays for real market structure.</span>
            <span className="hidden sm:inline text-border/60">·</span>
            <span className="text-muted-foreground/70">Still waiting on full pfee/drop/burstiness math from{' '}
              <a
                href="https://twitter.com/moonshiesty"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary"
              >
                @moonshiesty
              </a>
            </span>
            <span className="hidden sm:inline text-border/60">·</span>
            <span className="text-muted-foreground/70">Live Helius data every 10s</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Controls */}
          <aside className="w-full lg:w-72 shrink-0">
            <Card className="sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Simulation Controls
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
            <TxReceiptPanel params={params} fcfsMetrics={fcfsMetrics} mcpMetrics={mcpMetrics} />

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
                isActive={!isLocked}
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
                isActive={!isLocked}
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
                isActive={!isLocked}
              />
            </div>

            {/* Insights Panel */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
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
            <Card className="border-border/30 bg-card/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-destructive/5" />
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

        <footer className="mt-8">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Support the Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Support by buying some $breadlines.
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
                  {copied ? 'Copied' : 'Copy Address'}
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
                    Trade on pump.fun
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
