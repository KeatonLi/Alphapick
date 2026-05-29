interface InsightCardProps {
  icon: string
  title: string
  content: string
}

export default function InsightCard({ icon, title, content }: InsightCardProps) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
        <div>
          <h3 style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{content}</p>
        </div>
      </div>
    </div>
  )
}
