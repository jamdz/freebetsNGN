'use client'

import { createContext, useContext, type ReactNode } from 'react'

type SiteBrand = { siteName: string; tagline: string; logoUrl: string }

const SiteBrandContext = createContext<SiteBrand>({ siteName: '', tagline: '', logoUrl: '' })

export function SiteBrandProvider({ value, children }: { value: SiteBrand; children: ReactNode }) {
  return <SiteBrandContext.Provider value={value}>{children}</SiteBrandContext.Provider>
}

export function useSiteBrand() {
  return useContext(SiteBrandContext)
}

const sizes = {
  sm: { image: 28, mark: 'size-7 rounded-lg text-sm', name: 'text-base' },
  md: { image: 36, mark: 'size-9 rounded-xl text-lg', name: 'text-xl' },
  lg: { image: 44, mark: 'size-11 rounded-2xl text-xl', name: 'text-xl' },
} as const

export function BrandMark({ size = 'md', showName = false }: { size?: 'sm' | 'md' | 'lg'; showName?: boolean }) {
  const { siteName, logoUrl } = useSiteBrand()
  const dimensions = sizes[size]
  return <span className="inline-flex shrink-0 items-center gap-2">
    {logoUrl ? <img src={logoUrl} alt={siteName} width={dimensions.image} height={dimensions.image} className="object-contain" loading="eager" /> : <span aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-primary font-display font-black text-primary-foreground ${dimensions.mark}`}>F</span>}
    {showName && <span className={`font-display font-bold tracking-tight ${dimensions.name}`}>{siteName}</span>}
  </span>
}
