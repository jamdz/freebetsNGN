'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth-provider'

function EmailVerificationContent() {
  const params = useSearchParams()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const email = params.get('email') ?? user?.email ?? ''
  const verified = Boolean(user?.emailVerified)
  const resend = async () => {
    if (!email) { setMessage('Return to signup to enter your email address.'); return }
    setBusy(true)
    const { error } = await createClient().auth.resend({ type: 'signup', email })
    setBusy(false)
    setMessage(error ? 'Unable to resend the confirmation email. Please try again shortly.' : 'Confirmation email sent. Check your inbox and spam folder.')
  }
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5"><section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">{verified ? '✓' : '✉'}</div><h1 className="mt-5 font-display text-2xl font-black">{verified ? 'Email verified' : 'Check your email'}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{verified ? 'Your email address is confirmed. Continue to phone verification.' : 'Supabase Auth sent your confirmation link. Open that email to finish verification.'}</p>{message&&<p role="status" className="mt-4 text-sm text-primary">{message}</p>}<div className="mt-6 flex flex-col gap-3">{verified?<Link href="/verify?step=phone" className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Verify phone</Link>:<button type="button" disabled={busy} onClick={resend} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-60">{busy?'Sending…':'Resend confirmation email'}</button>}<Link href="/signup" className="text-sm font-bold text-primary">Back to signup</Link></div></section></main>
}

export default function EmailVerificationPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><p>Loading verification…</p></main>}><EmailVerificationContent /></Suspense> }
