'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] route boundary caught an error', error.digest ?? 'no digest')
  }, [error])

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center sm:p-8" role="alert">
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">We couldn&apos;t load this page. Try again, or return to the home page.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={reset}>Try again</button>
          <Link className="rounded-xl border border-border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href="/">Home</Link>
        </div>
      </section>
    </main>
  )
}
