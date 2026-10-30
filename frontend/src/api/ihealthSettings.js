// F5 iHealth API credentials (used for the LTM QKView pull). The secret is
// write-only: the GET returns only whether it is set.
import api from './client'

export const getIHealthSettings = () =>
  api.get('/api/settings/ihealth').then(r => r.data)

export const saveIHealthSettings = (patch) =>
  api.put('/api/settings/ihealth', patch).then(r => r.data)

export const clearIHealthSettings = () =>
  api.delete('/api/settings/ihealth').then(r => r.data)
