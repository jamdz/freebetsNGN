export type AdminAuditEntry = { id: string; actor: string; action: string; target: string; createdAt: string }
const entries: AdminAuditEntry[] = []
export function recordAdminAudit(actor: string, action: string, target: string) { const entry = { id: `audit_${Date.now()}_${entries.length}`, actor, action, target, createdAt: new Date().toISOString() }; entries.unshift(entry); return entry }
export function getAdminAudit() { return entries }
