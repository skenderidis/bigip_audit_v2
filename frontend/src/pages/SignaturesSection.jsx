import { useState, useEffect, useMemo } from 'react'
import { Card } from '../components/ui'
import { refSignatureSets, refSignatures } from '../api/reference'

// Read-only Attack Signatures view, matching the WAF Manager editor's layout:
//   1. Signature settings  2. Signature sets  3. Per-signature overrides
// Device-less — enrichment comes from the bundled reference data.

const riskColor = (r) => {
  const v = (r || '').toLowerCase()
  if (v === 'high') return 'text-red-600'
  if (v === 'medium') return 'text-yellow-600'
  if (v === 'low') return 'text-green-600'
  return 'text-gray-400'
}
const accuracyColor = (a) => {
  const v = (a || '').toLowerCase()
  if (v === 'high') return 'text-green-600'
  if (v === 'medium') return 'text-yellow-600'
  if (v === 'low') return 'text-red-600'
  return 'text-gray-400'
}

const Check = ({ on }) => on
  ? <svg className="w-4 h-4 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  : <span className="text-gray-300 text-xs block text-center">—</span>

function SettingRow({ k, children }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-800 font-medium">{children}</span>
    </div>
  )
}

export default function SignaturesSection({ policy }) {
  const settings = policy['signature-settings'] || {}
  const polSets = policy['signature-sets'] || []
  const overrides = policy['signatures'] || []

  const [refSets, setRefSets] = useState({})      // name -> {type,category,signatureCount}
  const [sigMeta, setSigMeta] = useState({})      // id -> metadata
  const [sigSearch, setSigSearch] = useState('')
  const [riskF, setRiskF] = useState('all')
  const [accF, setAccF] = useState('all')
  const [cveF, setCveF] = useState('all')

  // Enrich the policy's sets with reference metadata (type/category/count).
  useEffect(() => {
    refSignatureSets()
      .then(list => setRefSets(Object.fromEntries((list || []).map(s => [s.name, s]))))
      .catch(() => setRefSets({}))
  }, [])

  // Enrich per-signature overrides (if any) with reference metadata.
  useEffect(() => {
    const ids = overrides.map(s => String(s.signatureId ?? s.id ?? '')).filter(Boolean)
    if (ids.length === 0) return  // initial state is already {}
    refSignatures({ ids: ids.join(','), limit: 5000 })
      .then(d => setSigMeta(Object.fromEntries((d.signatures || []).map(s => [String(s.id), s]))))
      .catch(() => setSigMeta({}))
  }, [policy])  // eslint-disable-line react-hooks/exhaustive-deps

  const sigRows = useMemo(() => overrides.map(s => {
    const id = String(s.signatureId ?? s.id ?? '')
    const m = sigMeta[id] || {}
    return {
      id, name: m.name || s.name || id,
      risk: m.risk, accuracy: m.accuracy, cve: m.cve, hasCve: m.hasCve,
      enabled: s.enabled, performStaging: s.performStaging,
      alarm: s.alarm, block: s.block, learn: s.learn,
    }
  }), [overrides, sigMeta])

  const filtered = sigRows.filter(s => {
    if (sigSearch && !s.id.includes(sigSearch) && !(s.name || '').toLowerCase().includes(sigSearch.toLowerCase())) return false
    if (riskF !== 'all' && (s.risk || '').toLowerCase() !== riskF) return false
    if (accF !== 'all' && (s.accuracy || '').toLowerCase() !== accF) return false
    if (cveF !== 'all' && Boolean(s.hasCve) !== (cveF === 'yes')) return false
    return true
  })

  const status = (s) => s.enabled === false ? 'Disabled' : s.performStaging ? 'Staging' : 'Enforced'
  const statusColor = (st) => st === 'Disabled' ? 'text-red-500' : st === 'Staging' ? 'text-yellow-600' : 'text-green-700'

  return (
    <div className="space-y-3">
      {/* 1. Signature settings */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Signature settings</div>
        <div className="px-4 py-2">
          <SettingRow k="Attack-signature false-positive mode">{settings.attackSignatureFalsePositiveMode || 'disabled'}</SettingRow>
          <SettingRow k="Minimum accuracy for auto-added signatures">{settings.minimumAccuracyForAutoAddedSignatures || 'medium'}</SettingRow>
          <SettingRow k="Signature staging">{settings.signatureStaging ? 'On' : 'Off'}</SettingRow>
          <SettingRow k="Place updated signatures in staging">{settings.placeSignaturesInStaging ? 'Yes' : 'No'}</SettingRow>
        </div>
      </Card>

      {/* 2. Signature sets */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">
          Signature sets <span className="text-gray-400 font-normal">({polSets.length})</span>
        </div>
        {polSets.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">No signature sets on this policy.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 font-medium">Signature set</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium text-right">Signatures</th>
                <th className="px-3 py-2 font-medium text-center w-16">Learn</th>
                <th className="px-3 py-2 font-medium text-center w-16">Alarm</th>
                <th className="px-3 py-2 font-medium text-center w-16">Block</th>
              </tr>
            </thead>
            <tbody>
              {polSets.map((s, i) => {
                const meta = refSets[s.name] || {}
                return (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-3 py-2 text-gray-500">{meta.category || meta.type || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{meta.signatureCount ?? '—'}</td>
                    <td className="px-3 py-2"><Check on={!!s.learn} /></td>
                    <td className="px-3 py-2"><Check on={s.alarm !== false} /></td>
                    <td className="px-3 py-2"><Check on={!!s.block} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* 3. Per-signature overrides */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            Signatures <span className="text-gray-400 font-normal">({sigRows.length} override{sigRows.length === 1 ? '' : 's'})</span>
          </span>
          {sigRows.length > 0 && (
            <div className="flex items-center gap-2">
              <input value={sigSearch} onChange={e => setSigSearch(e.target.value)} placeholder="Search id or name…"
                className="text-xs border border-gray-200 rounded px-2 py-1 w-44" />
              {[['Risk', riskF, setRiskF, [['high','High'],['medium','Medium'],['low','Low']]],
                ['Accuracy', accF, setAccF, [['high','High'],['medium','Medium'],['low','Low']]],
                ['CVE', cveF, setCveF, [['yes','Has CVE'],['no','No CVE']]]].map(([label, val, set, opts]) => (
                <select key={label} value={val} onChange={e => set(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                  <option value="all">{label}: all</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
          )}
        </div>
        {sigRows.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">
            No per-signature overrides — enforcement is defined by the signature sets above.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 font-medium w-24">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium w-24">Status</th>
                <th className="px-3 py-2 font-medium text-center w-14">Learn</th>
                <th className="px-3 py-2 font-medium text-center w-14">Alarm</th>
                <th className="px-3 py-2 font-medium text-center w-14">Block</th>
                <th className="px-3 py-2 font-medium w-20">Accuracy</th>
                <th className="px-3 py-2 font-medium w-16">Risk</th>
                <th className="px-3 py-2 font-medium w-16">CVE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const st = status(s)
                return (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-mono text-gray-600">{s.id}</td>
                    <td className="px-3 py-2 text-gray-900">{s.name}</td>
                    <td className={`px-3 py-2 font-medium ${statusColor(st)}`}>{st}</td>
                    <td className="px-3 py-2"><Check on={!!s.learn} /></td>
                    <td className="px-3 py-2"><Check on={s.alarm !== false} /></td>
                    <td className="px-3 py-2"><Check on={s.block !== false} /></td>
                    <td className={`px-3 py-2 font-medium ${accuracyColor(s.accuracy)}`}>{s.accuracy || '—'}</td>
                    <td className={`px-3 py-2 font-medium ${riskColor(s.risk)}`}>{s.risk || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{s.hasCve ? 'Yes' : 'No'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
