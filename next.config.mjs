const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  } catch {
    return "'self'"
  }
})()
const supabaseSocketOrigin = supabaseOrigin.replace(/^https:/, 'wss:')

// When enabling or changing creatives in ad_networks / offerwall settings, add each provider origin
// to the relevant directive below. Next config cannot read database rows at request time.
const adHosts = [
  'https://czernik.org',
  'https://*.a-ads.com',
  'https://*.adsterra.com',
  'https://*.adgem.com',
]
const analyticsHosts = ['https://www.googletagmanager.com', 'https://www.google-analytics.com']
const customAdScriptHosts = (process.env.AD_SCRIPT_HOSTS ?? '').split(',').map((host) => host.trim()).filter(Boolean).flatMap((value) => {
  const host = value.replace(/^https:\/\//i, '').replace(/\/+$/, '')
  return /^(?:\*\.)?[a-z0-9.-]+(?::\d+)?$/i.test(host) ? [`https://${host}`] : []
})
const developmentScriptSources = process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  `script-src 'self' 'unsafe-inline' ${developmentScriptSources.join(' ')} ${[...analyticsHosts, ...adHosts, ...customAdScriptHosts].join(' ')}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseOrigin} ${adHosts.join(' ')}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseSocketOrigin} ${analyticsHosts.join(' ')} ${adHosts.join(' ')}`,
  `frame-src 'self' ${adHosts.join(' ')}`,
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/((?!ad-frame).*)', headers: securityHeaders }]
  },
  images: { formats: ['image/avif', 'image/webp'] },
}

export default nextConfig
