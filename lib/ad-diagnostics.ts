export function isExpectedDiagnosticMessage(source: MessageEventSource | null, expectedSource: MessageEventSource | null, data: unknown): data is { type: 'freebet-ad-diagnostic'; stage: string; detail?: Record<string, unknown> } {
  if (!expectedSource || source !== expectedSource || !data || typeof data !== 'object') return false
  const message = data as Record<string, unknown>
  return message.type === 'freebet-ad-diagnostic' && typeof message.stage === 'string'
}
