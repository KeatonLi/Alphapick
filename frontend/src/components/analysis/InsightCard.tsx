interface InsightCardProps {
  icon: string
  title: string
  content: string
}

export default function InsightCard({ icon, title, content }: InsightCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  )
}
