import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, PageHeader, Btn } from '../components/ui'
import { getLtmAudit, downloadLtmReport, setLtmExclusion } from '../api/ltm'
import toast from 'react-hot-toast'
import LtmInventory from './LtmInventory'
import LtmDiagnostics from './LtmDiagnostics'
import AuditTable from '../components/AuditTable'
import { GraphsPanel } from '../components/GraphsModal'

const RATING = {
  High:   { dot: 'bg-rose-500',  pill: 'bg-red-100 text-red-700' },
  Medium: { dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700' },
  Low:    { dot: 'bg-sky-500',   pill: 'bg-sky-100 text-sky-700' },
}
const ORDER = { High: 0, Medium: 1, Low: 2 }

// Pull the F5 config object paths (/Common/foo …) out of a finding's details so
// the drawer can list the affected objects on their own lines.
function affectedObjects(details) {
  const m = String(details || '').match(/\/[^\s;,]+/g)
  return m ? Array.from(new Set(m)) : []
}

function FieldBlock({ label, children }) {
  if (children == null || children === '' || (Array.isArray(children) && !children.length)) return null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{label}</div>
      <div className="text-[13px] text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}

function FindingDrawer({ finding, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!finding) return null
  const r = RATING[finding.rating] || RATING.Low
  const objs = affectedObjects(finding.details)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={onClose}>
      <div className="h-full w-full max-w-xl bg-white shadow-xl flex flex-col animate-[slideIn_.15s_ease-out]"
        onMouseDown={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${r.pill}`}>{finding.rating}</span>
              {finding.name && <span className="text-[11px] font-mono text-gray-400">{finding.name}</span>}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{finding.title || finding.name}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <FieldBlock label="Details">{finding.details}</FieldBlock>
          <FieldBlock label="Recommendation"><span className="text-blue-700">{finding.additional}</span></FieldBlock>
          {finding.error && (
            <FieldBlock label="Error"><span className="font-mono text-[12px] text-gray-500">{finding.error}</span></FieldBlock>
          )}
          {objs.length > 0 && (
            <FieldBlock label={`Affected Objects (${objs.length})`}>
              <pre className="font-mono text-[11px] text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto">
                {objs.join('\n')}
              </pre>
            </FieldBlock>
          )}
        </div>
      </div>
    </div>
  )
}

function RatingPill({ value }) {
  const r = RATING[value] || RATING.Low
  return <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${r.pill}`}>{value || '—'}</span>
}

function RemoveBtn({ onClick, title }) {
  return (
    <button title={title} onClick={(e) => { e.stopPropagation(); onClick() }}
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
          {removed.map((r) => (
            <span key={r.key} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              <span className="line-through">{r.label}</span>
              <button title="Restore" onClick={() => onRestore(r.key)} className="text-gray-400 hover:text-teal-600 font-semibold">↩</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Findings({ items, empty, excluded, onExclude }) {
  const [active, setActive] = useState(null)
  const exSet = new Set(excluded || [])
  const rows = (items || []).filter((i) => !exSet.has(i.name))
  const removed = (items || []).filter((i) => exSet.has(i.name)).map((i) => ({ key: i.name, label: i.title || i.name }))
  const columns = [
    { key: 'rating', header: 'Severity', align: 'center',
      sortValue: (r) => ORDER[r.rating] ?? 9,
      cell: (r) => <RatingPill value={r.rating} /> },
    { key: 'title', header: 'Finding', cell: (r) => <span className="text-gray-800">{r.title || r.name}</span> },
    { key: 'details', header: 'Detail', sortable: false,
      cell: (r) => {
        const o = r.details || r.additional || ''
        return <span className="text-[12px] text-gray-500" title={o}>{o.length > 160 ? o.slice(0, 160) + '…' : o || '—'}</span>
      } },
  ]
  if (onExclude) columns.push({ key: '_rm', header: '', sortable: false, align: 'right',
    cell: (r) => <RemoveBtn title="Remove finding" onClick={() => onExclude('finding', r.name, true)} /> })
  return (
    <>
      <AuditTable pageSize={25} density="compact" defaultSortKey="rating" defaultSortDir="asc"
        onRowClick={setActive} columns={columns} rows={rows} emptyText={empty} />
      {onExclude && <RestoreBar removed={removed} onRestore={(k) => onExclude('finding', k, false)} />}
      {active && <FindingDrawer finding={active} onClose={() => setActive(null)} />}
    </>
  )
}

function Section({ title, children }) {
  return (
    <Card className="mb-4">
      <div className="px-4 py-2.5 border-b border-gray-100"><span className="text-sm font-semibold text-gray-900">{title}</span></div>
      <div className="p-4">{children}</div>
    </Card>
  )
}

function Stat({ label, value }) {
  return (
    <div className="text-center px-3">
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value ?? '—'}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

// Divider + label separating sub-sections inside a single panel.
function SubHead({ children }) {
  return (
    <div className="mt-5 mb-3 pt-4 border-t border-gray-100 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
      {children}
    </div>
  )
}

// Key/value cell for the System Details grid.
function KV({ label, children }) {
  const empty = children == null || children === '' || (Array.isArray(children) && !children.length)
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">{empty ? <span className="text-gray-300">—</span> : children}</dd>
    </div>
  )
}

// Memory strings come through as "7.8G" / "512M" / "4.9G"; normalise to MB.
const _UNIT_MB = { K: 1 / 1024, M: 1, G: 1024, T: 1024 * 1024 }
function toMB(s) {
  const m = String(s ?? '').match(/([\d.]+)\s*([KMGT])?/i)
  if (!m) return null
  const n = parseFloat(m[1])
  if (isNaN(n)) return null
  return Math.round(n * (_UNIT_MB[(m[2] || 'M').toUpperCase()] ?? 1))
}
const mb = (n) => (n == null ? null : n.toLocaleString() + ' MB')
// DNS / NTP server fields may hold several addresses separated by space or comma.
const servers = (s) => String(s ?? '').split(/[\s,]+/).filter(Boolean)

export default function LtmDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('device')

  useEffect(() => { getLtmAudit(id).then(setData).catch(() => setData('error')) }, [id])

  if (data === 'error') return (
    <div><PageHeader title="Device Audit" /><Card><div className="p-8 text-center text-sm text-gray-400">Audit not found.</div></Card></div>
  )
  if (!data) return (
    <div><PageHeader title="Device Audit" /><Card><div className="p-8 text-center text-sm text-gray-400">Loading…</div></Card></div>
  )

  const c = data.content || {}
  const f = data.findings || {}
  const excludedFindings = (data.excluded?.findings) || []
  const excludedDiag = (data.excluded?.diag) || []
  const exDiagSet = new Set(excludedDiag)
  const diagCount = ((f.diag?.cve || []).filter((d) => !exDiagSet.has(d.h_header)).length)
    + ((f.diag?.other || []).filter((d) => !exDiagSet.has(d.h_header)).length)
  const vsum = c.virtual_summary || {}
  const host = c.host_info || {}
  const ver = c.version_file || {}
  const hw = c.sys_hardware || {}
  const sdb = c.sysdb_file || {}
  const lcd = c.list_cm_device || {}
  const prov = c.sys_provision || []
  const activeModules = (c.license_file || {})['Active Modules'] || []

  const totalMB = toMB(host.memory_total)
  const usedMB = toMB(host.memory_used)
  const availMB = totalMB != null && usedMB != null ? totalMB - usedMB : null

  const platform = [hw.platform_name, hw.system_type].filter(Boolean).join(' · ')
  const hostname = sdb.hostname || lcd.hostname || host.hostname
  const version = [ver.Version, ver.Edition].filter(Boolean).join(' · ') || lcd.version
  const dns = servers(sdb['dns.nameservers'])
  const ntp = servers(sdb['ntp.servers'])
  const timezone = sdb['ntp.timezone'] || lcd['time-zone']
  const failover = sdb['failover.state'] || lcd['failover-state']

  const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )

  async function getReport(fmt) {
    const t = toast.loading(`Generating ${fmt === 'excel' ? 'Excel' : 'Word'} report…`)
    try { await downloadLtmReport(id, fmt); toast.success('Report downloaded', { id: t }) }
    catch (e) { toast.error(e.response?.data?.detail || e.message || 'Report failed', { id: t }) }
  }

  async function exclude(kind, key, on) {
    try {
      const updated = await setLtmExclusion(id, kind, key, on)
      setData(updated)
      toast.success(on ? 'Removed from report' : 'Restored')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Update failed')
    }
  }

  const back = (
    <div className="flex items-center gap-2">
      <Btn variant="secondary" size="sm" onClick={() => getReport('word')}><DownloadIcon /> Word</Btn>
      <Btn variant="secondary" size="sm" onClick={() => getReport('excel')}><DownloadIcon /> Excel</Btn>
      <Btn variant="secondary" size="sm" onClick={() => navigate('/ltm')}>← All Devices</Btn>
    </div>
  )

  const Tab = ({ id, label }) => (
    <button onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        tab === id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
      {label}
    </button>
  )

  return (
    <div>
      <PageHeader title={data.device_name} sub={`QKView ${data.qkview_id}${data.customer ? ' · ' + data.customer : ''}`} actions={back} />

      <div className="flex items-center gap-1.5 mb-4">
        <Tab id="device" label="Device Info" />
        <Tab id="inventory" label="Inventory" />
        <Tab id="ltm" label={`LTM Findings${(f.ltm || []).length ? ` (${(f.ltm || []).filter((x) => !excludedFindings.includes(x.name)).length})` : ''}`} />
        <Tab id="diagnostics" label={`Diagnostics${diagCount ? ` (${diagCount})` : ''}`} />
      </div>

      {tab === 'inventory' ? <LtmInventory content={c} />
       : tab === 'diagnostics' ? <LtmDiagnostics diag={f.diag} excluded={excludedDiag} onExclude={exclude} />
       : tab === 'ltm' ? (
      <>
      <Section title={`LTM Findings (${(f.ltm || []).length})`}>
        <Findings items={f.ltm} empty="No LTM best-practice issues found." excluded={excludedFindings} onExclude={exclude} />
      </Section>

      <Section title={`Bot Defense — ${(c.bot || []).length} profile(s), ${(f.bot || []).length} finding(s)`}>
        {(c.bot || []).length > 0 && (
          <div className="text-xs text-gray-500 mb-3">Profiles: {(c.bot || []).join(', ')}</div>
        )}
        <Findings items={f.bot} empty="No Bot-Defense issues found." excluded={excludedFindings} onExclude={exclude} />
      </Section>

      <Section title={`DDoS — ${(c.dos || []).length} profile(s), ${(f.dos || []).length} finding(s)`}>
        {(c.dos || []).length > 0 && (
          <div className="text-xs text-gray-500 mb-3">Profiles: {(c.dos || []).join(', ')}</div>
        )}
        <Findings items={f.dos} empty="No DoS/DDoS issues found." excluded={excludedFindings} onExclude={exclude} />
      </Section>
      </>
       ) : (
      <>
      <Section title="Device">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          <KV label="Platform">{platform}</KV>
          <KV label="Hostname"><span className="font-mono text-[13px]">{hostname}</span></KV>
          <KV label="Version"><span className="font-mono text-[13px]">{version}</span></KV>
          <KV label="Chassis ID"><span className="font-mono text-[12px]">{hw.system_chassis_serial}</span></KV>
          <KV label="DNS Servers"><span className="font-mono text-[13px]">{dns.join(', ')}</span></KV>
          <KV label="NTP Servers"><span className="font-mono text-[13px]">{ntp.join(', ')}</span></KV>
          <KV label="Time Zone">{timezone}</KV>
          <KV label="Licensed Modules">{activeModules.length ? `${activeModules.length} active` : null}</KV>
        </dl>

        <SubHead>Runtime</SubHead>
        <div className="flex flex-wrap justify-around gap-y-4 divide-x divide-gray-100">
          <Stat label="Failover State" value={failover ? <span className="capitalize">{failover}</span> : undefined} />
          <Stat label="Active CPUs" value={host.active_cpu_count ?? host.cpu_count} />
          <Stat label="Total Memory (MB)" value={mb(totalMB)} />
          <Stat label="Available Memory (MB)" value={mb(availMB)} />
        </div>

        <SubHead>Provisioned Modules{prov.length ? ` (${prov.length})` : ''}</SubHead>
        {prov.length ? (
          <div className="flex flex-wrap gap-2">
            {prov.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
                <span className="font-semibold text-gray-800 uppercase">{p.module}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{p.level}</span>
              </span>
            ))}
          </div>
        ) : <div className="text-sm text-gray-400">No modules provisioned.</div>}

        <SubHead>Licensed Modules{activeModules.length ? ` (${activeModules.length})` : ''}</SubHead>
        {activeModules.length ? (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {activeModules.map((m, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{m}</span>
            ))}
          </div>
        ) : <div className="text-sm text-gray-400">No licensed modules reported.</div>}
      </Section>

      <Section title="Virtual Server Profile Coverage">
        <div className="flex flex-wrap justify-around gap-y-4 divide-x divide-gray-100">
          <Stat label="Virtual Servers" value={vsum.count_vs} />
          <Stat label="with HTTP" value={vsum.count_vs_http} />
          <Stat label="with Client SSL" value={vsum.count_vs_client_ssl} />
          <Stat label="with Bot" value={vsum.count_vs_bot} />
          <Stat label="with DoS" value={vsum.count_vs_dos} />
          <Stat label="with ASM" value={vsum.count_vs_asm} />
        </div>
      </Section>

      <Section title="Resource Graphs">
        <GraphsPanel audit={data} big readOnly />
      </Section>
      </>
      )}
    </div>
  )
}
