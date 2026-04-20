import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPaginationItems, paginateItems } from '../src/lib/pagination.ts'

test('paginateItems slices rows and clamps out-of-range pages', () => {
    const rows = Array.from({ length: 23 }, (_, index) => ({ id: `lead-${index + 1}` }))

    const secondPage = paginateItems(rows, 2, 10)
    assert.equal(secondPage.currentPage, 2)
    assert.equal(secondPage.totalPages, 3)
    assert.equal(secondPage.start, 11)
    assert.equal(secondPage.end, 20)
    assert.deepEqual(
        secondPage.items.map((row) => row.id),
        ['lead-11', 'lead-12', 'lead-13', 'lead-14', 'lead-15', 'lead-16', 'lead-17', 'lead-18', 'lead-19', 'lead-20']
    )

    const overflowPage = paginateItems(rows, 99, 10)
    assert.equal(overflowPage.currentPage, 3)
    assert.equal(overflowPage.start, 21)
    assert.equal(overflowPage.end, 23)
    assert.deepEqual(overflowPage.items.map((row) => row.id), ['lead-21', 'lead-22', 'lead-23'])
})

test('buildPaginationItems returns compact page controls with ellipsis for long result sets', () => {
    assert.deepEqual(buildPaginationItems(1, 3), [1, 2, 3])
    assert.deepEqual(buildPaginationItems(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
    assert.deepEqual(buildPaginationItems(10, 10), [1, 'ellipsis', 9, 10])
})
