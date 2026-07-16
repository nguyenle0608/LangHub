import { redirect } from 'next/navigation'

export default function LegacyOrgSettingsRedirect({ params }: { params: { orgId: string } }) {
  redirect(`/dashboard/orgs/${params.orgId}/settings`)
}
