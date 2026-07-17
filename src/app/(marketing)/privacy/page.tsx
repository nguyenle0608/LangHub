import type { Metadata } from 'next'
import { LegalDocument } from '@/components/marketing/LegalDocument'

export const metadata: Metadata = {
  title: 'Privacy Policy · LangHub',
  description: 'How LangHub collects, uses, and protects your data.',
}

const sections = [
  {
    heading: '1. Information we collect',
    body: 'We collect the account information you provide (such as your email) and the localization content you add to your workspaces. We also collect basic usage data to operate and improve the service.',
  },
  {
    heading: '2. How we use your data',
    body: 'Your data is used to provide the localization workspace, authenticate you, sync changes in real time, and maintain version history. We do not sell your data.',
  },
  {
    heading: '3. Storage and security',
    body: 'Data is stored with our infrastructure provider using access controls and row-level security. We take reasonable measures to protect it from unauthorized access.',
  },
  {
    heading: '4. Cookies and sessions',
    body: 'We use essential cookies to keep you signed in. We do not use non-essential tracking cookies without your consent.',
  },
  {
    heading: '5. Your rights',
    body: 'You can access, export, or delete your workspace content at any time. Contact us to request full account deletion.',
  },
  {
    heading: '6. Changes to this policy',
    body: 'We may update this policy as the product evolves. Material changes will be communicated through the app or by email.',
  },
]

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated="July 17, 2026"
      sections={sections}
    />
  )
}
