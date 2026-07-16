'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordContent />
    </Suspense>
  )
}

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'reset_callback_failed'
      ? 'Could not verify the reset link. Please request a new password reset email.'
      : null
  )
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSuccess(true)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-foreground">Forgot password</CardTitle>
        <CardDescription className="text-muted-foreground">
          Enter your email and we&apos;ll send you a password reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-green-500 bg-green-500/10 border border-green-500/30 rounded-md px-3 py-2">
              Check your email for a password reset link.
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground text-center w-full">
          Remember your password?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
