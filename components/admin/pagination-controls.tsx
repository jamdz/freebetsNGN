'use client'

import { Button } from '@/components/ui/button'

export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) {
  if (total === 0) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1)
  const visible: (number | 'ellipsis')[] = []
  pages.forEach((value, index) => { if (index && value - pages[index - 1] > 1) visible.push('ellipsis'); visible.push(value) })
  return <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">Showing {start} to {end} of {total}</span><div className="flex flex-wrap items-center gap-1"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>{visible.map((value, index) => value === 'ellipsis' ? <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">…</span> : <Button key={value} size="sm" variant={value === page ? 'default' : 'outline'} onClick={() => onPageChange(value)}>{value}</Button>)}<Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button><select aria-label="Page size" className="ml-1 h-9 rounded-md border bg-background px-2" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></div></div>
}
