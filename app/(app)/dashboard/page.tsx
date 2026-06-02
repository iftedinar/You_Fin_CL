import { createClient } from '@/lib/supabase/server'
import { BookOpen, CheckCircle, HelpCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: resources }, { data: attempts }] = await Promise.all([
    supabase.from('resources').select('*').eq('user_id', user.id),
    supabase.from('quiz_attempts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  const allResources = resources ?? []
  const allAttempts = (attempts ?? []) as Array<{ score: number; total: number; created_at: string; resource_id: string }>

  const total = allResources.length
  const completed = allResources.filter(r => r.study_status === 'completed').length
  const ready = allResources.filter(r => r.status === 'ready').length
  const avgScore = allAttempts.length > 0
    ? Math.round(allAttempts.reduce((acc, a) => acc + (a.score / a.total) * 100, 0) / allAttempts.length)
    : null

  // Topic distribution
  const topicCounts: Record<string, number> = {}
  allResources.forEach(r => {
    const tags = (r.extracted as { topic_tags?: string[] } | null)?.topic_tags ?? []
    tags.forEach((tag: string) => {
      topicCounts[tag] = (topicCounts[tag] ?? 0) + 1
    })
  })
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const recent = allResources
    .filter(r => r.status === 'ready')
    .slice(0, 5)

  const stats = [
    { label: 'Total resources', value: total, icon: BookOpen, color: 'text-brand-600 bg-brand-50' },
    { label: 'Completed',       value: completed, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Quiz attempts',   value: allAttempts.length, icon: HelpCircle, color: 'text-purple-600 bg-purple-50' },
    { label: 'Avg quiz score',  value: avgScore !== null ? `${avgScore}%` : '—', icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your learning progress at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent resources */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Recent resources</p>
            <Link href="/library" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No resources yet</p>
          ) : (
            <div className="space-y-2">
              {recent.map(r => (
                <Link
                  key={r.id}
                  href={`/resource/${r.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-tertiary transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize ml-3 shrink-0">{r.source_type}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Topic cloud */}
        <div className="card">
          <p className="section-label mb-4">Topics studied</p>
          {topTopics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Add resources to see your topics</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTopics.map(([tag, count]) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 text-brand-700 text-sm rounded-full font-medium"
                >
                  {tag}
                  <span className="text-xs text-brand-400">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quiz history */}
        {allAttempts.length > 0 && (
          <div className="card lg:col-span-2">
            <p className="section-label mb-4">Recent quiz attempts</p>
            <div className="space-y-2">
              {allAttempts.slice(0, 8).map((a, i) => {
                const pct = Math.round((a.score / a.total) * 100)
                const res = allResources.find(r => r.id === a.resource_id)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{res?.title ?? 'Unknown resource'}</p>
                    </div>
                    <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-10 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
