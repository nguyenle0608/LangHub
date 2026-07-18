'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

type CurlCodeBlockProps = {
  children: string
}

export function toPostmanCurl(command: string, origin: string) {
  return command
    .replaceAll('https://your-langhub.example', origin.replace(/\/$/, ''))
    .replaceAll('$LANGHUB_WRITE_TOKEN', 'YOUR_LANGHUB_WRITE_TOKEN')
    .replaceAll('$LANGHUB_TOKEN', 'YOUR_LANGHUB_TOKEN')
    .replaceAll('$PROJECT_ID', 'YOUR_PROJECT_ID')
    .replaceAll('deploy-$GITHUB_RUN_ID', 'YOUR_IDEMPOTENCY_KEY')
    .replace(/\s*\\\n\s*/g, ' ')
    .replace('curl --fail-with-body ', 'curl ')
    .trim()
}

export function CurlCodeBlock({ children }: CurlCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2_000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copyCurl() {
    const command = toPostmanCurl(children, window.location.origin)
    await navigator.clipboard.writeText(command)
    setCopied(true)
  }

  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 pr-32 text-xs leading-5">
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={copyCurl}
        className="absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Copy Postman-compatible cURL command"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy cURL'}
      </button>
    </div>
  )
}
