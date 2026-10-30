import React, { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'

// DeviceFleet pagination sizes — keep in sync.
const PAGE_SIZES = [10, 25, 50, 100]

// ─── Sort caret ────────────────────────────────────────────────────
function SortIcon({ dir }) {
  if (!dir) {
    return (
      <svg className="w-3 h-3 text-gray-300 inline ml-1" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 2l3 3H3zM6 10l-3-3h6z" />
      </svg>
    )
  }
  return (
    <svg className="w-3 h-3 text-gray-700 inline ml-1" viewBox="0 0 12 12" fill="currentColor">
      {dir === 'asc'
        ? <path d="M6 3l4 5H2z" />
        : <path d="M6 9l4-5H2z" />}
    </svg>
  )
}

/**
 * Reusable table backed by TanStack Table v8.
 *
 * columns = TanStack column definitions. Each column may set:
 *   - accessorKey / accessorFn
 *   - header (string or fn)
 *   - cell (fn) — receives {row, getValue}
 *   - enableSorting (default true)
 *   - meta.align  — 'left' (default) | 'right'
 *   - meta.filter — true to render a per-column filter input in the header row
 *   - meta.width  — Tailwind width class (e.g. 'w-24')
 *   - meta.mono   — render cell in a mono font (default false)
 *
 * Props:
 *   data          — array of rows
 *   pageSize      — initial page size (default 25)
 *   maxHeight     — Tailwind height class for scroll cap (default max-h-[420px])
 *   emptyText     — string shown when there are no matching rows
 *   initialSort   — [{id, desc}]  passed to TanStack
 *   getRowId      — optional stable id fn
 *   showPagination — bool (default true). Small tables can hide the footer.
 *   onRowClick    — optional callback for whole-row click
 */
export default function DataTable({
  columns,
  data,
  pageSize = 25,
  maxHeight = 'max-h-[420px]',
  emptyText = 'No data.',
  initialSort = [],
  getRowId,
  showPagination = true,
  onRowClick,
}) {
  const [sorting, setSorting] = useState(initialSort)
  const [columnFilters, setColumnFilters] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
  })

  const hasFilters = columns.some(c => c.meta?.filter)
  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount() || 1
  const pageIndex = table.getState().pagination.pageIndex

  return (
    <div className="flex flex-col">
      <div className={`${maxHeight} overflow-auto`}>
        <table className="w-full text-xs">
          <thead>
            {table.getHeaderGroups().map(group => (
              <tr key={group.id} className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                {group.headers.map(header => {
                  const dir = header.column.getIsSorted() || null
                  const canSort = header.column.getCanSort()
                  const align = header.column.columnDef.meta?.align || 'left'
                  const width = header.column.columnDef.meta?.width || ''
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 font-medium text-[11px] text-gray-500 ${width} ${
                        align === 'right' ? 'text-right' : 'text-left'
                      } ${canSort ? 'cursor-pointer select-none hover:text-gray-800' : ''}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && <SortIcon dir={dir} />}
                    </th>
                  )
                })}
              </tr>
            ))}
            {hasFilters && (
              <tr className="border-b border-gray-100 bg-gray-50 sticky top-[34px] z-10">
                {table.getHeaderGroups()[0].headers.map(header => {
                  const wantsFilter = header.column.columnDef.meta?.filter
                  return (
                    <th key={header.id} className="px-3 py-1">
                      {wantsFilter ? (
                        <input
                          value={(header.column.getFilterValue() ?? '')}
                          onChange={e => header.column.setFilterValue(e.target.value)}
                          placeholder="Filter…"
                          className="w-full text-[11px] px-1.5 py-0.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-teal-300"
                        />
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-xs text-gray-400">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr
                key={row.id}
                className={`border-b border-gray-50 hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row.original, row) : undefined}
              >
                {row.getVisibleCells().map(cell => {
                  const align = cell.column.columnDef.meta?.align || 'left'
                  const mono = cell.column.columnDef.meta?.mono ? 'font-mono' : ''
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-1 text-gray-800 tabular-nums ${mono} ${
                        align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && rows.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
          {/* Page-size selector — DeviceFleet style */}
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            {PAGE_SIZES.map((size, i) => (
              <span key={size} className="flex items-center gap-2">
                {i > 0 && <span className="text-gray-300">|</span>}
                <button
                  onClick={() => table.setPageSize(size)}
                  className={`px-1 py-0.5 rounded transition-colors
                    ${table.getState().pagination.pageSize === size
                      ? 'text-teal-700 font-semibold border border-teal-500 px-2'
                      : 'hover:text-gray-700'
                    }`}
                >
                  {size}
                </button>
              </span>
            ))}
          </div>

          {/* Prev / next */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>Page {pageIndex + 1} of {pageCount}</span>
            <div className="flex gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Column-helper factory — colocate accessor + display + width ────
export function col(accessor, header, opts = {}) {
  return {
    accessorKey: accessor,
    header,
    enableSorting: opts.sortable !== false,
    cell: opts.cell,
    meta: {
      align: opts.align,
      filter: opts.filter,
      width: opts.width,
      mono: opts.mono,
    },
    ...(opts.sortingFn ? { sortingFn: opts.sortingFn } : {}),
    ...(opts.filterFn ? { filterFn: opts.filterFn } : {}),
  }
}
