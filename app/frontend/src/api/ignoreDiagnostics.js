import api from './client'

export const getIgnoreDiagnostics = () =>
  api.get('/api/settings/ignore-diagnostics').then(r => r.data)

export const saveIgnoreDiagnostics = (text) =>
  api.put('/api/settings/ignore-diagnostics', { text }).then(r => r.data)
