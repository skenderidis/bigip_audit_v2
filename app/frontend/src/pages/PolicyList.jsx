import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Badge, Btn, Card, PageHeader } from '../components/ui'
import { listAuditPolicies, deleteAuditPolicy } from '../api/auditPolicies'

// Uploaded policies available for audit. Read-only list + delete (no deploy /
// edit — this is an audit tool, not a manager).
export default function PolicyList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)

  const load = useCallback(() => {
    listAuditPolicies().then(setRows).catch(() => setRows([]))
  }, [])
  useEffect(load, [load])

  async function remove(id, name) {
    if (!window.confirm(`Remove "${name}" from the audit set?`)) return
    try { await deleteAuditPolicy(id); toast.success('Removed'); load() }
    catch { toast.error('Delete failed') }
  }

  const fmt = (s) => s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <div>
      <PageHeader title="Policies"
        sub="WAF policies uploaded for auditing."
        actions={<Btn variant="primary" onClick={() => navigate('/upload')}>Upload policy</Btn>} />

      <Card>
        {rows === null ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-sm text-gray-500 mb-3">No policies yet.</div>
            <Btn variant="primary" onClick={() => navigate('/upload')}>Upload your first policy</Btn>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Enforcement</th>
                <th className="px-4 py-2 font-medium text-right">Violations</th>
                <th className="px-4 py-2 font-medium text-right">Signature sets</th>
                <th className="px-4 py-2 font-medium">Data Guard</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const s = p.summary || {}
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">
                      <button onClick={() => navigate(`/policies/${p.id}/edit`)} className="text-blue-700 hover:underline">{p.name}</button>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.enforcementMode === 'blocking'
                        ? <Badge color="red">Blocking</Badge>
                        : s.enforcementMode === 'transparent'
                          ? <Badge color="green">Transparent</Badge>
                          : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {s.violations ?? '—'}{s.violationsBlocking != null && <span className="text-gray-400"> ({s.violationsBlocking} block)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{s.signatureSets ?? '—'}</td>
                    <td className="px-4 py-2.5">{s.dataGuard ? <Badge color="green">On</Badge> : <span className="text-gray-400">off</span>}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{fmt(p.uploaded_at)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => navigate(`/policies/${p.id}/edit`)} className="text-gray-500 hover:text-blue-700 mr-3 text-xs">View</button>
                      <button onClick={() => remove(p.id, p.name)}
                        className="text-gray-400 hover:text-red-600" title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
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
