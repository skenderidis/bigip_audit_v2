import { useState, useMemo } from 'react'

// Lightweight DataTables-style table: Show N entries · Search · sortable
// headers · Previous/Next with "Showing X to Y of Z entries".
// columns: [{ key, header, cell?(row), align?, sortable? }]
export default function AuditTable({ columns, rows, pageSize = 10, searchable = true, emptyText = 'No entries.', density = 'normal', bordered = false, defaultSortKey = null, defaultSortDir = 'asc', onRowClick = null }) {
  const txt = density === 'compact' ? 'text-xs' : 'text-sm'
  const pad = density === 'compact' ? 'px-2 py-1' : 'px-3 py-2'
  const cb = bordered ? ' border border-gray-200' : ''
  const [q, setQ] = useState('')
  const [size, setSize] = useState(pageSize)
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState(defaultSortDir)

  const cellText = (row, c) => {
    const v = c.cell ? c.cell(row) : row[c.key]
    return typeof v === 'object' ? '' : String(v ?? '')
  }

  const filtered = useMemo(() => {
    const data = rows || []
    if (!q.trim()) return data
    const needle = q.toLowerCase()
    return data.filter(r => columns.some(c => {
      const raw = c.cell ? (typeof c.cell(r) === 'object' ? (r[c.key] ?? '') : c.cell(r)) : r[c.key]
      return String(raw ?? '').toLowerCase().includes(needle)
    }))
  }, [rows, q, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const c = columns.find(x => x.key === sortKey)
    const dir = sortDir === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      const av = c?.sortValue ? c.sortValue(a) : c?.cell ? cellText(a, c) : a[sortKey]
      const bv = c?.sortValue ? c.sortValue(b) : c?.cell ? cellText(b, c) : b[sortKey]
      const an = Number(av), bn = Number(bv)
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''))
      return cmp * dir
    })
  }, [filtered, sortKey, sortDir, columns])

  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / size))
  const pageNum = Math.min(page, pages - 1)
  const start = pageNum * size
  const pageRows = sorted.slice(start, start + size)

  function toggleSort(c) {
    if (c.sortable === false) return
    if (sortKey === c.key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(c.key); setSortDir('asc') }
  }

  return (
    <div>
      {(searchable || total > pageSize) && (
        <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
          <label className="flex items-center gap-1.5">
            Show
            <select value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0) }}
              className="border border-gray-200 rounded px-1.5 py-0.5 bg-white">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            entries
          </label>
          {searchable && (
            <label className="flex items-center gap-1.5">
              Search:
              <input value={q} onChange={e => { setQ(e.target.value); setPage(0) }}
                className="border border-gray-200 rounded px-2 py-1 w-56" />
            </label>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={`w-full ${txt}${bordered ? ' border-collapse border border-gray-200' : ''}`}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500">
              {columns.map(c => (
                <th key={c.key} onClick={() => toggleSort(c)}
                  className={`${pad}${cb} font-medium whitespace-nowrap ${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : ''} ${c.sortable === false ? '' : 'cursor-pointer select-none hover:text-gray-700'}`}>
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sortKey === c.key && <span className="text-teal-600">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length} className={`${pad} text-center text-xs text-gray-400`}>{emptyText}</td></tr>
            ) : pageRows.map((row, i) => (
              <tr key={i} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}>
                {columns.map(c => (
                  <td key={c.key} className={`${pad}${cb} ${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : ''}`}>
                    {c.cell ? c.cell(row) : (row[c.key] ?? <span className="text-gray-300">—</span>)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > size && (
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>Showing {total === 0 ? 0 : start + 1} to {Math.min(start + size, total)} of {total} entries</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageNum === 0}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <span>{pageNum + 1} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={pageNum >= pages - 1}
              className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
