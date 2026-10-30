import { useEffect, useState } from 'react'
import { Card } from '../components/ui'
import AuditTable from '../components/AuditTable'

// iHealth diagnostics for a device audit — the simplified, ignore-list filtered
// heuristics the original report produced, split into CVE vulnerabilities and
// other (non-CVE) findings. Clicking a row opens a right-side drawer with the
// full write-up (summary, recommended action, affected objects, every CVE and
// solution link) that doesn't fit in the table.

const SEV = {
  CRITICAL: { rank: 0, pill: 'bg-red-100 text-red-700' },
  HIGH:     { rank: 1, pill: 'bg-rose-100 text-rose-700' },
  MEDIUM:   { rank: 2, pill: 'bg-amber-100 text-amber-700' },
  LOW:      { rank: 3, pill: 'bg-sky-100 text-sky-700' },
  INFO:     { rank: 4, pill: 'bg-gray-100 text-gray-600' },
}

const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v])
const solHref = (x) =>
  String(x).startsWith('http') ? x : `https://my.f5.com/manage/s/article/${x}`
const solLabel = (x) => String(x).replace(/^https?:\/\/.*\/article\//, '')

function Sev({ value }) {
  const s = SEV[(value || '').toUpperCase()] || SEV.INFO
  return <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${s.pill}`}>{value || '—'}</span>
}
const sevCol = {
  key: 'h_importance', header: 'Severity', align: 'center',
  sortValue: (r) => SEV[(r.h_importance || '').toUpperCase()]?.rank ?? 9,
  cell: (r) => <Sev value={r.h_importance} />,
}

function Section({ title, count, children }) {
  return (
    <Card className="mb-4">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {count != null && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium tabular-nums">{count}</span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </Card>
  )
}

// ---- detail drawer ---------------------------------------------------------
function Field({ label, children }) {
  if (children == null || children === '' || (Array.isArray(children) && !children.length)) return null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{label}</div>
      <div className="text-[13px] text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}

function SolutionLinks({ ids }) {
  const s = arr(ids).filter(Boolean)
  if (!s.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {s.map((x, i) => (
        <a key={i} href={solHref(x)} target="_blank" rel="noreferrer"
          className="text-[12px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors">
          {solLabel(x)}
        </a>
      ))}
    </div>
  )
}

function DiagDrawer({ row, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!row) return null
  const cves = arr(row.h_cve_ids).filter(Boolean)
  const fixed = arr(row.fixedInVersions).filter(Boolean)
  const output = arr(row.output).filter((x) => x != null && String(x).trim() !== '')
  // CVE rows carry solution_id (first) + solution_ids (all); other rows carry solution_ids.
  const sols = arr(row.solution_ids).length ? arr(row.solution_ids)
    : (row.solution_id ? [row.solution_id] : [])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={onClose}>
      <div className="h-full w-full max-w-xl bg-white shadow-xl flex flex-col animate-[slideIn_.15s_ease-out]"
        onMouseDown={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sev value={row.h_importance} />
              {cves.length > 0 && <span className="text-[11px] text-gray-400 font-medium">{cves.length} CVE{cves.length > 1 ? 's' : ''}</span>}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{row.h_header || '—'}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <Field label="Summary">{row.h_summary}</Field>
          <Field label="Recommended Action">{row.h_action}</Field>

          {cves.length > 0 && (
            <Field label="CVEs">
              <div className="flex flex-wrap gap-1.5">
                {cves.map((c, i) => (
                  <a key={i} href={`https://nvd.nist.gov/vuln/detail/${c}`} target="_blank" rel="noreferrer"
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">{c}</a>
                ))}
              </div>
            </Field>
          )}

          {fixed.length > 0 && (
            <Field label="Fixed In">
              <span className="font-mono text-[12px] text-gray-600">{fixed.join(', ')}</span>
            </Field>
          )}

          {output.length > 0 && (
            <Field label={`Affected / Evidence (${output.length})`}>
              <pre className="font-mono text-[11px] text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto">
                {output.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n')}
              </pre>
            </Field>
          )}

          <Field label="F5 Solution Articles"><SolutionLinks ids={sols} /></Field>
        </div>
      </div>
    </div>
  )
}

function RemoveBtn({ onClick }) {
  return (
    <button title="Remove diagnostic" onClick={(e) => { e.stopPropagation(); onClick() }}
      className="text-gray-300 hover:text-rose-600 transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}

function RestoreBar({ removed, onRestore }) {
  const [open, setOpen] = useState(false)
  if (!removed.length) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-400 font-semibold hover:text-gray-600">
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        Removed ({removed.length})
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {removed.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              <span className="line-through">{h}</span>
              <button title="Restore" onClick={() => onRestore(h)} className="text-gray-400 hover:text-teal-600 font-semibold">↩</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LtmDiagnostics({ diag, excluded, onExclude }) {
  const exSet = new Set(excluded || [])
  const allCve = (diag && diag.cve) || []
  const allOther = (diag && diag.other) || []
  const cve = allCve.filter((d) => !exSet.has(d.h_header))
  const other = allOther.filter((d) => !exSet.has(d.h_header))
  const removed = [...allCve, ...allOther].filter((d) => exSet.has(d.h_header)).map((d) => d.h_header)
  const [active, setActive] = useState(null)
  const rmCol = onExclude ? [{ key: '_rm', header: '', sortable: false, align: 'right',
    cell: (r) => <RemoveBtn onClick={() => onExclude('diag', r.h_header, true)} /> }] : []

  return (
    <div>
      <Section title="CVE Vulnerabilities" count={cve.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="h_importance" defaultSortDir="asc"
          onRowClick={setActive}
          columns={[
            sevCol,
            { key: 'h_header', header: 'Vulnerability', cell: (r) => <span className="text-gray-800">{r.h_header}</span> },
            { key: 'h_cve_ids', header: 'CVEs', sortable: false,
              cell: (r) => <span className="font-mono text-[11px] text-gray-600">{arr(r.h_cve_ids).join(', ') || '—'}</span> },
            { key: 'fixedInVersions', header: 'Fixed In', sortable: false,
              cell: (r) => <span className="font-mono text-[11px] text-gray-600">{arr(r.fixedInVersions).join(', ') || '—'}</span> },
            { key: 'solution_id', header: 'Solution', sortable: false,
              cell: (r) => r.solution_id
                ? <a className="text-teal-600 hover:underline" target="_blank" rel="noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     href={`https://my.f5.com/manage/s/article/${r.solution_id}`}>{r.solution_id}</a>
                : <span className="text-gray-300">—</span> },
            ...rmCol,
          ]}
          rows={cve} emptyText="No CVE vulnerabilities reported." />
      </Section>

      <Section title="Other Diagnostics" count={other.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="h_importance" defaultSortDir="asc"
          onRowClick={setActive}
          columns={[
            sevCol,
            { key: 'h_header', header: 'Finding', cell: (r) => <span className="text-gray-800">{r.h_header}</span> },
            { key: 'output', header: 'Detail', sortable: false,
              cell: (r) => {
                const o = arr(r.output).join(' ') || r.h_summary || ''
                return <span className="text-[12px] text-gray-500" title={o}>{o.length > 160 ? o.slice(0, 160) + '…' : o || '—'}</span>
              } },
            { key: 'solution_ids', header: 'Solution', sortable: false,
              cell: (r) => {
                const s = arr(r.solution_ids)
                if (!s.length) return <span className="text-gray-300">—</span>
                return s.map((x, i) => (
                  <a key={i} className="text-teal-600 hover:underline block" target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    href={solHref(x)}>{solLabel(x)}</a>
                ))
              } },
            ...rmCol,
          ]}
          rows={other} emptyText="No other diagnostics reported." />
        {onExclude && <RestoreBar removed={removed} onRestore={(h) => onExclude('diag', h, false)} />}
      </Section>

      {active && <DiagDrawer row={active} onClose={() => setActive(null)} />}
    </div>
  )
}
