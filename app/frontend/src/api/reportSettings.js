// Report cover-page settings (customer name + location), stamped on every
// generated report. Files-on-disk storage via /api/settings/report.
import api from './client'

export const getReportSettings = () =>
  api.get('/api/settings/report').then(r => r.data)

export const saveReportSettings = (patch) =>
  api.put('/api/settings/report', patch).then(r => r.data)
