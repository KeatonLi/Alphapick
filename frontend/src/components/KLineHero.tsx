import { useState, useEffect, useMemo } from 'react'

/* ── 生成模拟 K 线数据 ── */
interface Candle {
  x: number; open: number; close: number; high: number; low: number;
  bodyY: number; bodyH: number; wickY1: number; wickY2: number;
  isUp: boolean;
}
function generateCandles(count: number, width: number, height: number, paddingTop: number): Candle[] {
  const candles: Candle[] = []
  const usableH = height - paddingTop - 40
  const stepX = width / (count + 1)
  const mapY = (p: number) => paddingTop + (44 - p) / (44 - 30) * usableH

  // 上升趋势路径：筑底 → 突破 → 浅回调 → 再突破
  const trend = [
    // phase, startPrice, endPrice, upBias
    [ 0,  8, 30, 32, 0.55],  // 筑底
    [ 8, 16, 32, 39, 0.85],  // 放量突破
    [16, 21, 39, 38, 0.45],  // 浅回调（绿柱区，但跌不深）
    [21, 28, 38, 43, 0.80],  // 再次突破创新高
  ]

  let price = 30
  for (const [start, end, tStart, tEnd, upBias] of trend) {
    const segLen = (end as number) - (start as number)
    for (let i = 0; i < segLen; i++) {
      const progress = i / segLen
      const targetPrice = (tStart as number) + ((tEnd as number) - (tStart as number)) * progress
      const drift = (targetPrice - price) * 0.6 + (Math.random() - 0.5) * 1.2
      const isUp = Math.random() < (upBias as number)

      const open = price
      const close = isUp ? open + Math.abs(drift) + Math.random() * 0.6 : open - Math.abs(drift) - Math.random() * 0.3
      const high = Math.max(open, close) + Math.random() * 1.2
      const low = Math.min(open, close) - Math.random() * 1.2

      const bodyTop = mapY(Math.max(open, close))
      const bodyBot = mapY(Math.min(open, close))
      const bodyH = Math.max(bodyBot - bodyTop, 1)

      candles.push({
        x: ((start as number) + i + 1) * stepX,
        open, close, high, low,
        bodyY: bodyTop,
        bodyH,
        wickY1: mapY(high),
        wickY2: mapY(low),
        isUp: close >= open,
      })

      price = close
    }
  }

  return candles
}

/* ── 网格线 ── */
function GridLines({ width, height, paddingTop }: { width: number; height: number; paddingTop: number }) {
  const lines = []
  const usableH = height - paddingTop - 40
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (usableH / 4) * i
    lines.push(
      <line key={`h-${i}`} x1={0} y1={y} x2={width} y2={y}
        stroke="var(--border-default)" strokeWidth={0.5} strokeDasharray="4 4" />
    )
    lines.push(
      <text key={`t-${i}`} x={8} y={y - 6} fill="var(--text-dim)" fontSize={10}
        fontFamily="JetBrains Mono, monospace">
        {(44 - i * 3.5).toFixed(0)}
      </text>
    )
  }
  return <g className="kline-grid" style={{ opacity: 0, animation: 'fadeInUp .6s .5s cubic-bezier(.16,1,.3,1) forwards' }}>{lines}</g>
}

/* ── 粒子 ── */
function Particles({ count, width, height }: { count: number; width: number; height: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      cx: Math.random() * width,
      cy: Math.random() * height,
      r: 1 + Math.random() * 2,
      delay: Math.random() * 1.5,
      duration: 2 + Math.random() * 3,
      drift: (Math.random() - 0.5) * 60,
    })), [count, width, height])

  return (
    <g>
      {particles.map(p => (
        <circle key={p.id} cx={p.cx} cy={p.cy} r={p.r}
          fill="var(--accent-light)" opacity={0}
          style={{
            animation: `particleFloat ${p.duration}s ${p.delay}s ease-in-out infinite`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </g>
  )
}

/* ═══════════════════════ 主组件 ═══════════════════════ */
export default function KLineHero() {
  const [mounted, setMounted] = useState(false)
  const W = 720; const H = 360; const PT = 20
  const candles = useMemo(() => generateCandles(28, W, H, PT), [])

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 760, margin: '0 auto' }}>
      {/* 图表发光背景 */}
      <div style={{
        position: 'absolute', inset: '-60px -40px',
        background: 'radial-gradient(ellipse at 65% 50%, var(--accent-glow) 0%, transparent 60%)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity .8s ease',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* SVG 图表 */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%', height: 'auto',
          transform: mounted ? 'translateX(0) scale(1)' : 'translateX(120px) scale(0.85)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.9s cubic-bezier(0.16, 1, 0.15, 1), opacity 0.5s ease',
          filter: mounted ? 'none' : 'blur(8px)',
        }}
      >
        {/* 网格 */}
        <GridLines width={W} height={H} paddingTop={PT} />

        {/* K 线蜡烛 — 逐个飞入 */}
        {candles.map((c, i) => {
          const w = Math.max((W / 28) * 0.55, 4)
          const color = c.isUp ? 'var(--up)' : 'var(--down)'
          const fillColor = c.isUp ? 'var(--up)' : 'var(--down)'
          const animDelay = 0.35 + i * 0.04

          return (
            <g key={i}
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(30px)',
                transition: `opacity .3s ${animDelay}s ease, transform .5s ${animDelay}s cubic-bezier(.34,1.56,.64,1)`,
              }}
            >
              {/* 影线 */}
              <line x1={c.x} y1={c.wickY1} x2={c.x} y2={c.wickY2}
                stroke={color} strokeWidth={1} opacity={0.7} />
              {/* 实体 */}
              <rect
                x={c.x - w / 2} y={c.bodyY}
                width={w} height={c.bodyH}
                rx={1.5}
                fill={fillColor}
                opacity={0.85}
              />
              {/* 实体高光 */}
              {c.bodyH > 3 && (
                <rect
                  x={c.x - w / 2 + 1} y={c.bodyY}
                  width={w * 0.35} height={c.bodyH}
                  rx={1}
                  fill="rgba(255,255,255,0.15)"
                />
              )}
            </g>
          )
        })}

        {/* 浮动粒子 */}
        <Particles count={15} width={W} height={H} />

      </svg>

      {/* 底部渐变遮罩 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
        background: 'linear-gradient(to top, var(--bg-page), transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
