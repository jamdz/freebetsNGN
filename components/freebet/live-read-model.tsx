'use client'

import useSWR from 'swr'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? 'Unable to load data')
  return body
}

export function LiveReadModelStatus({ resource }: { resource: string }) {
  const { error, isLoading } = useSWR(`/api/read-model?resource=${resource}`, fetcher)
  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/70" aria-label="Loading data" />
  if (error) return <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error.message}. Please refresh and try again.</div>
  return null
}
