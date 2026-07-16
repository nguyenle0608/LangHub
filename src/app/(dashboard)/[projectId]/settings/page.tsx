import { redirect } from 'next/navigation'

export default function LegacyProjectSectionRedirect({
  params,
  searchParams,
}: {
  params: { projectId: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item))
    } else if (value !== undefined) {
      query.set(key, value)
    }
  }
  const qs = query.toString()
  redirect(`/dashboard/${params.projectId}/settings${qs ? `?${qs}` : ''}`)
}
