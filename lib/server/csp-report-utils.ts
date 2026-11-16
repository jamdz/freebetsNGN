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
