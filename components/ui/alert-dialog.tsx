"use client"

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const AlertDialog = Dialog
export const AlertDialogContent = DialogContent
export const AlertDialogHeader = DialogHeader
export const AlertDialogFooter = DialogFooter
export const AlertDialogTitle = DialogTitle
export const AlertDialogDescription = DialogDescription

export function AlertDialogCancel(props: React.ComponentProps<typeof Button>) {
  return <Button variant="outline" {...props} />
}

export function AlertDialogAction(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} />
}
