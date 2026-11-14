'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type AdminPasswordDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: (password: string) => Promise<void>
}

export function AdminPasswordDialog({ open, title, description, confirmLabel, onOpenChange, onConfirm }: AdminPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setPassword('')
      setError('')
    }
    onOpenChange(nextOpen)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onConfirm(password)
      changeOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to confirm this action')
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) changeOpen(nextOpen) }}>
    <DialogContent showCloseButton={!busy}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="admin-confirm-password" className="text-sm font-medium">Admin password</label>
          <input id="admin-confirm-password" type="password" required autoComplete="current-password" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={busy || !password}>{busy ? 'Verifying…' : confirmLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
