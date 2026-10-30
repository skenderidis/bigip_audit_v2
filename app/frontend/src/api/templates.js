// Audit Templates API. Export is an authenticated blob download (Bearer-token
// auth means a plain <a href> can't attach the header).
import api from './client'

export const listTemplates = () => api.get('/api/templates').then(r => r.data)

export const saveTemplate = (level, data) =>
  api.put(`/api/templates/${level}`, data).then(r => r.data)

export const createTemplate = (name, checks) =>
  api.post('/api/templates', { name, checks }).then(r => r.data)

export const deleteTemplate = (key) =>
  api.delete(`/api/templates/${key}`).then(r => r.data)

export const importTemplates = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/api/templates/import/all', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const exportTemplatesUrl = () => '/api/templates/export/all'

export async function exportTemplates() {
  const res = await api.get('/api/templates/export/all', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url; a.download = 'templates.json'
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
