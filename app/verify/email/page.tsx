'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function EmailVerificationContent() {
  const params = useSearchParams(); const [verified, setVerified] = useState(false)
  useEffect(() => { if (params.get('token')) setVerified(true) }, [params])
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5"><section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">✓</div><h1 className="mt-5 font-display text-2xl font-black">{verified ? 'Email verified' : 'Check your email'}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{verified ? 'Your email address is confirmed. You can return to FreeBetNGN.' : 'We sent a verification link to your inbox. The link expires in 10 minutes.'}</p><Link href={verified ? '/home' : '/signup'} className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">{verified ? 'Continue' : 'Back to signup'}</Link></section></main>
}

export default function EmailVerificationPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><p>Loading verification…</p></main>}><EmailVerificationContent /></Suspense> }
