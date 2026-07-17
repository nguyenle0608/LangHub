import type { Metadata } from 'next'
import { LegalDocument } from '@/components/marketing/LegalDocument'

export const metadata: Metadata = {
  title: 'Terms of Service · LangHub',
  description: 'The terms that govern your use of LangHub.',
}

const sections = [
  {
    heading: '1. Acceptance of terms',
    body: 'By accessing or using LangHub, you agree to be bound by these terms. If you do not agree, do not use the service.',
  },
  {
    heading: '2. Use of the service',
    body: 'You may use LangHub to manage localization content for your own applications. You are responsible for the content you upload and for keeping your account credentials secure.',
  },
  {
    heading: '3. Accounts',
    body: 'You must provide accurate information when creating an account. You are responsible for all activity that occurs under your account.',
  },
  {
    heading: '4. Data and content',
    body: 'You retain ownership of the translation keys, values, and files you add to LangHub. We process this data only to provide the service.',
  },
  {
    heading: '5. Availability',
    body: 'We aim to keep LangHub available but do not guarantee uninterrupted access. Features may change as the product evolves toward general availability.',
  },
  {
    heading: '6. Changes to these terms',
    body: 'We may update these terms over time. Continued use of the service after changes take effect constitutes acceptance of the revised terms.',
  },
]

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated="July 17, 2026"
      sections={sections}
    />
  )
}
