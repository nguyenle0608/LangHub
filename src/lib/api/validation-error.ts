import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

/**
 * A 400 whose `error` is a sentence.
 *
 * Zod's `flatten()` is shaped for a form that can highlight its own fields.
 * Our callers mostly do `toast.error(json.error)`, and handing React an object
 * crashes the page with "Objects are not valid as a React child" — the user
 * never learns what was wrong with their request. So `error` carries the first
 * issue as text, and the full structure moves to `details` for the few callers
 * that want to mark up individual fields.
 */
export function zodErrorResponse(error: ZodError, status = 400) {
  return NextResponse.json(
    { error: firstIssueMessage(error), details: error.flatten() },
    { status }
  )
}

/** The first issue as "field.path: what is wrong", or just the message at the root. */
export function firstIssueMessage(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}
