/**
 * DataGrid — a headless TanStack Table wrapper with accessible markup.
 *
 * Everything render-related is composed from primitives (semantic <table>,
 * <caption>, aria-sort, role="row", scope="col") so the product UI keeps
 * pixel-level control while TanStack owns the state machine.
 *
 * State ownership:
 *   • Fully uncontrolled — omit every state prop; each behavior lives in
 *     component-local useState. Simplest and correct for most callers.
 *   • Partially/fully controlled — pass `state.sorting` + `onSortingChange`
 *     (etc.) from the parent. This is the shape you'd wire up for
 *     URL-sync (searchParams), a Zustand slice, or server-side pagination.
 *
 * Features enabled by default:
 *   • sort (multi-column via shift-click)
 *   • per-column filter (`meta.filter` on each column def)
 *   • pagination (with DeviceFleet-style page-size pill)
 *   • row selection (opt-in via `enableRowSelection`)
 *   • column visibility (dropdown when `enableColumnVisibility`)
 */
import React, { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPanel } from './useAnchoredPanel'
import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

// Per-column metadata we hang off `columnDef.meta`.
export interface DataGridColumnMeta {
  align?: 'left' | 'right' | 'center'      // header + cell (default)
  cellAlign?: 'left' | 'right' | 'center'  // override alignment for cell only
  filter?: boolean
  width?: string      // Tailwind class, e.g. 'w-24'
  mono?: boolean
  headerNote?: string // small explanatory string under header cell
}

// Extend ColumnDef.meta typing so `col.meta?.align` etc. are known.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> extends DataGridColumnMeta {} // eslint-disable-line
}

// Props: everything state-related is optional. Provide a state slot AND its
// setter to lift ownership to the parent (URL sync, Zustand, server state).
export interface DataGridProps<T> {
  data: T[]
  columns: ColumnDef<T, any>[]

  // Table-level identity for a11y & row keys.
  captionId?: string
  caption?: React.ReactNode
  getRowId?: (row: T, index: number) => string

  // ── Ownership: pass EITHER an initial value (uncontrolled) OR a
  // (state, setter) pair (controlled). Never both.
  initialSorting?: SortingState
  sorting?: SortingState
  onSortingChange?: (updater: React.SetStateAction<SortingState>) => void

  initialFilters?: ColumnFiltersState
  filters?: ColumnFiltersState
  onFiltersChange?: (updater: React.SetStateAction<ColumnFiltersState>) => void

  // Global filter — runs against every column that has enableGlobalFilter !== false.
  initialGlobalFilter?: string
  globalFilter?: string
  onGlobalFilterChange?: (updater: React.SetStateAction<string>) => void

  initialPagination?: PaginationState
  pagination?: PaginationState
  onPaginationChange?: (updater: React.SetStateAction<PaginationState>) => void

  initialVisibility?: VisibilityState
  visibility?: VisibilityState
  onVisibilityChange?: (updater: React.SetStateAction<VisibilityState>) => void

  initialSelection?: RowSelectionState
  selection?: RowSelectionState
  onSelectionChange?: (updater: React.SetStateAction<RowSelectionState>) => void

  // Feature switches.
  enableRowSelection?: boolean
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  pageSizes?: readonly number[]   // page-size selector options (default [10,25,50,100])

  // Server-side hooks — if provided, we skip client-side get*RowModel().
  manualPagination?: boolean
  pageCount?: number
  rowCount?: number

  // Layout knobs.
  maxHeight?: string      // Tailwind class, e.g. 'max-h-[420px]'
  emptyText?: string
  density?: 'compact' | 'comfortable'      // default 'compact'

  // Callbacks.
  onRowClick?:    (row: T) => void   // single click on the row
  onRowActivate?: (row: T) => void   // enter / dbl-click on the row
  rowClassName?:  (row: T) => string // extra Tailwind classes per row (e.g. selection tint)
}

const PAGE_SIZES = [10, 25, 50, 100] as const

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (!dir) return (
    <svg aria-hidden="true" className="w-3 h-3 text-gray-500 inline ml-1" viewBox="0 0 12 12">
      <path fill="currentColor" d="M6 2l3 3H3zM6 10l-3-3h6z" />
    </svg>
  )
  return (
    <svg aria-hidden="true" className="w-3 h-3 text-white inline ml-1" viewBox="0 0 12 12">
      <path fill="currentColor" d={dir === 'asc' ? 'M6 3l4 5H2z' : 'M6 9l4-5H2z'} />
    </svg>
  )
}

function ColumnVisibilityMenu<T>({ table }: { table: Table<T> }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { btnRef, panelRef, panelStyle } = useAnchoredPanel(open, close)
  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
      >
        Columns ▾
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className="min-w-[180px] bg-white border border-gray-200 rounded shadow-lg p-1 text-[11px]"
        >
          {table.getAllLeafColumns().map(col => {
            if (col.id === 'select') return null   // don't let user hide selection column
            const label = typeof col.columnDef.header === 'string'
              ? col.columnDef.header
              : col.id
            return (
              <label key={col.id} role="menuitemcheckbox"
                aria-checked={col.getIsVisible()}
                className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                  className="accent-blue-600"
                />
                <span>{label}</span>
              </label>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default function DataGrid<T>(props: DataGridProps<T>) {
  const {
    data, columns,
    captionId, caption, getRowId,
    initialSorting, sorting, onSortingChange,
    initialFilters, filters, onFiltersChange,
    initialGlobalFilter, globalFilter, onGlobalFilterChange,
    initialPagination, pagination, onPaginationChange,
    initialVisibility, visibility, onVisibilityChange,
    initialSelection, selection, onSelectionChange,
    enableRowSelection = false,
    enableColumnVisibility = false,
    enablePagination = true,
    pageSizes = PAGE_SIZES,
    manualPagination = false, pageCount, rowCount,
    maxHeight = 'max-h-[420px]',
    emptyText = 'No data.',
    density = 'compact',
    onRowActivate,
    onRowClick,
    rowClassName,
  } = props

  // Density-driven Tailwind tokens. Compact ≈ Grafana. Comfortable ≈ Linear/Notion.
  const dense = density === 'compact'
  const tks = dense
    ? { textBase: 'text-xs', cellPad: 'px-1 py-1',   headerPad: 'px-1 py-2',   headerFont: 'text-[11px]', empty: 'p-6', filterPad: 'px-1 py-1' }
    : { textBase: 'text-sm', cellPad: 'px-4 py-3',   headerPad: 'px-4 py-3',   headerFont: 'text-xs',     empty: 'p-10', filterPad: 'px-4 py-2' }
  const checkboxSize = dense ? 'w-3 h-3' : 'w-4 h-4'

  // ── Uncontrolled fall-backs: only ever created if the parent didn't lift.
  const [uSort, setUSort] = useState<SortingState>(initialSorting ?? [])
  const [uFilt, setUFilt] = useState<ColumnFiltersState>(initialFilters ?? [])
  const [uGlob, setUGlob] = useState<string>(initialGlobalFilter ?? '')
  const [uPag, setUPag]  = useState<PaginationState>(initialPagination ?? { pageIndex: 0, pageSize: 25 })
  const [uVis, setUVis]  = useState<VisibilityState>(initialVisibility ?? {})
  const [uSel, setUSel]  = useState<RowSelectionState>(initialSelection ?? {})

  // If the parent passed `sorting`, TanStack treats sorting as controlled.
  const state = {
    sorting:          sorting      ?? uSort,
    columnFilters:    filters      ?? uFilt,
    globalFilter:     globalFilter ?? uGlob,
    pagination:       pagination   ?? uPag,
    columnVisibility: visibility   ?? uVis,
    rowSelection:     selection    ?? uSel,
  }

  // Build the columns — inject a selection column at the head if requested.
  const cols = useMemo<ColumnDef<T, any>[]>(() => {
    if (!enableRowSelection) return columns
    return [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected()}
            ref={el => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className={`accent-blue-600 ${checkboxSize}`}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            onClick={e => e.stopPropagation()}
            className={`accent-blue-600 ${checkboxSize}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: { width: 'w-8', align: 'center' },
      },
      ...columns,
    ]
  }, [columns, enableRowSelection])

  const table = useReactTable<T>({
    data, columns: cols,
    state,
    onSortingChange:   onSortingChange   ?? setUSort,
    onColumnFiltersChange: onFiltersChange ?? setUFilt,
    onGlobalFilterChange:  onGlobalFilterChange ?? setUGlob,
    onPaginationChange: onPaginationChange ?? setUPag,
    onColumnVisibilityChange: onVisibilityChange ?? setUVis,
    onRowSelectionChange: onSelectionChange ?? setUSel,
    getRowId,
    enableRowSelection,
    enableMultiSort: true,
    manualPagination,
    pageCount,
    rowCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: manualPagination || !enablePagination ? undefined : getPaginationRowModel(),
  })

  const hasFilters = cols.some(c => (c.meta as DataGridColumnMeta | undefined)?.filter)
  const rows = table.getRowModel().rows
  const pageIndex = table.getState().pagination.pageIndex
  const pageCountResolved = enablePagination ? (table.getPageCount() || 1) : 1
  const totalRows = manualPagination && rowCount != null ? rowCount : table.getFilteredRowModel().rows.length
  const selCount = Object.keys(state.rowSelection).length

  return (
    <div className="flex flex-col">
      {/* Toolbar row — selection count + column visibility menu */}
      {(enableRowSelection || enableColumnVisibility) && (
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
          <div>{enableRowSelection && selCount > 0 && <span>{selCount} selected</span>}</div>
          {enableColumnVisibility && <ColumnVisibilityMenu table={table} />}
        </div>
      )}

      <div className={`${maxHeight} overflow-auto px-3`}>
        <table
          className={`w-full table-fixed ${tks.textBase}`}
          role="grid"
          aria-labelledby={captionId}
          aria-rowcount={totalRows}
        >
          {caption && <caption id={captionId} className="sr-only">{caption}</caption>}

          <thead>
            {table.getHeaderGroups().map(group => (
              <tr key={group.id} className="bg-gray-900 sticky top-0 z-10" role="row">
                {group.headers.map(header => {
                  const dir = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  const meta = header.column.columnDef.meta as DataGridColumnMeta | undefined
                  const align = meta?.align || 'left'
                  return (
                    <th
                      key={header.id}
                      role="columnheader"
                      scope="col"
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                      className={`${tks.headerPad} font-medium ${tks.headerFont} text-gray-100 ${meta?.width ?? ''} ${
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 select-none hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 rounded-sm px-0.5"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon dir={dir} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      {meta?.headerNote && (
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">{meta.headerNote}</div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
            {hasFilters && (
              <tr className="border-b border-gray-100 bg-gray-50 sticky top-[34px] z-10" role="row">
                {table.getHeaderGroups()[0].headers.map(header => {
                  const meta = header.column.columnDef.meta as DataGridColumnMeta | undefined
                  return (
                    <th key={header.id} className={tks.filterPad} role="columnheader" scope="col">
                      {meta?.filter && header.column.getCanFilter() ? (
                        <input
                          value={(header.column.getFilterValue() ?? '') as string}
                          onChange={e => header.column.setFilterValue(e.target.value)}
                          placeholder="Filter…"
                          aria-label={`Filter ${String(header.column.columnDef.header)}`}
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
              <tr role="row">
                <td colSpan={cols.length} className={`${tks.empty} text-center ${tks.textBase} text-gray-400`} role="gridcell">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map(row => {
              const selected = row.getIsSelected()
              return (
                <tr
                  key={row.id}
                  role="row"
                  aria-selected={enableRowSelection ? selected : undefined}
                  tabIndex={onRowActivate || onRowClick ? 0 : -1}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onDoubleClick={onRowActivate ? () => onRowActivate(row.original) : undefined}
                  onKeyDown={onRowActivate ? (e => e.key === 'Enter' && onRowActivate(row.original)) : undefined}
                  className={`border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors ${
                    selected ? 'bg-blue-50' : ''
                  } ${onRowActivate || onRowClick ? 'cursor-pointer' : ''} ${
                    rowClassName ? rowClassName(row.original) : ''
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500`}
                >
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta as DataGridColumnMeta | undefined
                    const align = meta?.cellAlign || meta?.align || 'left'
                    return (
                      <td
                        key={cell.id}
                        role="gridcell"
                        className={`${tks.cellPad} text-gray-800 tabular-nums ${meta?.mono ? 'font-mono' : ''} ${
                          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {enablePagination && rows.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100"
             role="navigation" aria-label="Pagination">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            {pageSizes.map((size, i) => (
              <span key={size} className="flex items-center gap-2">
                {i > 0 && <span className="text-gray-300">|</span>}
                <button
                  type="button"
                  onClick={() => table.setPageSize(size)}
                  aria-pressed={state.pagination.pageSize === size}
                  className={`px-1 py-0.5 rounded transition-colors
                    ${state.pagination.pageSize === size
                      ? 'text-teal-700 font-semibold border border-teal-500 px-2'
                      : 'hover:text-gray-700'
                    }`}
                >
                  {size}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span aria-live="polite">
              Page {pageIndex + 1} of {pageCountResolved}
              {manualPagination ? '' : ` · ${totalRows} rows`}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
                className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
                className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
