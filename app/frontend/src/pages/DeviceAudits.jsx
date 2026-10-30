import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import AuditTable from '../components/AuditTable'
import GraphsModal from '../components/GraphsModal'
import { listLtmAudits, createLtmAuditStream, deleteLtmAudit, downloadLtmReport } from '../api/ltm'

const DOMAIN = {
  ltm:  { title: 'LTM — Configuration Review', key: 'ltm', blurb: 'Device best-practice findings from an F5 iHealth QKView.' },
  bot:  { title: 'Bot Defense', key: 'bot', blurb: 'Bot-Defense profile inventory and checks per device.' },
  dos:  { title: 'DDoS', key: 'dos', blurb: 'DoS/DDoS profile inventory and checks per device.' },
}

const fmtDate = (s) => { try { return new Date(s).toLocaleString() } catch { return s } }

function Counts({ c }) {
  if (!c) return <span className="text-gray-400">—</span>
  const pill = (n, cls) => <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{n}</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      {pill(c.High || 0, 'bg-red-100 text-red-700')}
      {pill(c.Medium || 0, 'bg-amber-100 text-amber-700')}
      {pill(c.Low || 0, 'bg-sky-100 text-sky-700')}
    </span>
  )
}

export default function DeviceAudits({ domain = 'ltm' }) {
  const d = DOMAIN[domain] || DOMAIN.ltm
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [qkview, setQkview] = useState('')
  const [customer, setCustomer] = useState('')
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState(null)   // { i, n, label }
  const [log, setLog] = useState([])       // list of iHealth calls, most recent last
  const [graphAudit, setGraphAudit] = useState(null)   // row whose graphs modal is open

  const load = () => listLtmAudits().then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  async function create() {
    if (!qkview.trim()) { toast.error('Enter a QKView ID'); return }
    setBusy(true)
    setProg({ i: 0, n: 0, label: 'Connecting to F5 iHealth…' })
    setLog([])
    const t = toast.loading('Pulling QKView from iHealth…')
    try {
      const row = await createLtmAuditStream(
        { qkview_id: qkview.trim(), customer: customer.trim() || null },
        (evt) => {
          if (evt.type === 'progress') {
            setProg({ i: evt.i, n: evt.n, label: evt.label })
            setLog((l) => [...l, { i: evt.i, n: evt.n, label: evt.label }])
          }
        },
      )
      toast.success(`Audited ${row.device_name}`, { id: t })
      setQkview(''); setCustomer('')
      await load()
      navigate(`/ltm/${row.id}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Audit failed', { id: t })
    } finally {
      setBusy(false)
      setProg(null)
    }
  }

  async function remove(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this device audit?')) return
    try { await deleteLtmAudit(id); await load() }
    catch { toast.error('Delete failed') }
  }

  async function report(id, fmt, e) {
    e.stopPropagation()
    const t = toast.loading(`Generating ${fmt === 'excel' ? 'Excel' : 'Word'} report…`)
    try { await downloadLtmReport(id, fmt); toast.success('Report downloaded', { id: t }) }
    catch (err) { toast.error(err.response?.data?.detail || err.message || 'Report failed', { id: t }) }
  }

  const DocIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8.5 13h7M8.5 16.5h7" />
    </svg>
  )
  const reportBtn = (id, fmt, label) => (
    <button onClick={(e) => report(id, fmt, e)} title={`Download ${label} report`}
      className={`p-1 rounded hover:bg-gray-100 ${fmt === 'word' ? 'text-blue-600' : 'text-green-600'}`}>
      <DocIcon />
    </button>
  )

  const field = 'text-sm px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10'

  return (
    <div>
      <PageHeader title={d.title} sub={d.blurb} />

      {domain === 'ltm' && (
        <Card className="mb-4">
          <div className="p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">QKView ID</label>
              <input className={field} value={qkview} onChange={e => setQkview(e.target.value)}
                placeholder="e.g. 123456" disabled={busy} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer (optional)</label>
              <input className={field} value={customer} onChange={e => setCustomer(e.target.value)}
                placeholder="e.g. Acme Corp" disabled={busy} />
            </div>
            <Btn variant="primary" size="md" onClick={create} disabled={busy}>
              {busy ? 'Pulling…' : 'New Audit'}
            </Btn>
            <p className="text-[11px] text-gray-400 basis-full">
              Requires iHealth credentials (Settings → iHealth Credentials). The QKView must already be uploaded to iHealth.
            </p>
          </div>

          {prog && (
            <div className="border-t border-gray-100 p-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-gray-700">
                  {prog.n ? `Pulling from iHealth — step ${prog.i} of ${prog.n}` : 'Connecting…'}
                </span>
                {prog.n > 0 && <span className="text-gray-400 tabular-nums">{Math.round((prog.i / prog.n) * 100)}%</span>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${prog.n ? Math.round((prog.i / prog.n) * 100) : 6}%` }} />
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-gray-600 truncate">{prog.label}</div>
              {log.length > 1 && (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-md bg-gray-50 border border-gray-100 p-2 font-mono text-[10.5px] leading-relaxed text-gray-500">
                  {log.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-300 tabular-nums shrink-0">{String(s.i).padStart(2, '0')}</span>
                      <span className={`truncate ${i === log.length - 1 ? 'text-gray-800' : ''}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="p-3">
          <AuditTable pageSize={15} density="compact"
            columns={[
              { key: 'device_name', header: 'Device' },
              { key: 'qkview_id', header: 'QKView' },
              { key: 'customer', header: 'Customer', cell: (r) => r.customer || '—' },
              ...(domain === 'ltm'
                ? [
                    { key: '_ltm', header: 'LTM', sortable: false, cell: (r) => <Counts c={r.summary?.ltm} /> },
                    { key: '_cve', header: 'CVE', sortable: false, cell: (r) => <Counts c={r.summary?.cve} /> },
                    { key: '_other', header: 'Other', sortable: false, cell: (r) => <Counts c={r.summary?.other} /> },
                  ]
                : [
                    { key: '_counts', header: `${d.title.split(' ')[0]} findings`, sortable: false,
                      cell: (r) => <Counts c={r.summary?.[d.key]} /> },
                  ]),
              { key: 'created_at', header: 'Created', cell: (r) => fmtDate(r.created_at) },
              ...(domain === 'ltm'
                ? [{ key: '_report', header: 'Report', sortable: false,
                    cell: (r) => (
                      <span className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {reportBtn(r.id, 'word', 'Word')}
                        {reportBtn(r.id, 'excel', 'Excel')}
                      </span>
                    ) },
                   { key: '_graphs', header: 'Graphs', sortable: false,
                    cell: (r) => {
                      const nn = (r.graph_keys || []).length
                      return (
                        <button onClick={(e) => { e.stopPropagation(); setGraphAudit(r) }}
                          title="Upload resource graphs"
                          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded hover:bg-gray-100 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 15l4-4 4 4 3-3 5 5M9 9a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                          <span className="tabular-nums">{nn}/6</span>
                        </button>
                      )
                    } }]
                : []),
              { key: '_del', header: '', sortable: false, align: 'right',
                cell: (r) => (
                  <button onClick={(e) => remove(r.id, e)} title="Delete" className="text-gray-300 hover:text-rose-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                ) },
            ]}
            rows={rows || []}
            onRowClick={(r) => navigate(`/ltm/${r.id}`)}
            emptyText={rows === null ? 'Loading…' : 'No device audits yet.'} />
        </div>
      </Card>

      {graphAudit && (
        <GraphsModal audit={graphAudit} onClose={() => setGraphAudit(null)} onChanged={load} />
      )}
    </div>
  )
}
