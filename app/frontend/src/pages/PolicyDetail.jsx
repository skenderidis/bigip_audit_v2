import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import AuditTable from '../components/AuditTable'
import { getAuditPolicy, getPolicyConfig, analyzePolicy, deleteFinding, downloadPolicySummary, downloadPolicyReport } from '../api/auditPolicies'
import { configScore, configGrade } from '../lib/configScore'

// ── shared bits ──
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </svg>
)
const SevIcon = ({ sev }) => {
  if (sev === 'error') return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-label="Error">
      <circle cx="12" cy="12" r="10" fill="#dc2626" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
  if (sev === 'warning') return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-label="Warning">
      <path d="M12 3L1.5 21h21L12 3z" fill="#f59e0b" />
      <path d="M12 10v4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1.15" fill="#fff" />
    </svg>
  )
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-label="Info">
      <circle cx="12" cy="12" r="10" fill="#0ea5e9" />
      <circle cx="12" cy="7.8" r="1.15" fill="#fff" />
      <path d="M12 11v5.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
const SEV_LABEL = { error: 'Error', warning: 'Warning', info: 'Info' }

const YesNo = ({ v }) => v === true
  ? <span className="text-emerald-600 font-semibold">✓</span>
  : v === false ? <span className="text-rose-600 font-semibold">✕</span>
  : <span className="text-gray-300">—</span>

function PanelHeader({ title, actions }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
      <span className="text-sm font-semibold text-gray-900">{title}</span>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

const GRADE = configGrade   // shared with the WAF posture table (/waf)

const val = (v) => (v === null || v === undefined || v === '') ? <span className="text-gray-300">—</span>
  : typeof v === 'boolean' ? <YesNo v={v} /> : Array.isArray(v) ? (v.length ? v.join(', ') : <span className="text-gray-300">—</span>) : String(v)

// small table helper for the config tabs
const Tbl = ({ title, cols, rows, empty, bordered }) => (
  <Card>
    <PanelHeader title={`${title} (${rows?.length ?? 0})`} />
    <div className="p-3">
      <AuditTable columns={cols} rows={rows || []} searchable={(rows || []).length > 10} pageSize={10} density="compact" bordered emptyText={empty || 'No entries.'} />
    </div>
  </Card>
)

const TABS = ['Overview', 'General', 'Signatures', 'Compliance/Evasion/IPI', 'File Types', 'URLs', 'Parameters', 'Cookies/Headers', 'Methods/Response/Domains', 'Other']

export default function PolicyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pol, setPol] = useState(null)      // { name, findings, analysis } | 'error'
  const [cfg, setCfg] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [busy, setBusy] = useState(false)

  const load = () => {
    getAuditPolicy(id).then(setPol).catch(() => setPol('error'))
    getPolicyConfig(id).then(setCfg).catch(() => setCfg(null))
  }
  useEffect(load, [id])   // eslint-disable-line react-hooks/exhaustive-deps

  const findings = (pol && pol !== 'error' ? pol.findings : null) || []
  const counts = useMemo(() => findings.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a }, { error: 0, warning: 0, info: 0 }), [findings])
  const score = useMemo(() => configScore(findings.reduce((s, f) => s + (Number(f.score) || 0), 0)), [findings])
  // Only show a grade once the policy is loaded AND analyzed — otherwise the
  // empty-findings fallback (score 100) would briefly flash an "A".
  const analyzed = pol && pol !== 'error' && pol.analyzed_at != null
  const grade = analyzed ? GRADE(score) : null

  async function rediscover() {
    setBusy(true)
    try { await analyzePolicy(id); toast.success('Re-analyzed'); load() }
    catch (e) { toast.error(e.response?.data?.detail || 'Analyze failed') }
    finally { setBusy(false) }
  }
  async function removeFinding(idx) {
    try {
      const res = await deleteFinding(id, idx)
      setPol(prev => ({ ...prev, findings: res.findings, analysis: res.analysis }))
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed') }
  }
  if (pol === 'error') return (
    <div className="text-sm text-gray-500 py-10 text-center">Policy not found
      <div className="mt-3"><button onClick={() => navigate('/waf')} className="text-blue-700 hover:underline">← Back to policies</button></div>
    </div>
  )

  return (
    <div>
      <button onClick={() => navigate('/waf')} className="text-xs text-blue-700 hover:underline">← Back to policies</button>
      <PageHeader title={`ASM Policy: ${pol?.name ?? ''}`} actions={<>
        <Btn variant="secondary" size="sm" onClick={() => downloadPolicySummary(id)}>
          <DownloadIcon /> Summary
        </Btn>
        <Btn variant="secondary" size="sm" onClick={() => downloadPolicyReport(id)}>
          <DownloadIcon /> Full report
        </Btn>
      </>} />

      {/* top row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'minmax(280px, 32%) 1fr' }}>
        {/* Overview */}
        <Card>
          <PanelHeader title="Overview" />
          <div className="p-4">
            <div className="grid grid-cols-3 divide-x divide-gray-100 text-center mb-5">
              <div><div className="flex items-center justify-center gap-1 text-rose-600 text-sm font-medium"><SevIcon sev="error" /> Error</div><div className="text-2xl font-bold text-gray-900 mt-1">{counts.error}</div></div>
              <div><div className="flex items-center justify-center gap-1 text-amber-500 text-sm font-medium"><SevIcon sev="warning" /> Warning</div><div className="text-2xl font-bold text-gray-900 mt-1">{counts.warning}</div></div>
              <div><div className="flex items-center justify-center gap-1 text-sky-500 text-sm font-medium"><SevIcon sev="info" /> Info</div><div className="text-2xl font-bold text-gray-900 mt-1">{counts.info}</div></div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">Score:</div>
              <div className="mx-auto rounded-2xl flex items-center justify-center" style={{ width: 160, height: 160, background: grade ? grade.bg : '#e5e7eb' }}>
                <span className="text-white font-bold" style={{ fontSize: '5rem', lineHeight: 1 }}>{grade ? grade.g : '–'}</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">{grade ? `Score: ${score}/100` : (pol === 'error' ? 'error' : pol ? 'not analyzed' : 'loading…')}</div>
            </div>
          </div>
        </Card>

        {/* Suggestions */}
        <Card>
          <PanelHeader title="Suggestions" actions={<>
            <button onClick={rediscover} disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 inline-flex items-center gap-1.5">
              <svg className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
              Re-Analyze
            </button>
          </>} />
          <div className="p-3">
            <AuditTable pageSize={10} density="compact" defaultSortKey="severity" defaultSortDir="asc"
              columns={[
                { key: '_icon', header: '', sortable: false, cell: (r) => <SevIcon sev={r.severity} /> },
                { key: 'message', header: 'Suggestions' },
                { key: 'severity', header: 'Severity', cell: (r) => SEV_LABEL[r.severity] || r.severity, sortValue: (r) => ({ error: 0, warning: 1, info: 2 }[r.severity] ?? 9) },
                { key: 'category', header: 'Category' },
                { key: '_del', header: '', sortable: false, align: 'right', cell: (r) => (
                  <button onClick={() => removeFinding(r._idx)} title="Dismiss suggestion" className="text-gray-300 hover:text-rose-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                ) },
              ]}
              rows={findings.map((f, i) => ({ ...f, _idx: i }))} emptyText="No suggestions — not analyzed yet." />
          </div>
        </Card>
      </div>

      {/* Configuration Review */}
      <Card>
        <PanelHeader title="Configuration Review"
          actions={<button onClick={() => navigate(`/policies/${id}/edit`)}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700">Policy details</button>} />
        <div className="px-4 pt-2 border-b border-gray-100 flex flex-wrap gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-xs px-3 py-2 -mb-px border-b-2 ${tab === t ? 'border-gray-900 text-gray-900 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="p-4">
          {cfg === null ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading configuration…</div>
          ) : (
            <ConfigTab tab={tab} cfg={cfg} />
          )}
        </div>
      </Card>
    </div>
  )
}

// ── Configuration Review tab bodies ──
function ConfigTab({ tab, cfg }) {
  const L = cfg.lists || {}
  const col = (key, header, opts = {}) => ({ key, header, ...opts })
  // sortValue is needed because the cell renders a <YesNo> element; without it
  // AuditTable sorts on the element's (empty) text and nothing moves.
  const bool = (key, header) => ({ key, header, align: 'center', cell: (r) => <YesNo v={r[key]} />, sortValue: (r) => (r[key] ? 1 : 0) })

  if (tab === 'Overview') {
    const c = cfg.counts || {}
    const entRows = [
      ['File Types', c.file_types], ['URLs', c.urls], ['Parameters', c.parameters],
      ['Signatures', c.signatures], ['Cookies', c.cookies], ['HTTP Compliance', c.compliance],
      ['Evasion', c.evasion], ['Methods', c.methods],
    ].map(([name, v]) => ({ name, total: v?.total ?? 0, staging: `Staging:${v?.staging ?? 0} / Disabled:${v?.disabled ?? 0}` }))
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <PanelHeader title="Entity Totals" />
          <div className="p-3"><AuditTable searchable={false} pageSize={20}
            columns={[col('name', 'Entity Type'), col('total', 'Total', { align: 'center' }), col('staging', 'Staging')]} rows={entRows} density="compact" bordered /></div>
        </Card>
        <Card>
          <PanelHeader title="Blocking Settings" />
          <div className="p-3"><AuditTable pageSize={10}
            columns={[col('name', 'Blocking Settings'), bool('learn', 'Learn'), bool('alarm', 'Alarm'), bool('block', 'Block')]}
            rows={cfg.blocking_settings || []} density="compact" bordered /></div>
        </Card>
      </div>
    )
  }

  if (tab === 'General') {
    const g = cfg.general || {}
    return (
      <Card>
        <PanelHeader title="General" />
        <table className="w-full text-xs border-collapse border border-gray-200">
          <tbody>
            {Object.entries(g).map(([k, v]) => (
              <tr key={k} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-1.5 text-gray-500 font-medium w-72 border border-gray-200">{k}</td>
                <td className="px-3 py-1.5 text-gray-800 border border-gray-200">{val(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    )
  }

  if (tab === 'Signatures') {
    return <Tbl title="Signature Sets" rows={L.signature_sets}
      cols={[col('name', 'Signature Set'), bool('learn', 'Learn'), bool('alarm', 'Alarm'), bool('block', 'Block')]} />
  }

  if (tab === 'Compliance/Evasion/IPI') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Tbl bordered title="HTTP Compliance" rows={L.compliance}
          cols={[{ key: 'description', header: 'Check', cell: (r) => r.description || r.name }, bool('enabled', 'Enabled')]} />
        <Tbl bordered title="Evasion" rows={L.evasions}
          cols={[{ key: 'description', header: 'Technique', cell: (r) => r.description || r.name }, bool('enabled', 'Enabled')]} />
      </div>
    )
  }

  if (tab === 'File Types') {
    return <Tbl title="File Types" rows={L.file_types}
      cols={[col('name', 'Name'), col('type', 'Type'), bool('performStaging', 'Staging'),
        bool('checkRequestLength', 'Request Length'), { key: 'responseCheck', header: 'Response Check', align: 'center', cell: (r) => <YesNo v={r.responseCheck} /> }]} />
  }

  if (tab === 'URLs') {
    return <Tbl title="URLs" rows={L.urls}
      cols={[col('name', 'URL'), col('method', 'Method'), col('protocol', 'Protocol'), col('type', 'Type'),
        bool('performStaging', 'Staging'), { key: 'attackSignaturesCheck', header: 'Sig Check', align: 'center', cell: (r) => <YesNo v={r.attackSignaturesCheck} /> }]} />
  }

  if (tab === 'Parameters') {
    return <Tbl title="Parameters" rows={L.parameters}
      cols={[col('name', 'Name'), col('type', 'Type'), { key: 'valueType', header: 'Value Type', cell: (r) => r.valueType || r.parameterLocation },
        col('level', 'Level', { cell: (r) => r.level || r.parameterLocation }), bool('performStaging', 'Staging'),
        { key: 'attackSignaturesCheck', header: 'Sig Check', align: 'center', cell: (r) => <YesNo v={r.attackSignaturesCheck} /> },
        { key: 'sensitiveParameter', header: 'Sensitive', align: 'center', cell: (r) => <YesNo v={r.sensitiveParameter} /> },
        { key: 'maximumLength', header: 'Max Len', align: 'right' }]} />
  }

  if (tab === 'Cookies/Headers') {
    return (
      <div className="space-y-4">
        <Tbl title="Cookies" rows={L.cookies}
          cols={[col('name', 'Cookie'), col('type', 'Type'), { key: 'enforcementType', header: 'Enforcement' },
            { key: 'attackSignaturesCheck', header: 'Sig Check', align: 'center', cell: (r) => <YesNo v={r.attackSignaturesCheck} /> }]} />
        <Tbl title="Headers" rows={L.headers}
          cols={[col('name', 'Header'), col('type', 'Type'), { key: 'mandatory', header: 'Mandatory', align: 'center', cell: (r) => <YesNo v={r.mandatory} /> },
            { key: 'checkSignatures', header: 'Sig Check', align: 'center', cell: (r) => <YesNo v={r.checkSignatures} /> },
            bool('base64Decoding', 'Base64')]} />
      </div>
    )
  }

  if (tab === 'Methods/Response/Domains') {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Tbl title="Methods" rows={L.methods} cols={[{ key: 'name', header: 'Method', cell: (r) => r.name || r.method || r }]} />
        <Tbl title="Response Codes" rows={L.response_codes} cols={[{ key: 'code', header: 'Code', cell: (r) => (typeof r === 'object' ? (r.responseCode ?? r.code ?? JSON.stringify(r)) : r) }]} />
        <Tbl title="Redirection Domains" rows={L.redirection_domains} cols={[{ key: 'domain', header: 'Domain', cell: (r) => (typeof r === 'object' ? (r.domainName ?? r.name ?? JSON.stringify(r)) : r) }]} />
      </div>
    )
  }

  if (tab === 'Other') {
    return (
      <div className="space-y-4">
        <Tbl title="Trusted IPs" rows={L.trusted_ips} cols={[{ key: 'ip', header: 'IP', cell: (r) => (typeof r === 'object' ? (r.ipAddress ?? r.name ?? JSON.stringify(r)) : r) }]} />
        <Tbl title="Sensitive Parameters" rows={L.sensitive_parameters} cols={[{ key: 'name', header: 'Name', cell: (r) => (typeof r === 'object' ? (r.name ?? JSON.stringify(r)) : r) }]} />
        <Tbl title="Login Pages" rows={L.login_pages} cols={[{ key: 'url', header: 'URL', cell: (r) => (typeof r === 'object' ? (r.url?.name ?? r.name ?? JSON.stringify(r)) : r) }]} />
      </div>
    )
  }
  return null
}
