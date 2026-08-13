export default function QualityScore({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-slate-400'

  return (
    <div className="flex items-center gap-2 w-24">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{score}</span>
    </div>
  )
}
