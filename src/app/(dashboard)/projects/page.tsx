import { redirect } from 'next/navigation'

export default function LegacyProjectsRedirect({ searchParams }: { searchParams: { org?: string } }) {
  const qs = searchParams.org ? `?org=${encodeURIComponent(searchParams.org)}` : ''
  redirect(`/dashboard/projects${qs}`)
}
