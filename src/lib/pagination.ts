export type PaginationItem = number | 'ellipsis'

export type PaginatedItems<T> = {
    items: T[]
    currentPage: number
    totalPages: number
    start: number
    end: number
}

export function paginateItems<T>(items: T[], requestedPage: number, pageSize: number): PaginatedItems<T> {
    const safePageSize = Math.max(1, Math.trunc(pageSize) || 1)
    const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
    const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages)
    const startIndex = (currentPage - 1) * safePageSize
    const pagedItems = items.slice(startIndex, startIndex + safePageSize)

    return {
        items: pagedItems,
        currentPage,
        totalPages,
        start: pagedItems.length === 0 ? 0 : startIndex + 1,
        end: pagedItems.length === 0 ? 0 : startIndex + pagedItems.length,
    }
}

export function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const pages: PaginationItem[] = [1]
    const left = Math.max(2, currentPage - 1)
    const right = Math.min(totalPages, currentPage + 1)

    if (left > 2) {
        pages.push('ellipsis')
    }

    for (let page = left; page <= right; page += 1) {
        pages.push(page)
    }

    if (right < totalPages - 1) {
        pages.push('ellipsis')
    }

    if (pages[pages.length - 1] !== totalPages) {
        pages.push(totalPages)
    }

    return pages
}
