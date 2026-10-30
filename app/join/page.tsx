'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function JoinRedirect() {
  const params = useSearchParams(); const router = useRouter()
  useEffect(() => { const ref = params.get('ref')?.trim().toUpperCase(); const campaign = params.get('campaign')?.trim().toUpperCase(); if (ref) sessionStorage.setItem('referralCode', ref); if (campaign) sessionStorage.setItem('campaignCode', campaign); router.replace('/signup') }, [params, router])
  return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing your referral link…</main>
}

export default function JoinPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing your referral link…</main>}><JoinRedirect /></Suspense> }
