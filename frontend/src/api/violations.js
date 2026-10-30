// Violation Catalog API. Auth here is a Bearer token in localStorage, so the
// export can't be a plain <a href> (no auth header) — it's an authenticated
// blob download instead. exportViolationsUrl is kept for reference.
import api from './client'

export const listViolations = () => api.get('/api/settings/violations').then(r => r.data)

export const saveViolation = (name, patch) =>
  api.put(`/api/settings/violations/${encodeURIComponent(name)}`, patch).then(r => r.data)

export const restoreViolations = () =>
  api.post('/api/settings/violations/restore-defaults').then(r => r.data)

export const importViolations = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/api/settings/violations/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const exportViolationsUrl = () => '/api/settings/violations/export'

export async function exportViolations() {
  const res = await api.get('/api/settings/violations/export', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'violation_list.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
