import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import { getAuditPolicy, getPolicyRisk, setPolicyTemplate, analyzePolicy, downloadPolicyCoverageGapReport } from '../api/auditPolicies'
import { listTemplates } from '../api/templates'
import { CHECK_LABELS, CHECK_EXPLAIN, GROUPS, GROUP_OF } from '../lib/auditChecks'

const vlabel = (k) => CHECK_LABELS[k] || k

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </svg>
)

// Risk band (higher = worse coverage, so red at the top — inverse of OWASP).
function riskBand(v) {
  if (v >= 70) return { label: 'High',   color: '#e4502b', pill: 'bg-red-100 text-red-700' }
  if (v >= 40) return { label: 'Medium', color: '#d97706', pill: 'bg-amber-100 text-amber-700' }
  return { label: 'Low', color: '#16a34a', pill: 'bg-green-100 text-green-700' }
}

const STATE = {
  missing: { dot: 'bg-rose-500',  text: 'text-rose-700',  label: 'Not enabled',  weight: 'full weight' },
  partial: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Alarm only',   weight: 'half weight' },
  covered: { dot: 'bg-green-500', text: 'text-green-700', label: 'Blocked',      weight: '' },
}

const GROUP_LABEL = Object.fromEntries(GROUPS.map(g => [g.key, g.label]))

// Group a list of VIOL_ keys by their catalog group, in GROUPS order.
function byGroup(keys) {
  const out = []
  for (const g of GROUPS) {
    const items = keys.filter(k => (GROUP_OF[k] || 'general') === g.key)
    if (items.length) out.push({ key: g.key, label: g.label, items })
  }
  // anything with an unknown group
  const other = keys.filter(k => !(k in GROUP_OF))
  if (other.length) out.push({ key: 'other', label: 'Other', items: other })
  return out
}

function ViolRow({ k, state }) {
  const st = STATE[state]
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="flex items-start gap-2 text-[13px] text-gray-700 min-w-0">
        <span className={`w-2 h-2 rounded-full inline-block shrink-0 mt-1 ${st.dot}`} />
        <span className="min-w-0">
          <span className="font-medium">{vlabel(k)}</span>
          {CHECK_EXPLAIN[k] && <span className="block text-[11px] text-gray-400 leading-snug">{CHECK_EXPLAIN[k]}</span>}
        </span>
      </span>
      <span className={`text-[11px] shrink-0 ${st.text}`}>{st.label}</span>
    </div>
  )
}

// A bucket section (Missing / Partial / Covered), violations grouped by catalog group.
function Bucket({ state, keys, open, onToggle }) {
  const st = STATE[state]
  const title = { missing: 'Not enabled', partial: 'Alarm only — not blocking', covered: 'Blocked' }[state]
  const groups = useMemo(() => byGroup(keys), [keys])
  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50" onClick={onToggle}>
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${st.dot}`} />
          {title}
          <span className="text-gray-400 font-normal">({keys.length})</span>
          {st.weight && <span className="text-[10px] text-gray-400 font-normal">· counts {st.weight}</span>}
        </span>
        <span className="text-gray-300 text-xs">{open ? '▾' : '▸'}</span>
      </div>
      {open && keys.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2">
          {groups.map(g => (
            <div key={g.key} className="mb-2 last:mb-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{g.label}</div>
              <div className="divide-y divide-gray-50">
                {g.items.map(k => <ViolRow key={k} k={k} state={state} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && keys.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">None.</div>
      )}
    </Card>
  )
}

export default function RiskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [data, setData] = useState(null)   // { risk, total, template, missing, partial, covered } | 'error'
  const [open, setOpen] = useState({ missing: true, partial: true, covered: false })
  const [templateNames, setTemplateNames] = useState([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    getAuditPolicy(id).then(d => setName(d.name || `Policy ${id}`)).catch(() => setName(`Policy ${id}`))
    getPolicyRisk(id).then(setData).catch(() => setData('error'))
    listTemplates()
      .then(t => setTemplateNames(Object.values(t || {}).map(v => v?.name).filter(Boolean)))
      .catch(() => setTemplateNames([]))
  }, [id])

  // Switch the policy's template, re-analyze (so the stored Risk the Security
  // Posture page reads stays in sync), then refresh this page's gap.
  async function changeTemplate(template) {
    if (!template || template === data.template) return
    setSwitching(true)
    try {
      await setPolicyTemplate(id, template)
      await analyzePolicy(id)
      const fresh = await getPolicyRisk(id)
      setData(fresh)
      toast.success(`Template set to ${template}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change template')
    } finally { setSwitching(false) }
  }

  const templateSelect = (
    <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      Template
      <select
        value={(data && data !== 'error' && data.template) || ''}
        onChange={e => changeTemplate(e.target.value)}
        disabled={switching}
        className={`text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 ${switching ? 'opacity-50 cursor-wait' : ''}`}>
        {(data && data !== 'error' && data.template && !templateNames.includes(data.template)) && (
          <option value={data.template}>{data.template}</option>
        )}
        {templateNames.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  )

  if (data === 'error') return (
    <div><PageHeader title="Coverage Gap" /><Card><div className="p-8 text-center text-sm text-gray-400">Could not load risk. Re-analyze the policy and try again.</div></Card></div>
  )
  if (!data) return (
    <div><PageHeader title="Coverage Gap" /><Card><div className="p-8 text-center text-sm text-gray-400">Loading…</div></Card></div>
  )

  const back = (
    <div className="flex items-center gap-3">
      {templateSelect}
      {data.total ? (
        <Btn variant="secondary" size="sm"
          onClick={() => downloadPolicyCoverageGapReport(id).catch(() => toast.error('Could not build the report'))}>
          <DownloadIcon /> Coverage Gap Report
        </Btn>
      ) : null}
      <Btn variant="secondary" size="sm" onClick={() => navigate('/waf')}>← All Policies</Btn>
    </div>
  )

  if (!data.total) return (
    <div>
      <PageHeader title="Coverage Gap" sub={name} actions={back} />
      <Card><div className="p-8 text-center text-sm text-gray-400">
        No template selected for this policy. Choose a template on the WAF page and re-analyze to measure the coverage gap.
      </div></Card>
    </div>
  )

  const band = riskBand(data.risk)
  const coveredN = data.covered.length
  return (
    <div>
      <PageHeader title="Coverage Gap" sub={name} actions={back} />

      {/* Overall summary */}
      <Card className="mb-5">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl shrink-0"
              style={{ background: `${band.color}15`, border: `2px solid ${band.color}` }}>
              <span className="text-2xl font-bold tabular-nums" style={{ color: band.color }}>{data.risk}%</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Coverage gap</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${band.pill}`}>{band.label}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Share of template <span className="font-medium text-gray-700">{data.template || '—'}</span> protection
                the policy doesn’t fully block.
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{data.missing.length} not enabled</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{data.partial.length} alarm only</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{coveredN} blocked</span>
              </div>
            </div>
          </div>
          <div className="flex-1 sm:text-right">
            <div className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700 text-sm tabular-nums">{coveredN}</span> of{' '}
              <span className="font-semibold text-gray-700 text-sm tabular-nums">{data.total}</span> template violations fully blocked
            </div>
            <p className="text-[11px] text-gray-400 mt-1 sm:max-w-xs sm:ml-auto leading-snug">
              Risk weights each gap: a violation that is <span className="text-rose-600">not enabled</span> counts full,
              one that only <span className="text-amber-600">alarms</span> counts half. Transparent mode is a WAF-Score
              issue, not a coverage gap, so it isn’t counted here.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Bucket state="missing" keys={data.missing} open={open.missing} onToggle={() => setOpen(o => ({ ...o, missing: !o.missing }))} />
        <Bucket state="partial" keys={data.partial} open={open.partial} onToggle={() => setOpen(o => ({ ...o, partial: !o.partial }))} />
        <Bucket state="covered" keys={data.covered} open={open.covered} onToggle={() => setOpen(o => ({ ...o, covered: !o.covered }))} />
      </div>
    </div>
  )
}
