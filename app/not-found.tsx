import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">That page may have moved or is no longer available.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href="/">Return home</Link>
      </section>
    </main>
  )
}
