/**
 * SankeyDiagram.tsx — Beautiful cargo flow visualization.
 *
 * Origin → Transit → Destination, with smooth curved links, gradient fills,
 * node shadows, and interactive tooltips.  Link width is proportional to
 * total kilograms moved.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface SankeyNode {
  name: string
  category: 'origin' | 'transit' | 'destination'
}

interface SankeyLink {
  source: number
  target: number
  value: number
}

interface LayoutNode {
  name: string
  category: string
  x0: number; y0: number; x1: number; y1: number
}

interface LayoutLink {
  source: LayoutNode
  target: LayoutNode
  value: number
  width: number
}

const CATEGORY_COLORS: Record<string, string> = {
  origin: '#0f2d5e',
  transit: '#f5801e',
  destination: '#22c55e',
}

function sankeyLayout(
  nodes: SankeyNode[],
  links: SankeyLink[],
  width: number,
  height: number,
) {
  const PAD = 60; const NODE_W = 20
  const colCount = Math.max(...nodes.map(nd => {
    if (nd.category === 'origin') return 1; if (nd.category === 'transit') return 2; return 3
  }))
  const colWidth = (width - PAD * 2) / (colCount - 1 || 1)
  const cols: LayoutNode[][] = [[], [], []]

  nodes.forEach((nd) => {
    const ci = nd.category === 'origin' ? 0 : nd.category === 'transit' ? 1 : 2
    const x = PAD + ci * colWidth
    cols[ci].push({ name: nd.name, category: nd.category, x0: x, x1: x + NODE_W, y0: 0, y1: 0 })
  })

  // Compute node heights proportional to total flow through each node
  const nodeFlow = new Map<number, number>()
  links.forEach(l => {
    nodeFlow.set(l.source, (nodeFlow.get(l.source) ?? 0) + l.value)
    nodeFlow.set(l.target, (nodeFlow.get(l.target) ?? 0) + l.value)
  })

  const layoutNodes: LayoutNode[] = []
  cols.forEach(col => {
    const totalFlow = col.reduce((s, nd) => s + (nodeFlow.get(nodes.indexOf(nd as unknown as SankeyNode)) ?? 0), 0) || 1
    const availH = height - PAD * 2
    let y = PAD
    col.forEach(ln => {
      const idx = nodes.findIndex(n => n.name === ln.name)
      const flow = nodeFlow.get(idx) ?? 1
      const h = Math.max((flow / totalFlow) * availH, 20)
      ln.y0 = y; ln.y1 = y + h; y += h + 8
      layoutNodes.push(ln)
    })
  })

  // Build layout links
  const layoutLinks: LayoutLink[] = links.map(l => {
    const srcNode = layoutNodes.find(n => n.name === nodes[l.source]?.name)
    const tgtNode = layoutNodes.find(n => n.name === nodes[l.target]?.name)
    if (!srcNode || !tgtNode) return null!
    const maxLinkVal = Math.max(...links.map(ll => ll.value), 1)
    const width = Math.max((l.value / maxLinkVal) * 30, 2)
    return { source: srcNode, target: tgtNode, value: l.value, width }
  }).filter(Boolean)

  return { nodes: layoutNodes, links: layoutLinks }
}

function linkPath(src: LayoutNode, tgt: LayoutNode): string {
  const sx = src.x1, sy = (src.y0 + src.y1) / 2
  const tx = tgt.x0, ty = (tgt.y0 + tgt.y1) / 2
  const dx = tx - sx
  const cx1 = sx + dx * 0.4; const cx2 = tx - dx * 0.4
  return `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tx} ${ty}`
}

export default function SankeyDiagram() {
  const [data, setData] = useState<{ nodes: SankeyNode[]; links: SankeyLink[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredFlow, setHoveredFlow] = useState<{ src: string; tgt: string; val: number } | null>(null)

  useEffect(() => {
    apiClient.get<{ nodes: SankeyNode[]; links: SankeyLink[] }>('/api/v1/analytics/sankey/')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load flow data'))
      .finally(() => setLoading(false))
  }, [])

  const layout = useMemo(() => {
    if (!data) return null
    return sankeyLayout(data.nodes, data.links, 960, 540)
  }, [data])

  const totalKg = useMemo(() => {
    if (!data) return 0
    return data.links.reduce((s, l) => s + l.value, 0)
  }, [data])

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-96 text-red-500 text-sm">{error}</div>
  )
  if (!layout) return (
    <div className="flex items-center justify-center h-96 text-gray-400 text-sm">No flow data yet</div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Cargo Flow: Origin → Transit → Destination
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Flow width proportional to kilograms moved · Total: {(totalKg / 1000).toFixed(1)}t
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-white/40">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="capitalize">{cat}</span>
              </div>
            ))}
          </div>
        </div>

        <svg viewBox="0 0 960 540" className="w-full h-auto" style={{ maxHeight: 500 }}>
          {/* Definitions for gradients and filters */}
          <defs>
            <filter id="nodeShadow" x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx={0} dy={1} stdDeviation={2} floodOpacity={0.15} />
            </filter>
            <linearGradient id="linkGradOrigin" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={CATEGORY_COLORS.origin} stopOpacity={0.5} />
              <stop offset="100%" stopColor={CATEGORY_COLORS.transit} stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="linkGradDest" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={CATEGORY_COLORS.transit} stopOpacity={0.5} />
              <stop offset="100%" stopColor={CATEGORY_COLORS.destination} stopOpacity={0.5} />
            </linearGradient>
          </defs>

          {/* Links (curved paths) */}
          {layout.links.map((l, i) => {
            const srcCat = l.source.category
            const isOrigin = srcCat === 'origin'
            const gradientId = isOrigin ? 'linkGradOrigin' : 'linkGradDest'
            const isHovered = hoveredFlow?.src === l.source.name && hoveredFlow?.tgt === l.target.name
            return (
              <g key={i}>
                <path
                  d={linkPath(l.source, l.target)}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={isHovered ? l.width + 3 : l.width}
                  strokeOpacity={isHovered ? 0.9 : hoveredFlow ? 0.15 : 0.55}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredFlow({ src: l.source.name, tgt: l.target.name, val: l.value })}
                  onMouseLeave={() => setHoveredFlow(null)}
                />
                {/* Invisible wider hit area for easier hover */}
                <path
                  d={linkPath(l.source, l.target)}
                  fill="none" stroke="transparent" strokeWidth={Math.max(l.width, 8)}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredFlow({ src: l.source.name, tgt: l.target.name, val: l.value })}
                  onMouseLeave={() => setHoveredFlow(null)}
                />
              </g>
            )
          })}

          {/* Tooltip */}
          {hoveredFlow && (
            <g transform={`translate(${470}, ${20})`}>
              <rect x={-80} y={0} width={160} height={40} rx={8}
                fill="#111c2d" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <text x={0} y={18} textAnchor="middle" fill="white" fontSize={11} fontWeight={600}>
                {hoveredFlow.src} → {hoveredFlow.tgt}
              </text>
              <text x={0} y={33} textAnchor="middle" fill="#f5801e" fontSize={10} fontWeight={700}>
                {(hoveredFlow.val / 1000).toFixed(1)} t
              </text>
            </g>
          )}

          {/* Nodes */}
          {layout.nodes.map((n, i) => {
            const color = CATEGORY_COLORS[n.category] ?? '#6b7280'
            const isSrc = hoveredFlow?.src === n.name || hoveredFlow?.tgt === n.name
            return (
              <g key={i} filter="url(#nodeShadow)">
                <rect
                  x={n.x0} y={n.y0}
                  width={n.x1 - n.x0} height={Math.max(n.y1 - n.y0, 1)}
                  rx={6} fill={color}
                  opacity={hoveredFlow && !isSrc ? 0.35 : 1}
                  className="transition-opacity duration-200"
                />
                <text
                  x={n.category === 'destination' ? n.x0 - 8 : n.x1 + 8}
                  y={(n.y0 + n.y1) / 2 + 4}
                  textAnchor={n.category === 'destination' ? 'end' : 'start'}
                  fill={isSrc ? color : 'currentColor'}
                  fontSize={11} fontWeight={isSrc ? 600 : 400}
                  className={isSrc ? 'fill-current' : 'fill-gray-500 dark:fill-white/50'}
                  style={{ dominantBaseline: 'middle' }}
                >
                  {n.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </motion.div>
  )
}
