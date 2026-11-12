'use client'

import { useEffect } from 'react'

export default function GlobalErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] global boundary caught an error', error.digest ?? 'no digest')
  }, [error])

  return (
    <html lang="en">
      <body className="bg-[#101a14] text-[#f3f7f4]">
        <main className="flex min-h-screen items-center justify-center px-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#355141] bg-[#17231b] p-6 text-center sm:p-8" role="alert">
            <h1 className="text-2xl font-bold">We hit a problem</h1>
            <p className="mt-3 text-sm text-[#c2d1c7]">The page could not be displayed. Please try again.</p>
            <button className="mt-6 min-h-11 rounded-xl bg-[#22c55e] px-4 font-semibold text-[#08120b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b]" onClick={reset}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  )
}
