import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api'
import KLineHero from '../components/KLineHero'

/* ── 通用 Hook ── */
function useReveal(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el) } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function CountUp({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [n, setN] = useState(0)
  const elRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = elRef.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.unobserve(el)
      const dur = 1200; const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1)
        setN((1 - Math.pow(1 - p, 4)) * value)
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])
  return <span ref={elRef}>{decimals > 0 ? n.toFixed(decimals) : Math.round(n)}{suffix}</span>
}

/* ── 渐现区块 ── */
function RevealBlock({ children, className = '', style = {}, delay = 0, dir = 'up' }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number; dir?: 'up' | 'right'
}) {
  const { ref, visible } = useReveal(0.2)
  const tx = dir === 'right' ? '60px' : '0'
  const ty = dir === 'up' ? '40px' : '0'
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translate(0, 0)' : `translate(${tx}, ${ty})`,
      transition: `all .8s ${delay}ms cubic-bezier(.16,1,.3,1)`,
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════ */
export default function HomePage() {
  const [stats, setStats] = useState<{ reportDays: number; recCount: number; winRate: number; avgReturn?: number } | null>(null)
  const [heroReady, setHeroReady] = useState(false)

  useEffect(() => {
    Promise.all([apiGet<any>('/report/dates?days=90'), apiGet<any>('/recommend/stats')])
      .then(([rep, rec]) => {
        if (rep.success || rec.success) setStats({
          reportDays: rep.success ? (rep.data?.length || 0) : 0,
          recCount: rec.success ? (rec.data?.total || 0) : 0,
          winRate: rec.success ? (rec.data?.win_rate || 0) : 0,
          avgReturn: rec.success ? (rec.data?.avg_return || 0) : 0,
        })
      }).catch(() => {})
    setHeroReady(true)
  }, [])

  const { ref: sRef, visible: sv } = useReveal(0.3)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* ═══════ HERO ═══════ */}
      <section style={{ padding: '36px 16px 0', maxWidth: 1024, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 18px',
          borderRadius: 100, fontSize: 12, fontWeight: 500,
          background: 'var(--accent-bg)', border: '1px solid var(--border-accent)',
          color: 'var(--accent-light)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all .5s .1s ease',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--down)', boxShadow: '0 0 8px var(--down)' }} />
          AI 量化引擎 · 实时运行中
        </div>

        <h1 style={{
          fontSize: 'clamp(38px, 6.5vw, 68px)', fontWeight: 800, letterSpacing: '-0.04em',
          lineHeight: 1.08, margin: '18px 0 10px',
          opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all .6s .2s ease',
        }}>
          <span className="hero-gradient">QuantForge</span>
        </h1>
        <p style={{
          fontSize: 'clamp(13px, 1.6vw, 16px)', color: 'var(--text-secondary)',
          maxWidth: 480, margin: '0 auto 4px',
          opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all .6s .3s ease',
        }}>
          AI 驱动的 A 股量化分析平台
        </p>

        <div style={{
          margin: '12px 0 0',
          opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all .7s .25s ease',
        }}>
          <KLineHero />
        </div>
      </section>

      {/* ═══════ 数据亮点 ═══════ */}
      {stats && (
        <div ref={sRef} style={{
          display: 'flex', justifyContent: 'center', gap: 'clamp(28px, 7vw, 64px)',
          padding: '36px 16px 28px', maxWidth: 900, margin: '0 auto',
          opacity: sv ? 1 : 0, transform: sv ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all .7s ease',
        }}>
          {[
            { label: '历史报告', v: stats.reportDays, c: 'var(--accent)', s: ' 天' },
            { label: '累计推荐', v: stats.recCount, c: 'var(--accent-light)', s: ' 只' },
            { label: '胜率', v: Math.round(stats.winRate), c: 'var(--up)', s: '%' },
            { label: '平均收益', v: stats.avgReturn ?? 0, c: 'var(--down)', s: '%', d: 2 },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div className="mono" style={{
                fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800,
                color: m.c, lineHeight: 1.1,
              }}>
                <CountUp value={m.v} suffix={m.s} decimals={m.d || 0} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '.04em', fontWeight: 500 }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ 价值主张 ═══════ */}
      <RevealBlock dir="right" delay={100}>
        <div style={{
          maxWidth: 800, margin: '0 auto', padding: '60px 24px 40px', textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 700,
            letterSpacing: '-0.03em', lineHeight: 1.25, marginBottom: 16,
            color: 'var(--text-primary)',
          }}>
            让<span style={{ color: 'var(--accent-light)' }}>量化</span>为你创造财富
          </div>
          <p style={{
            fontSize: 'clamp(14px, 1.5vw, 17px)', color: 'var(--text-secondary)',
            maxWidth: 520, margin: '0 auto', lineHeight: 1.7,
          }}>
            不用盯盘、不用手算、不用凭感觉 —— 策略每天自动扫描候选池，
            从 <strong style={{ color: 'var(--accent-light)' }}>50+</strong> 候选股中打分排序
            <strong style={{ color: 'var(--accent-light)' }}> 5 只</strong> 最优标的
          </p>
        </div>
      </RevealBlock>

      {/* ═══════ 三步致富 ═══════ */}
      <div style={{
        maxWidth: 960, margin: '0 auto', padding: '0 16px 40px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20,
      }}>
        {[
          { step: '01', icon: '⚡', title: '每日数据快照', sub: '收盘后采集候选池<br/>行情与关键因子', color: 'var(--accent)' },
          { step: '02', icon: '🎯', title: '量化打分排序', sub: '查看综合分、排名<br/>和入选因子解释', color: 'var(--accent-light)' },
          { step: '03', icon: '📈', title: '收益窗口复盘', sub: '3/5/7 日持仓跟踪<br/>历史胜率数据可视化', color: 'var(--down)' },
        ].map((item, i) => {
          const { ref, visible } = useReveal(0.3)
          return (
            <div key={item.step} ref={ref} style={{
              padding: '32px 24px', borderRadius: 24, textAlign: 'center',
              background: 'var(--bg-card)',
              backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid var(--border-default)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.92)',
              transition: `all .6s ${i * 0.12}s cubic-bezier(.34,1.56,.64,1)`,
            }}>
              <div className="mono" style={{
                fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em',
                color: item.color, opacity: 0.15, marginBottom: -8, lineHeight: 1,
                userSelect: 'none',
              }}>{item.step}</div>
              <div style={{ fontSize: 36, marginBottom: 12, position: 'relative', zIndex: 1 }}>{item.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: item.sub }} />
            </div>
          )
        })}
      </div>

      {/* ═══════ 量化流水线 ═══════ */}
      <RevealBlock dir="right" delay={200}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', marginBottom: 8,
            }}>
              AI 量化流水线
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              从海量数据到交易决策，全自动无人干预
            </p>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(8px, 2vw, 16px)',
          }}>
            {[
              { label: 'THS 选股池', sub: '500+ 候选', color: 'var(--accent)' },
              { label: '热度排名', sub: 'Top 50', color: 'var(--accent-light)' },
              { label: '技术筛选', sub: '多头排列', color: 'var(--blue)' },
              { label: '消息分析', sub: 'AI 解读', color: 'var(--accent-light)' },
              { label: '精选 5 只', sub: '最优标的', color: 'var(--down)' },
            ].map((n, i, arr) => (
              <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '16px 20px', borderRadius: 16, textAlign: 'center',
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                  border: '1px solid var(--border-default)',
                  minWidth: 100,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {n.label}
                  </div>
                  <div style={{ fontSize: 11, color: n.color, fontWeight: 600 }}>{n.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ fontSize: 16, color: 'var(--text-dim)', fontWeight: 300 }}>→</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link to="/settings" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 32px', borderRadius: 100, fontSize: 15, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', textDecoration: 'none',
              boxShadow: '0 8px 32px var(--accent-glow)',
              transition: 'all .25s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 12px 40px var(--accent-glow)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px var(--accent-glow)' }}
            >
              🚀 开始生成推荐
            </Link>
          </div>
        </div>
      </RevealBlock>

      {/* ═══════ 底部 ═══════ */}
      <div style={{ textAlign: 'center', padding: '20px 16px 40px' }}>
        <div style={{
          display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 32px',
          fontSize: 12, color: 'var(--text-dim)',
        }}>
          <span>📡 同花顺 + 东方财富 + 腾讯财经</span>
          <span>🤖 DeepSeek V4</span>
          <span>⚡ 全流程 ~7 秒</span>
          <span>🛡️ 数据仅供参考，不构成投资建议</span>
        </div>
      </div>
    </div>
  )
}
