import { useState, useEffect, useRef } from 'react'
import { Card, PageHeader, SectionHeader, Btn, Input, Toggle, Badge } from '../components/ui'
import { refStatus, importReference, pullReference, refSignatures, refSignatureSets } from '../api/reference'

const RISK_COLOR = (r) => { const v = (r || '').toLowerCase(); return v === 'high' ? 'text-red-600' : v === 'medium' ? 'text-yellow-600' : v === 'low' ? 'text-green-600' : 'text-gray-400' }
const ACC_COLOR = (a) => { const v = (a || '').toLowerCase(); return v === 'high' ? 'text-green-600' : v === 'medium' ? 'text-yellow-600' : v === 'low' ? 'text-red-600' : 'text-gray-400' }

// Settings → Signatures: refresh the WAF reference data (attack signatures +
// signature sets) used for OWASP compliance scoring — by file upload or by
// pulling from a live F5 BIG-IP.
export default function SignatureSettings() {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(null)        // 'import' | 'pull'
  const [banner, setBanner] = useState(null)    // { kind, text }
  const sigFile = useRef(null)
  const setFile = useRef(null)
  const [f5, setF5] = useState({ url: '', username: '', password: '', verify: false })

  const load = () => refStatus().then(setStatus).catch(() => setStatus(null))
  useEffect(() => { load() }, [])

  const flash = (kind, text) => { setBanner({ kind, text }); setTimeout(() => setBanner(null), 6000) }

  async function doImport() {
    const signatures = sigFile.current?.files?.[0] || null
    const signatureSets = setFile.current?.files?.[0] || null
    if (!signatures && !signatureSets) { flash('error', 'Choose a signatures and/or signature-sets file first.'); return }
    setBusy('import')
    try {
      const st = await importReference({ signatures, signatureSets })
      setStatus(st)
      if (sigFile.current) sigFile.current.value = ''
      if (setFile.current) setFile.current.value = ''
      flash('ok', `Imported — ${st.signatures} signatures, ${st.signature_sets} sets.`)
    } catch (e) {
      flash('error', e.response?.data?.detail || 'Import failed.')
    } finally { setBusy(null) }
  }

  async function doPull() {
    if (!f5.url || !f5.username || !f5.password) { flash('error', 'URL, username and password are required.'); return }
    setBusy('pull')
    try {
      const st = await pullReference(f5)
      setStatus(st)
      setF5(s => ({ ...s, password: '' }))
      flash('ok', `Pulled from F5 — ${st.signatures} signatures, ${st.signature_sets} sets.`)
    } catch (e) {
      flash('error', e.response?.data?.detail || 'F5 pull failed.')
    } finally { setBusy(null) }
  }

  const meta = status?.meta || {}

  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Attack Signatures" sub="Reference data for OWASP compliance scoring — import files or pull from an F5." />

      {banner && (
        <div className={`mb-4 rounded-md border px-4 py-2 text-sm ${
          banner.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {banner.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Import */}
        <Card>
          <SectionHeader title="Import from file" sub="Upload an F5 export or a prepared JSON/NDJSON (.gz accepted)." />
          <div className="p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Signatures file</span>
              <input ref={sigFile} type="file" accept=".json,.ndjson,.gz"
                className="mt-1 block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:text-gray-700 hover:file:bg-gray-50" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Signature sets file</span>
              <input ref={setFile} type="file" accept=".json,.gz"
                className="mt-1 block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:text-gray-700 hover:file:bg-gray-50" />
            </label>
            <p className="text-[11px] text-gray-400 leading-snug">
              Either or both. Each file <span className="font-medium">replaces</span> that dataset. Accepts raw F5
              iControl output (<code>items[]</code> with <code>attackType</code>) or our seed shape.
            </p>
            <Btn variant="primary" onClick={doImport} disabled={busy !== null}>
              {busy === 'import' ? 'Importing…' : 'Import files'}
            </Btn>
          </div>
        </Card>

        {/* F5 pull */}
        <Card>
          <SectionHeader title="Pull from F5 BIG-IP" sub="Fetch signatures + sets over iControl REST." />
          <div className="p-4 space-y-3">
            <Input label="F5 management URL" placeholder="https://10.0.0.1" value={f5.url}
              onChange={e => setF5(s => ({ ...s, url: e.target.value }))} />
            <Input label="Username" value={f5.username} placeholder="admin"
              onChange={e => setF5(s => ({ ...s, username: e.target.value }))} />
            <Input label="Password" type="password" value={f5.password}
              onChange={e => setF5(s => ({ ...s, password: e.target.value }))} />
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <Toggle on={f5.verify} onClick={() => setF5(s => ({ ...s, verify: !s.verify }))} />
              Verify TLS certificate
            </label>
            <p className="text-[11px] text-gray-400 leading-snug">
              Pulls the full catalog (9,000+ signatures) — this can take a minute. Admins only. Credentials are used
              once for the pull and not stored.
            </p>
            <Btn variant="primary" onClick={doPull} disabled={busy !== null}>
              {busy === 'pull' ? 'Pulling…' : 'Pull from F5'}
            </Btn>
          </div>
        </Card>
      </div>

      {/* Current data */}
      <Card className="mt-4">
        <SectionHeader title="Current reference data" />
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div><div className="text-2xl font-bold tabular-nums text-gray-900">{status?.signatures ?? '—'}</div><div className="text-xs text-gray-500">signatures</div></div>
            <div><div className="text-2xl font-bold tabular-nums text-gray-900">{status?.signature_sets ?? '—'}</div><div className="text-xs text-gray-500">signature sets</div></div>
            <div className="text-xs text-gray-500">
              {meta.updated_at
                ? <>Last refreshed <span className="font-medium text-gray-700">{new Date(meta.updated_at).toLocaleString()}</span>{meta.source ? ` · ${meta.source}` : ''}{meta.by ? ` · by ${meta.by}` : ''}</>
                : 'Using the bundled seed data (never refreshed).'}
            </div>
          </div>
          {status?.attack_types?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-1.5">Signatures by attack type</div>
              <div className="flex flex-wrap gap-1.5">
                {status.attack_types.map(a => (
                  <span key={a.attackType} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                    {a.attackType}<Badge color="gray">{a.count}</Badge>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <RefSignaturesTable attackTypes={status?.attack_types || []} />
    </div>
  )
}

// The signatures table (same layout as the policy editor) over the full pulled
// reference catalog — searchable, filterable, paged server-side.
function RefSignaturesTable({ attackTypes = [] }) {
  const PAGE = 50
  const [q, setQ] = useState('')
  const [risk, setRisk] = useState('')
  const [acc, setAcc] = useState('')
  const [cve, setCve] = useState('')
  const [at, setAt] = useState('')
  const [setName, setSetName] = useState('')
  const [sets, setSets] = useState([])
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState({ total: 0, signatures: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refSignatureSets().then(d => setSets(d || [])).catch(() => setSets([]))
  }, [])

  useEffect(() => { setOffset(0) }, [q, risk, acc, cve, at, setName])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      refSignatures({ q, risk, accuracy: acc, cve, attack_type: at, set: setName, limit: PAGE, offset })
        .then(d => { if (alive) setData(d || { total: 0, signatures: [] }) })
        .catch(() => { if (alive) setData({ total: 0, signatures: [] }) })
        .finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, risk, acc, cve, at, setName, offset])

  const total = data.total || 0
  const rows = data.signatures || []
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)
  const sel = 'text-xs border border-gray-200 rounded px-2 py-1 bg-white'

  return (
    <Card className="mt-4">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-semibold text-gray-900">
          Reference signatures <span className="text-gray-400 font-normal">({total.toLocaleString()})</span>
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name…"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-44" />
          <select value={setName} onChange={e => setSetName(e.target.value)} className={`${sel} max-w-[240px]`}>
            <option value="">Signature set: all</option>
            {sets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <select value={at} onChange={e => setAt(e.target.value)} className={`${sel} max-w-[220px]`}>
            <option value="">Attack type: all</option>
            {attackTypes.map(a => <option key={a.attackType} value={a.attackType}>{a.attackType} ({a.count})</option>)}
          </select>
          <select value={risk} onChange={e => setRisk(e.target.value)} className={sel}>
            <option value="">Risk: all</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <select value={acc} onChange={e => setAcc(e.target.value)} className={sel}>
            <option value="">Accuracy: all</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <select value={cve} onChange={e => setCve(e.target.value)} className={sel}>
            <option value="">CVE: all</option><option value="yes">Has CVE</option><option value="no">No CVE</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-2 font-medium w-24">ID</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Attack Type</th>
              <th className="px-3 py-2 font-medium w-20">Accuracy</th>
              <th className="px-3 py-2 font-medium w-16">Risk</th>
              <th className="px-3 py-2 font-medium w-16">CVE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2 font-mono text-gray-600">{s.id}</td>
                <td className="px-3 py-2 text-gray-900">{s.name}</td>
                <td className="px-3 py-2 text-gray-600">{s.attackType || '—'}</td>
                <td className={`px-3 py-2 font-medium ${ACC_COLOR(s.accuracy)}`}>{s.accuracy || '—'}</td>
                <td className={`px-3 py-2 font-medium ${RISK_COLOR(s.risk)}`}>{s.risk || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{s.hasCve ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">{loading ? 'Loading…' : 'No signatures match.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>{total ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : '—'}</span>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="secondary" disabled={offset === 0 || loading} onClick={() => setOffset(o => Math.max(0, o - PAGE))}>Prev</Btn>
          <Btn size="sm" variant="secondary" disabled={offset + PAGE >= total || loading} onClick={() => setOffset(o => o + PAGE)}>Next</Btn>
        </div>
      </div>
    </Card>
  )
}
