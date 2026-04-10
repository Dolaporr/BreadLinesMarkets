'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  Lock
} from 'lucide-react'
import { simulateBlock, type SimParams as SimulationParams, type SimResult as Metrics } from '@/lib/simulateBlock'
import { getLivePriorityFee, getLiveSpamPercent } from '@/lib/helius'

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

// Protocol Column Component
function ProtocolColumn({ 
  title, 
  subtitle,
  mode, 
  metrics, 
  params,
  color,
  isActive
}: { 
  title: string
  subtitle: string
  mode: 'fcfs' | 'batching' | 'mcp'
  metrics: Metrics
  params: SimulationParams
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
function generateInsights(params: SimulationParams, fcfsMetrics: Metrics, mcpMetrics: Metrics): Insight[] {
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

  const insights = generateInsights(params, fcfsMetrics, mcpMetrics)
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
    const syncLiveSolanaData = async () => {
      setIsLiveSyncing(true)

      try {
        const [liveSpam, liveFee] = await Promise.all([
          getLiveSpamPercent(),
          getLivePriorityFee(),
        ])

        console.log('[Live Solana Data] Applying live values', {
          spamVolume: liveSpam,
          priorityFee: liveFee,
        })

        setParams((p) => ({
          ...p,
          spamVolume: Math.round(Math.max(0, Math.min(100, liveSpam))),
          priorityFee: Number(Math.max(0.001, Math.min(10, liveFee)).toFixed(3)),
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
  }, [params.liveSolanaData])

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
          </div>
        </div>
      </header>

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
                    className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-xs text-muted-foreground">Enable 200ms Future Slots</label>
                    <Switch
                      checked={params.enable200ms}
                      onCheckedChange={(v) => setParams(p => ({ ...p, enable200ms: v }))}
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
                    disabled={params.liveSolanaData}
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
                color="#ff4444"
                isActive={!isLocked}
              />
              <ProtocolColumn
                title="Basic Batching"
                subtitle="Neutral Zone"
                mode="batching"
                metrics={batchingMetrics}
                params={params}
                color="#666680"
                isActive={!isLocked}
              />
              <ProtocolColumn
                title="MCP + FBO"
                subtitle="Markets"
                mode="mcp"
                metrics={mcpMetrics}
                params={params}
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
