import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader, SectionHeader, Btn } from '../components/ui'
import { listAuditPolicies, setPolicyTemplate, analyzePolicy, deleteAuditPolicy, getAuditPolicy, getPolicyOwasp, setPolicyOwaspAck, downloadPolicySummary, downloadPolicyReport } from '../api/auditPolicies'
import { listTemplates } from '../api/templates'
import { CHECK_LABELS } from '../lib/auditChecks'
import { configScore, configGrade } from '../lib/configScore'
import ImportWizard from '../components/ImportWizard'
import toast from 'react-hot-toast'

// Real audit metrics come from each policy's stored `analysis` summary
// (produced by the analyzer): { error, warning, info, score, areas, total }.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Sentinel select value for "no template" (gap analysis skipped); stored as
// null/'' on the policy.
const NONE = '__none__'

function metrics(p) {
  const a = p.analysis
  if (!a) return { analyzed: false }
  // Config Quality = configuration quality (from the analyzer findings).
  // Shared with the policy detail page via configScore/configGrade.
  const grade = configGrade(configScore(a.score)).g
  // Risk = coverage gap vs the selected template (null until re-analyzed with a
  // known template, so the cell can show “—” instead of a misleading 0).
  const hasGap = a.gap && typeof a.gap.total === 'number' && a.gap.total > 0
  const risk = hasGap ? clamp(Math.round(a.risk || 0), 0, 100) : null
  // OWASP Top-10 compliance % (null until re-analyzed, so the cell shows “—”).
  const owasp = a.owasp && typeof a.owasp.score === 'number' ? a.owasp.score : null
  return { analyzed: true, risk, grade, owasp, error: a.error || 0, warning: a.warning || 0, info: a.info || 0 }
}

// OWASP % colour band (higher = better compliance, so inverse of risk).
function owaspBand(v) {
  if (v >= 75) return { color: '#16a34a', pill: 'bg-green-100 text-green-700' }
  if (v >= 50) return { color: '#d97706', pill: 'bg-amber-100 text-amber-700' }
  return { color: '#e4502b', pill: 'bg-red-100 text-red-700' }
}
const OWASP_STATUS = {
  fulfilled: { dot: 'bg-green-500', text: 'text-green-700' },
  partial:   { dot: 'bg-amber-500', text: 'text-amber-700' },
  not:       { dot: 'bg-rose-500',  text: 'text-rose-700' },
  unknown:   { dot: 'bg-gray-300',  text: 'text-gray-400' },
}
const owaspPct = (v) => (typeof v === 'number' ? `${v}%` : '—')

function riskBand(v) {
  if (v >= 70) return { label: 'High',   color: '#e4502b', pill: 'bg-red-100 text-red-700' }
  if (v >= 40) return { label: 'Medium', color: '#d97706', pill: 'bg-amber-100 text-amber-700' }
  return { label: 'Low', color: '#16a34a', pill: 'bg-green-100 text-green-700' }
}
const GRADE_BG   = { A: '#16a34a', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' }
const GRADE_TEXT = { A: '#fff', B: '#1a2e05', C: '#422006', D: '#fff', F: '#fff' }
const GRADE_RANK = { A: 5, B: 4, C: 3, D: 2, F: 1 }

function Count({ n, tone }) {
  const color = n === 0 ? 'text-gray-300'
    : tone === 'error' ? 'text-red-600'
    : tone === 'warning' ? 'text-amber-600'
    : tone === 'owasp' ? 'text-red-700'
    : 'text-gray-500'
  return <span className={`tabular-nums font-medium ${color}`}>{n}</span>
}

const vlabel = (k) => CHECK_LABELS[k] || k

// Reusable white hover card rendered through a portal so it escapes the
// table's overflow clipping. `trigger` is what the user hovers; `children`
// is the card body. Stays open while the pointer is over the card.
function HoverCard({ trigger, children, width = 'w-72', onShow }) {
  const ref = useRef(null)
  const hideRef = useRef(null)
  const [pos, setPos] = useState(null)   // { left, top, above }

  function show() {
    clearTimeout(hideRef.current)
    const el = ref.current
    if (!el) return
    onShow?.()
    const r = el.getBoundingClientRect()
    const above = (window.innerHeight - r.bottom) < 320
    setPos({ left: r.left + r.width / 2, top: above ? r.top - 8 : r.bottom + 8, above })
  }
  const keep = () => clearTimeout(hideRef.current)
  const scheduleHide = () => { hideRef.current = setTimeout(() => setPos(null), 120) }

  return (
    <span ref={ref} className="relative inline-block" onMouseEnter={show} onMouseLeave={scheduleHide}>
      {trigger}
      {pos && createPortal(
        <div onMouseEnter={keep} onMouseLeave={scheduleHide}
          style={{ position: 'fixed', left: pos.left, top: pos.top,
            maxHeight: 'min(70vh, 440px)',
            transform: `translateX(-50%) ${pos.above ? 'translateY(-100%)' : ''}` }}
          className={`z-[200] ${width} text-left rounded-lg border border-gray-200 bg-white shadow-xl p-3 overflow-y-auto`}>
          {children}
        </div>,
        document.body
      )}
    </span>
  )
}

// Why this policy has its Risk %, derived from the template coverage gap.
function RiskTooltip({ risk, band, gap, template, children }) {
  const missing = gap?.missing || []
  const partial = gap?.partial || []
  const covered = gap?.covered || []
  const total = gap?.total || 0
  return (
    <HoverCard trigger={children} width="w-[22.5rem]">
      <>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-900">Risk — coverage gap</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-sm font-bold tabular-nums" style={{ color: band.color }}>{risk}%</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${band.pill}`}>{band.label}</span>
          </span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug mb-2">
          Share of template <span className="font-medium text-gray-700">{template || '—'}</span>&nbsp;protection
          the policy doesn’t fully block. <span className="font-medium text-gray-700">{covered.length}</span> of{' '}
          <span className="font-medium text-gray-700">{total}</span> violations blocked.
        </p>

        {missing.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Missing — not enabled ({missing.length})
            </div>
            <ul className="mt-0.5 pl-3.5">
              {missing.map(k => <li key={k} className="text-[11px] text-gray-700 leading-snug list-disc">{vlabel(k)}</li>)}
            </ul>
          </div>
        )}

        {partial.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Alarm-only — not blocking ({partial.length})
            </div>
            <ul className="mt-0.5 pl-3.5">
              {partial.map(k => <li key={k} className="text-[11px] text-gray-700 leading-snug list-disc">{vlabel(k)}</li>)}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Blocked ({covered.length})
        </div>
        <p className="mt-1 pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 leading-snug">
          Missing counts full weight, alarm-only counts half.
        </p>
      </>
    </HoverCard>
  )
}

// Severity presentation shared by the WAF Score and severity tooltips.
const SEV_META = {
  error:   { label: 'Errors',   dot: 'bg-rose-500',  text: 'text-rose-700',
             blurb: 'Serious misconfigurations that materially weaken protection.' },
  warning: { label: 'Warnings', dot: 'bg-amber-500', text: 'text-amber-700',
             blurb: 'Settings that should be reviewed or tightened.' },
  info:    { label: 'Info',     dot: 'bg-sky-500',   text: 'text-sky-700',
             blurb: 'Advisory best-practice suggestions.' },
}
const SEV_ORDER = { error: 0, warning: 1, info: 2 }

// One finding row: message (or violation) with its catalog score on the right.
function FindingRow({ f }) {
  return (
    <li className="flex items-start justify-between gap-2 py-0.5">
      <span className="text-[11px] text-gray-700 leading-snug">{f.message || f.violation}</span>
      {f.score ? <span className="text-[11px] text-gray-400 tabular-nums shrink-0">+{f.score}</span> : null}
    </li>
  )
}

// Loading / empty state used while a policy's findings are fetched on hover.
function FindingsBody({ findings, filter }) {
  if (findings === undefined || findings === null) {
    return <p className="text-[11px] text-gray-400">Loading findings…</p>
  }
  const list = (filter ? findings.filter(f => f.severity === filter) : findings)
    .slice().sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
      || (b.score || 0) - (a.score || 0))
  if (list.length === 0) return <p className="text-[11px] text-gray-400">No findings.</p>
  if (filter) {
    return <ul>{list.map((f, i) => <FindingRow key={i} f={f} />)}</ul>
  }
  // No filter → group by severity (used by the WAF Score card).
  return (
    <>
      {['error', 'warning', 'info'].map(sev => {
        const g = list.filter(f => f.severity === sev)
        if (!g.length) return null
        const m = SEV_META[sev]
        return (
          <div key={sev} className="mb-2 last:mb-0">
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${m.text}`}>
              <span className={`w-2 h-2 rounded-full inline-block ${m.dot}`} />{m.label} ({g.length})
            </div>
            <ul className="pl-0.5">{g.map((f, i) => <FindingRow key={i} f={f} />)}</ul>
          </div>
        )
      })}
    </>
  )
}

// WAF Score = configuration quality. Lists the findings (with scores) driving it.
function WafScoreTooltip({ grade, analysis, findings, onNeed, children }) {
  const a = analysis || {}
  const posture = configScore(a.score)
  return (
    <HoverCard trigger={children} onShow={onNeed} width="w-[25rem]">
      <>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-900">WAF Score — configuration quality</span>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-xs"
            style={{ background: GRADE_BG[grade], color: GRADE_TEXT[grade] }}>{grade}</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug mb-2">
          How the policy itself is configured — enforcement, signatures, learning and how violations
          are set. Posture <span className="font-medium text-gray-700">{posture}/100</span> ·
          penalty <span className="font-medium text-gray-700">{Math.round(a.score || 0)}</span> from
          the findings below. Independent of template coverage.
        </p>
        <FindingsBody findings={findings} />
      </>
    </HoverCard>
  )
}

// One severity's findings (with scores), shown on hover of an Error/Warning/Info count.
function SevTooltip({ severity, count, findings, onNeed, children }) {
  const m = SEV_META[severity]
  return (
    <HoverCard trigger={children} onShow={onNeed} width="w-[22.5rem]">
      <>
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-2 h-2 rounded-full inline-block ${m.dot}`} />
          <span className="text-xs font-semibold text-gray-900">{m.label} ({count})</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug mb-2">{m.blurb}</p>
        <FindingsBody findings={findings} filter={severity} />
      </>
    </HoverCard>
  )
}

// OWASP Top-10 compliance breakdown, opened from the OWASP % cell. Shows the
// overall %, then each defined category with its requirements (full detail
// lazy-loaded via /owasp; compact per-category scores show meanwhile).
function OwaspTooltip({ overall, compact, full, onNeed, onAck, children }) {
  const band = owaspBand(overall)
  const cats = full?.categories || null
  return (
    <HoverCard trigger={children} onShow={onNeed} width="w-[26rem]">
      <>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-900">OWASP Top 10 — compliance</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-sm font-bold tabular-nums" style={{ color: band.color }}>{overall}%</span>
          </span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug mb-2">
          {(compact?.defined ?? 0)} of {compact?.total_categories ?? 10} categories scored. Average compliance across
          the defined categories.
        </p>

        {cats === null ? (
          // Not loaded yet → show the compact per-category scores.
          <div className="space-y-1">
            {(compact?.categories || []).map(c => (
              <div key={c.id} className="flex items-center justify-between text-[11px]">
                <span className="text-gray-700"><span className="font-semibold">{c.id}</span> {c.name}</span>
                <span className="tabular-nums font-medium" style={{ color: typeof c.score === 'number' ? owaspBand(c.score).color : '#9ca3af' }}>{owaspPct(c.score)}</span>
              </div>
            ))}
            <div className="text-[10px] text-gray-400 pt-0.5">Loading requirement details…</div>
          </div>
        ) : (
          cats.map(c => (
            <div key={c.id} className="mb-2.5 last:mb-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-gray-900">{c.id} {c.name}</span>
                <span className="text-[11px] tabular-nums font-bold" style={{ color: typeof c.score === 'number' ? owaspBand(c.score).color : '#9ca3af' }}>{owaspPct(c.score)}</span>
              </div>
              {['Attack Signatures', 'Protections', 'Policy Entities', 'Best Practices', 'Virtual Server Protection'].map(group => {
                const items = c.requirements.filter(r => r.group === group)
                if (!items.length) return null
                return (
                  <div key={group} className="mb-1">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">{group}</div>
                    {items.map((r, i) => {
                      const st = OWASP_STATUS[r.status] || OWASP_STATUS.not
                      return (
                        <div key={i} className="flex items-start justify-between gap-2 leading-snug">
                          <span className="flex items-center gap-1.5 text-[11px] text-gray-700">
                            <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${st.dot}`} />{r.label}
                          </span>
                          {r.ackKey ? (
                            <button
                              onClick={() => onAck?.(r.ackKey, r.status !== 'fulfilled')}
                              className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded border transition-colors ${
                                r.status === 'fulfilled'
                                  ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                  : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                            >
                              {r.status === 'fulfilled' ? '✓ Accepted' : 'Accept'}
                            </button>
                          ) : (
                            <span className={`text-[10px] shrink-0 ${st.text}`}>{r.detail}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </>
    </HoverCard>
  )
}

export default function SecurityPosture() {
  const navigate = useNavigate()
  const [policies, setPolicies] = useState(null)
  const [wizard, setWizard] = useState(false)
  const [sortCol, setSortCol] = useState('risk')
  const [sortDir, setSortDir] = useState('desc')
  const [busyId, setBusyId] = useState(null)
  const [templateNames, setTemplateNames] = useState([])  // from Settings → Templates
  const [findingsById, setFindingsById] = useState({})     // lazy-loaded per policy for tooltips

  // Fetch a policy's findings once, on first tooltip hover.
  function ensureFindings(id) {
    setFindingsById(prev => {
      if (id in prev) return prev          // already loading or loaded
      getAuditPolicy(id)
        .then(d => setFindingsById(m => ({ ...m, [id]: d.findings || [] })))
        .catch(() => setFindingsById(m => ({ ...m, [id]: [] })))
      return { ...prev, [id]: null }       // null = loading
    })
  }

  const [owaspById, setOwaspById] = useState({})   // full OWASP detail, lazy per policy
  function ensureOwasp(id) {
    setOwaspById(prev => {
      if (id in prev) return prev
      getPolicyOwasp(id)
        .then(d => setOwaspById(m => ({ ...m, [id]: d })))
        .catch(() => setOwaspById(m => ({ ...m, [id]: null })))
      return { ...prev, [id]: null }
    })
  }
  // Accept/un-accept a non-derivable OWASP requirement; refresh the breakdown
  // and the cell % from the server response.
  async function ackOwasp(id, key, value) {
    try {
      const res = await setPolicyOwaspAck(id, { [key]: value })
      setOwaspById(m => ({ ...m, [id]: res.detail }))
      setPolicies(prev => prev.map(x => x.id === id
        ? { ...x, analysis: { ...(x.analysis || {}), owasp: res.owasp } } : x))
    } catch { toast.error('Could not save acceptance') }
  }

  // Template choices come from the Settings → Templates presets, not a fixed list.
  useEffect(() => {
    listTemplates()
      .then(t => setTemplateNames(Object.values(t || {}).map(v => v?.name).filter(Boolean)))
      .catch(() => setTemplateNames([]))
  }, [])

  // Persist a template change. If the policy has already been analyzed, re-run
  // the analysis so Risk (and OWASP) reflect the new template automatically.
  async function changeTemplate(p, template) {
    const prevTemplate = p.template
    setPolicies(prev => prev.map(x => x.id === p.id ? { ...x, template } : x))
    setBusyId(p.id)
    try {
      await setPolicyTemplate(p.id, template)
      if (p.analysis) {
        const res = await analyzePolicy(p.id)
        setPolicies(prev => prev.map(x => x.id === p.id
          ? { ...x, analysis: res.analysis, template: res.template, analyzed_at: new Date().toISOString() } : x))
        toast.success(template ? `Risk recalculated for ${template}` : 'Re-analyzed (no template — gap skipped)')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change template')
      setPolicies(prev => prev.map(x => x.id === p.id ? { ...x, template: prevTemplate } : x))
    } finally { setBusyId(null) }
  }

  async function reanalyze(p) {
    setBusyId(p.id)
    try {
      await setPolicyTemplate(p.id, p.template)   // honor the currently-selected template
      const res = await analyzePolicy(p.id)
      setPolicies(prev => prev.map(x => x.id === p.id
        ? { ...x, analysis: res.analysis, template: res.template, analyzed_at: new Date().toISOString() } : x))
      toast.success(`Analyzed ${p.name}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analyze failed')
    } finally { setBusyId(null) }
  }

  async function removePolicy(p) {
    if (!window.confirm(`Delete "${p.name}"? This removes it from the audit set.`)) return
    try {
      await deleteAuditPolicy(p.id)
      setPolicies(prev => prev.filter(x => x.id !== p.id))
      toast.success(`Deleted ${p.name}`)
    } catch { toast.error('Delete failed') }
  }

  useEffect(() => {
    listAuditPolicies()
      .then(ps => {
        const seen = new Map()
        for (const p of ps || []) if (!seen.has(p.name)) seen.set(p.name, p)
        setPolicies([...seen.values()])
      })
      .catch(() => setPolicies([]))
  }, [])

  const rows = useMemo(() => (policies || []).map(p => ({ p, ...metrics(p) })), [policies])

  function sortBy(col) {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir(col === 'name' ? 'asc' : 'desc') }
  }
  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1
    const key = (r) => {
      if (sortCol === 'name') return (r.p.name || '').toLowerCase()
      if (sortCol === 'template') return (r.p.template || '').toLowerCase()
      if (sortCol === 'waf_score') return GRADE_RANK[r.grade] ?? -1
      return r[sortCol] ?? -1   // risk / owasp / error / warning / info
    }
    return [...rows].sort((a, b) => { const av = key(a), bv = key(b); return av < bv ? -dir : av > bv ? dir : 0 })
  }, [rows, sortCol, sortDir])

  const SortHead = ({ col, label, center, className = '' }) => (
    <th onClick={() => sortBy(col)}
      className={`px-3 py-2 text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 group whitespace-nowrap
        ${center ? 'text-center' : 'text-left px-4'} ${className}`}>
      <span className={`inline-flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
        {label}
        {sortCol === col
          ? <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
          : <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
      </span>
    </th>
  )

  // Row cells reused by both the analyzed and not-analyzed branches.
  const templateCell = (p, extra = '') => {
    // Show every template from Settings; keep a policy's stale value visible too.
    // None = no template (gap analysis skipped) — always offered.
    const known = templateNames.includes(p.template)
    const opts = p.template && !known ? [p.template, ...templateNames] : templateNames
    return (
      <td className={`px-3 py-2 text-center ${extra}`}>
        <select value={p.template || NONE}
          onChange={e => changeTemplate(p, e.target.value === NONE ? '' : e.target.value)}
          disabled={busyId === p.id}
          className={`text-xs border border-gray-200 rounded px-2 py-1 bg-white ${busyId === p.id ? 'opacity-50 cursor-wait' : ''}`}>
          <option value={NONE}>None</option>
          {opts.map(nm => <option key={nm} value={nm}>{nm}</option>)}
        </select>
      </td>
    )
  }
  const Tip = ({ label }) => (
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow z-10">
      {label}
    </span>
  )
  const actionsCell = (p) => (
    <td className="px-3 py-2 text-right whitespace-nowrap">
      <span className="relative inline-block group mr-2 align-middle">
        <button onClick={() => downloadPolicySummary(p.id).catch(() => toast.error('Could not build summary'))} aria-label="Download summary"
          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          <svg className="w-4 h-4 block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
        <Tip label="Download summary" />
      </span>
      <span className="relative inline-block group mr-2 align-middle">
        <button onClick={() => downloadPolicyReport(p.id).catch(() => toast.error('Could not build report'))} aria-label="Download full report"
          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          <svg className="w-4 h-4 block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8M8 9h2" />
          </svg>
        </button>
        <Tip label="Download full report" />
      </span>
      <span className="relative inline-block group mr-2 align-middle">
        <button onClick={() => reanalyze(p)} disabled={busyId === p.id} aria-label="Re-analyze"
          className="p-1.5 rounded border border-gray-900 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40">
          <svg className={`w-4 h-4 block ${busyId === p.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
        <Tip label="Re-analyze" />
      </span>
      <span className="relative inline-block group align-middle">
        <button onClick={() => removePolicy(p)} aria-label="Delete"
          className="p-1.5 rounded border border-rose-600 bg-rose-600 text-white hover:bg-rose-700">
          <svg className="w-4 h-4 block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <Tip label="Delete" />
      </span>
    </td>
  )

  return (
    <div>
      {wizard && <ImportWizard onClose={() => { setWizard(false); listAuditPolicies().then(ps => { const m=new Map(); for(const p of ps||[]) if(!m.has(p.name)) m.set(p.name,p); setPolicies([...m.values()]) }).catch(()=>{}) }} />}
      <PageHeader
        title="WAF Policies Security Posture Overview"
        actions={<Btn variant="primary" onClick={() => setWizard(true)}>Import</Btn>}
      />

      <Card>
        <SectionHeader title="Security Posture" />
        {policies === null ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading policies…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No policies to report on.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <SortHead col="name" label="Policy" className="border-b border-gray-100" />
                  <SortHead col="waf_score" label="Config Quality" center className="border-l border-t border-dashed border-red-500" />
                  <SortHead col="error" label="Error" center className="border-t border-dashed border-red-500" />
                  <SortHead col="warning" label="Warning" center className="border-t border-dashed border-red-500" />
                  <SortHead col="info" label="Info" center className="border-r border-t border-dashed border-red-500" />
                  <SortHead col="owasp" label="OWASP" center className="border-l border-r border-t border-dashed border-red-500" />
                  <SortHead col="risk" label="Gap" center className="border-l border-t border-dashed border-red-500" />
                  <SortHead col="template" label="Template" center className="border-r border-t border-dashed border-red-500" />
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right border-b border-gray-100">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ p, analyzed, risk, grade, owasp, error, warning, info }, idx) => {
                  // Dashed group boxes: verticals run through every row; the bottom
                  // line is drawn only on the last row so the box closes once.
                  const last = idx === sorted.length - 1
                  const de = 'border-dashed border-red-500'
                  const gL = `border-l ${de}${last ? ' border-b' : ''}`    // group left edge
                  const gR = `border-r ${de}${last ? ' border-b' : ''}`    // group right edge
                  const gMid = last ? `border-b ${de}` : ''                // group middle col
                  const gSolo = `border-l border-r ${de}${last ? ' border-b' : ''}` // single-column group
                  if (!analyzed) {
                    return (
                      <tr key={p.id} className={`${last ? '' : 'border-b border-gray-50'} hover:bg-gray-50`}>
                        <td className="px-4 py-2"><button onClick={() => navigate(`/policies/${p.id}`)} className="font-medium text-blue-700 hover:underline text-xs text-left">{p.name}</button></td>
                        <td colSpan={4} className={`px-3 py-2 text-center text-xs text-gray-400 italic border-l border-r ${de}${last ? ' border-b' : ''}`}>Not analyzed yet</td>
                        <td className={`px-3 py-2 text-center ${gSolo}`}><span className="text-xs text-gray-300">—</span></td>
                        <td className={`px-3 py-2 text-center ${gL}`}><span className="text-xs text-gray-300">—</span></td>
                        {templateCell(p, gR)}
                        {actionsCell(p)}
                      </tr>
                    )
                  }
                  const band = risk === null ? null : riskBand(risk)
                  return (
                    <tr key={p.id} className={`${last ? '' : 'border-b border-gray-50'} hover:bg-gray-50`}>
                      <td className="px-4 py-2"><span className="font-medium text-gray-900 text-xs">{p.name}</span></td>
                      <td className={`px-3 py-2 text-center ${gL}`}>
                        <WafScoreTooltip grade={grade} analysis={p.analysis} findings={findingsById[p.id]} onNeed={() => ensureFindings(p.id)}>
                          <button onClick={() => navigate(`/policies/${p.id}`)} title="Open policy details"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm cursor-pointer transition hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
                            style={{ background: GRADE_BG[grade], color: GRADE_TEXT[grade] }}>{grade}</button>
                        </WafScoreTooltip>
                      </td>
                      <td className={`px-3 py-2 text-center ${gMid}`}>
                        <SevTooltip severity="error" count={error} findings={findingsById[p.id]} onNeed={() => ensureFindings(p.id)}><span className="cursor-default"><Count n={error} tone="error" /></span></SevTooltip>
                      </td>
                      <td className={`px-3 py-2 text-center ${gMid}`}>
                        <SevTooltip severity="warning" count={warning} findings={findingsById[p.id]} onNeed={() => ensureFindings(p.id)}><span className="cursor-default"><Count n={warning} tone="warning" /></span></SevTooltip>
                      </td>
                      <td className={`px-3 py-2 text-center ${gR}`}>
                        <SevTooltip severity="info" count={info} findings={findingsById[p.id]} onNeed={() => ensureFindings(p.id)}><span className="cursor-default"><Count n={info} tone="info" /></span></SevTooltip>
                      </td>
                      <td className={`px-3 py-2 text-center whitespace-nowrap ${gSolo}`}>
                        {owasp === null ? (
                          <span className="text-xs text-gray-400" title="Re-analyze to compute OWASP compliance">—</span>
                        ) : (
                          <OwaspTooltip overall={owasp} compact={p.analysis?.owasp} full={owaspById[p.id]} onNeed={() => ensureOwasp(p.id)} onAck={(key, val) => ackOwasp(p.id, key, val)}>
                            <button onClick={() => navigate(`/policies/${p.id}/owasp`)} title="Open OWASP compliance details"
                              className="text-sm font-semibold tabular-nums cursor-pointer hover:underline" style={{ color: owaspBand(owasp).color }}>{owasp}%</button>
                          </OwaspTooltip>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-center whitespace-nowrap ${gL}`}>
                        {band === null ? (
                          <span className="text-xs text-gray-400" title="Re-analyze with a template selected to measure coverage gap">—</span>
                        ) : (
                          <RiskTooltip risk={risk} band={band} gap={p.analysis?.gap} template={p.template}>
                            <button onClick={() => navigate(`/policies/${p.id}/risk`)} title="Open risk coverage-gap details"
                              className="inline-flex items-center cursor-pointer group">
                              <span className="text-sm font-semibold tabular-nums leading-none group-hover:underline" style={{ color: band.color }}>{risk}%</span>
                            </button>
                          </RiskTooltip>
                        )}
                      </td>
                      {templateCell(p, gR)}
                      {actionsCell(p)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
