export const DEFAULT_PAGE_SIZES = [10, 25, 50] as const

export function parsePagination(searchParams: URLSearchParams, options: { defaultSize?: number; allowed?: readonly number[] } = {}) {
  const allowed = options.allowed?.length ? options.allowed : DEFAULT_PAGE_SIZES
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const requestedSize = Number.parseInt(searchParams.get('page_size') ?? String(options.defaultSize ?? 10), 10)
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = allowed.includes(requestedSize) ? requestedSize : (allowed.includes(options.defaultSize ?? 10) ? options.defaultSize ?? 10 : allowed[0])
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 }
}

export function buildPagination(page: number, pageSize: number, total: number) {
  return { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) }
}
