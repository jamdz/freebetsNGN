export const CSP_REPORT_MAX_BYTES = 8192

export function isWithinCspReportLimit(byteLength: number) {
  return byteLength >= 0 && byteLength <= CSP_REPORT_MAX_BYTES
}

export function isSupportedCspContentType(contentType: string | null) {
  const mediaType = contentType?.split(';')[0].trim().toLowerCase()
  return mediaType === 'application/csp-report' || mediaType === 'application/json'
}

export function reportRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) value = value[0]
  if (!value || typeof value !== 'object') return null
  const wrapper = value as Record<string, unknown>
  const valueBody = wrapper.body
  const normalized = valueBody && typeof valueBody === 'object' && !Array.isArray(valueBody) ? valueBody : wrapper
  const normalizedWrapper = normalized as Record<string, unknown>
  const report = normalizedWrapper['csp-report'] ?? normalizedWrapper
  return report && typeof report === 'object' && !Array.isArray(report) ? report as Record<string, unknown> : null
}

const hostname = (value: unknown) => {
  if (typeof value !== 'string' || !value || /^(?:inline|eval|self|data|blob)(?::|$)/i.test(value)) return ''
  try { return new URL(value).hostname.toLowerCase() } catch { return '' }
}

const documentCategory = (value: unknown) => {
  if (typeof value !== 'string' || !value) return 'missing'
  try {
    const url = new URL(value)
    if (url.protocol === 'about:') return url.pathname === 'blank' ? 'about:blank' : 'about:other'
    return url.protocol === 'https:' || url.protocol === 'http:' ? 'http-document' : 'other-document'
  } catch { return 'invalid' }
}

const resourceType = (directive: string) => {
  if (directive.includes('img-src')) return 'image'
  if (directive.includes('script-src')) return 'script'
  if (directive.includes('frame-src') || directive.includes('child-src')) return 'frame'
  if (directive.includes('style-src')) return 'style'
  if (directive.includes('font-src')) return 'font'
  if (directive.includes('connect-src')) return 'connection'
  if (directive.includes('media-src')) return 'media'
  return 'other'
}

export function sanitizeCspViolation(report: Record<string, unknown>) {
  const blocked = report['blocked-uri'] ?? report.blockedURL ?? report.blockedURI ?? report.blockedUri
  const directive = String(report['effective-directive'] ?? report.effectiveDirective ?? report['violated-directive'] ?? report.violatedDirective ?? 'unknown').slice(0, 80)
  const policy = String(report['original-policy'] ?? report.originalPolicy ?? '')
  const policyScope = policy.includes("default-src 'none'") ? 'ad-frame-policy' : policy ? 'application-policy' : 'unknown-policy'
  const statusCode = Number(report['status-code'] ?? report.statusCode ?? 0)
  return {
    directive,
    resourceType: resourceType(directive),
    blockedHost: hostname(blocked),
    documentCategory: documentCategory(report['document-uri'] ?? report.documentURL ?? report.documentUri),
    sourceFileHost: hostname(report['source-file'] ?? report.sourceFile),
    policyScope,
    statusCode: Number.isFinite(statusCode) ? statusCode : 0,
    disposition: String(report.disposition ?? '').slice(0, 32),
  }
}

export function redactDatabaseMessage(message: string) {
  const constraintViolation = message.match(/^new row for relation "([a-z0-9_]+)" violates check constraint "([a-z0-9_]+)"$/i)
  const safeMessage = constraintViolation
    ? `new row for relation ${constraintViolation[1]} violates check constraint ${constraintViolation[2]}`
    : message
      .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[redacted-id]')
      .replace(/(['"])[^'"\n]{1,160}\1/g, '[redacted-value]')
      .replace(/[A-Za-z0-9_-]{48,}/g, '[redacted-token]')
  return safeMessage.slice(0, 300)
}
