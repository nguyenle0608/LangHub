import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getUser } from '@/lib/supabase/session'
import { getProjectLite } from '@/lib/supabase/queries/projects'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBranchId } from '@/lib/branches/queries'
import { fetchExportData } from '@/lib/exporters/data'
import { scanProjectQA } from '@/lib/qa/scan'
import { localeFlag } from '@/lib/locale-flag'

const RULE_LABELS: Record<string, string> = {
  'placeholder-missing': 'Missing placeholder',
  'placeholder-extra': 'Unexpected placeholder',
  'html-mismatch': 'HTML tag mismatch',
  'leading-whitespace': 'Leading whitespace',
  'trailing-whitespace': 'Trailing whitespace',
}

interface Props {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ branch?: string; rule?: string }>
}

export default async function QAReportPage({ params, searchParams }: Props) {
  const { projectId } = await params
  const { branch: branchParam, rule: ruleFilter } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')

  const project = await getProjectLite(projectId)
  if (!project) notFound()

  const branchId = await resolveBranchId(projectId, branchParam)
  if (!branchId) notFound()

  const admin = createAdminClient()
  const { data: locales } = await admin
    .from('locales')
    .select('id, code, name, is_base')
    .eq('project_id', projectId)
  const localeRows = locales ?? []

  const { keys, translations } = await fetchExportData(admin, branchId, localeRows.map((l) => l.id))
  const report = scanProjectQA(keys, translations, localeRows)

  const visibleRows = ruleFilter
    ? report.rows.filter((r) => r.issues.some((i) => i.rule === ruleFilter))
    : report.rows

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href={`/dashboard/${projectId}/editor`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-blue-500/10 p-2 ring-1 ring-inset ring-blue-500/20">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QA Report</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{report.errorCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Errors</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{report.warningCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Warnings</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold tabular-nums">{report.scanned}</p>
            <p className="mt-1 text-xs text-muted-foreground">Translations checked</p>
          </div>
        </div>

        {/* Rule breakdown */}
        {report.byRule.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/${projectId}/qa`}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                !ruleFilter ? 'border-blue-500 bg-blue-600/20 text-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({report.rows.length})
            </Link>
            {report.byRule.map((r) => (
              <Link
                key={r.rule}
                href={`/dashboard/${projectId}/qa?rule=${r.rule}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  ruleFilter === r.rule ? 'border-blue-500 bg-blue-600/20 text-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {RULE_LABELS[r.rule] ?? r.rule} ({r.count})
              </Link>
            ))}
          </div>
        )}

        {/* Results */}
        {visibleRows.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="mt-3 font-semibold">No QA issues found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.scanned === 0 ? 'No translated values to check yet.' : 'All checked translations match their source.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {visibleRows.map((row) => (
              <div key={`${row.keyId}:${row.localeId}`} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/dashboard/${projectId}/editor?q=${encodeURIComponent(row.key)}`}
                    className="font-mono text-xs text-foreground hover:text-blue-600 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded truncate"
                  >
                    {row.key}
                  </Link>
                  <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="text-sm">{localeFlag(row.localeCode)}</span>
                    {row.localeName}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {row.issues.map((issue) => (
                    <div
                      key={issue.rule}
                      className={`flex items-start gap-1.5 text-[11px] ${
                        issue.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
