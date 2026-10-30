// LTM / Bot / DDoS device audits (one iHealth QKView pull → one row that all
// three sections read from).
import api from './client'

export const listLtmAudits = () => api.get('/api/ltm/audits').then(r => r.data)
export const getLtmAudit = (id) => api.get(`/api/ltm/audits/${id}`).then(r => r.data)
export const createLtmAudit = (body) => api.post('/api/ltm/audits', body).then(r => r.data)
export const deleteLtmAudit = (id) => api.delete(`/api/ltm/audits/${id}`).then(r => r.data)

// Remove (or restore) one finding / diagnostic from an audit. kind: 'finding' |
// 'diag'; key: finding name or diagnostic h_header. Returns the updated audit.
export const setLtmExclusion = (id, kind, key, excluded) =>
  api.post(`/api/ltm/audits/${id}/exclude`, { kind, key, excluded }).then(r => r.data)

// Resources-Utilization graphs. Images are matched to a slot by filename.
export const uploadLtmGraphs = (id, files) => {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  // Content-Type undefined → axios sets multipart/form-data with the boundary
  // (the client's default application/json would otherwise break the upload).
  return api.post(`/api/ltm/audits/${id}/graphs`, fd, { headers: { 'Content-Type': undefined } }).then(r => r.data)
}
export const deleteLtmGraph = (id, key) =>
  api.delete(`/api/ltm/audits/${id}/graphs/${key}`).then(r => r.data)
export const ltmGraphBlobUrl = (id, key) =>
  api.get(`/api/ltm/audits/${id}/graphs/${key}`, { responseType: 'blob' }).then(r => URL.createObjectURL(r.data))

// Download a device-audit report (fmt: 'word' | 'excel') as a file.
export async function downloadLtmReport(id, fmt) {
  const res = await api.get(`/api/ltm/audits/${id}/report/${fmt}`, { responseType: 'blob' })
  const cd = res.headers?.['content-disposition'] || ''
  const m = /filename="?([^"]+)"?/.exec(cd)
  const filename = m ? m[1] : `ltm-report.${fmt === 'excel' ? 'xlsx' : 'docx'}`
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(href)
}

// Streaming create: POSTs the same body but reads newline-delimited JSON
// progress events ({type:'progress',label,i,n}) as the server runs each
// individual iHealth call, then resolves with the final audit row. `onEvent`
// is called for every parsed event. Falls back cleanly on a non-stream error.
export async function createLtmAuditStream(body, onEvent) {
  const base = import.meta.env.VITE_API_URL || ''
  const token = localStorage.getItem('waf_token')
  const resp = await fetch(`${base}/api/ltm/audits/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    // Pre-stream validation errors come back as normal JSON (e.g. 400/401).
    let detail = `Request failed (${resp.status})`
    try { detail = (await resp.json()).detail || detail } catch { /* ignore */ }
    const err = new Error(detail)
    err.response = { status: resp.status, data: { detail } }
    throw err
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let result = null
  let streamError = null

  const handle = (line) => {
    const s = line.trim()
    if (!s) return
    let evt
    try { evt = JSON.parse(s) } catch { return }
    if (evt.type === 'done') result = evt.audit
    else if (evt.type === 'error') streamError = evt.detail
    onEvent?.(evt)
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      handle(buf.slice(0, nl))
      buf = buf.slice(nl + 1)
    }
  }
  if (buf) handle(buf)

  if (streamError) throw new Error(streamError)
  if (!result) throw new Error('Audit stream ended without a result')
  return result
}
