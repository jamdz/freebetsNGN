'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const postbackPath = '/api/postbacks/adgem'
const macros = 'player_id={player_id}&payout={payout}&amount={amount}&transaction_id={transaction_id}&campaign_id={campaign_id}'

export function AdgemPostbackUrl({ standalone = false }: { standalone?: boolean }) {
  const [message, setMessage] = useState('')
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const baseUrl = configuredSiteUrl ? new URL(configuredSiteUrl).origin : ''
  const postbackUrl = `${baseUrl}${postbackPath}?${macros}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(postbackUrl)
      setMessage('Postback URL copied.')
    } catch {
      setMessage('Copy is unavailable in this browser.')
    }
  }

  return <section className={`flex flex-col gap-3 rounded-xl border border-border/70 p-4 ${standalone ? 'bg-card' : ''}`}>
    <div>
      <h3 className="font-semibold">AdGem postback URL</h3>
      <p className="mt-1 text-xs text-muted-foreground">Register this GET URL in AdGem. AdGem appends the unique request_id and signed verifier to each request.</p>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">{postbackUrl}</code>
      <Button type="button" variant="outline" onClick={copy}>Copy URL</Button>
    </div>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </section>
}
