import api from './client'

export const listAuditPolicies = () => api.get('/api/audit/policies').then(r => r.data)
export const getAuditPolicy  = (id) => api.get(`/api/audit/policies/${id}`).then(r => r.data)
export const deleteAuditPolicy = (id) => api.delete(`/api/audit/policies/${id}`)
export const uploadAuditPolicy = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/api/audit/policies/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const setPolicyTemplate = (id, template) =>
  api.put(`/api/audit/policies/${id}/template`, { template }).then(r => r.data)

export const analyzePolicy = (id) =>
  api.post(`/api/audit/policies/${id}/analyze`).then(r => r.data)

export const getPolicyConfig = (id) => api.get(`/api/audit/policies/${id}/config`).then(r => r.data)

export const getPolicyRisk = (id) => api.get(`/api/audit/policies/${id}/risk`).then(r => r.data)

export const getPolicyOwasp = (id) => api.get(`/api/audit/policies/${id}/owasp`).then(r => r.data)

// Accept/un-accept OWASP requirements that can't be derived from the policy
// (e.g. virtual-server TLS). Returns { owasp (compact), detail (full) }.
export const setPolicyOwaspAck = (id, acks) =>
  api.put(`/api/audit/policies/${id}/owasp/ack`, { acks }).then(r => r.data)

export const deleteFinding = (id, index) =>
  api.delete(`/api/audit/policies/${id}/findings/${index}`).then(r => r.data)

// Authenticated .docx download (Bearer auth means a plain <a href> can't attach
// the header, so fetch as a blob and trigger the save client-side).
async function downloadDocx(url) {
  const res = await api.get(url, { responseType: 'blob' })
  const cd = res.headers?.['content-disposition'] || ''
  const m = /filename="?([^"]+)"?/.exec(cd)
  const filename = m ? m[1] : 'report.docx'
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(href)
}

export const downloadPolicySummary = (id) =>
  downloadDocx(`/api/audit/policies/${id}/report/summary`)

export const downloadPolicyReport = (id) =>
  downloadDocx(`/api/audit/policies/${id}/report/full`)

export const downloadPolicyOwaspReport = (id) =>
  downloadDocx(`/api/audit/policies/${id}/report/owasp`)

export const downloadPolicyCoverageGapReport = (id) =>
  downloadDocx(`/api/audit/policies/${id}/report/coverage-gap`)
