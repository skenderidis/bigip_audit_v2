import api from './client'

// Bundled WAF reference data (signatures, signature sets, threat campaigns,
// character-set defaults) — serves the device-less enrichment in the viewer.
export const refSignatureSets = () => api.get('/api/audit/ref/signature-sets').then(r => r.data)
export const refThreatCampaigns = () => api.get('/api/audit/ref/threat-campaigns').then(r => r.data)
export const refCharacterSets = () => api.get('/api/audit/ref/character-sets').then(r => r.data)
export const refSignatures = (params = {}) => {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') qs.set(k, v)
  return api.get(`/api/audit/ref/signatures?${qs}`).then(r => r.data)
}

// ── Admin: refresh the reference data (file import or F5 pull) ──
export const refStatus = () => api.get('/api/audit/ref/status').then(r => r.data)

export const importReference = ({ signatures, signatureSets }) => {
  const fd = new FormData()
  if (signatures) fd.append('signatures', signatures)
  if (signatureSets) fd.append('signature_sets', signatureSets)
  return api.post('/api/audit/ref/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const pullReference = (body) =>
  api.post('/api/audit/ref/pull', body).then(r => r.data)
