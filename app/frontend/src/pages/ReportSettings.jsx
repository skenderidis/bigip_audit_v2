import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import { getReportSettings, saveReportSettings } from '../api/reportSettings'

// Report cover-page details. These values are stamped on every generated
// report (Summary, Full ASM Config Review, OWASP) — current and future.
export default function ReportSettings() {
  const [form, setForm] = useState({ customer_name: '', location: '' })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getReportSettings()
      .then(d => setForm({ customer_name: d.customer_name || '', location: d.location || '' }))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    try {
      const saved = await saveReportSettings(form)
      setForm({ customer_name: saved.customer_name || '', location: saved.location || '' })
      toast.success('Report details saved')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full text-sm px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300'

  return (
    <div>
      <PageHeader title="Report Details"
        sub="Stamped on the cover of every generated report (Summary, Full ASM Config Review, OWASP)." />
      <Card>
        <div className="p-5 max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer name</label>
            <input className={field} value={form.customer_name} onChange={set('customer_name')}
              placeholder="e.g. Acme Corporation" disabled={!loaded} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input className={field} value={form.location} onChange={set('location')}
              placeholder="e.g. London, UK" disabled={!loaded} />
          </div>
          <div className="pt-1">
            <Btn variant="primary" size="md" onClick={save} disabled={saving || !loaded}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
          </div>
          <p className="text-xs text-gray-400">
            These values apply to all reports generated from now on. Leave a field blank to keep the template placeholder.
          </p>
        </div>
      </Card>
    </div>
  )
}
