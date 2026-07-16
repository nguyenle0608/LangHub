import { redirect } from 'next/navigation'

export default function LegacySetupRedirect() {
  redirect('/dashboard/setup')
}
