// Shim so the ported WAF Manager PolicyEditor runs in the standalone audit app.
// Policies come from the uploaded-policy store; device_id is a sentinel so the
// editor's device fetches hit the reference shim (/api/devices/ref/...).
// Editing is not persisted here — save rejects with a clear message.
import api from './client'
import { getAuditPolicy, listAuditPolicies } from './auditPolicies'

export const getPolicy = (id) =>
  getAuditPolicy(id).then(p => ({
    ...p,
    device_id: 'ref',          // → reference-backed device shim
    can_amend: false,
    deployed_version_num: null,
  }))

export const listPolicies = () =>
  listAuditPolicies().then(list =>
    (list || []).map(p => ({ id: p.id, name: p.name, device_kind: 'bigip', external: true })))

export const listVersions = () => Promise.resolve([])

const readOnly = () =>
  Promise.reject(new Error('Editing is read-only in Audit for BIGIP — upload a new JSON to change a policy.'))
export const savePolicy = readOnly
export const saveGroupPolicy = readOnly
export const getGroupPolicy = (templateId) => getPolicy(templateId)

export default api
