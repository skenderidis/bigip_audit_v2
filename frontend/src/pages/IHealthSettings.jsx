import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import { getIHealthSettings, saveIHealthSettings, clearIHealthSettings } from '../api/ihealthSettings'

// F5 iHealth API credentials, used to pull QKViews for LTM / Bot / DDoS audits.
// The secret is write-only — the backend never returns it, only whether it's set.
export default function IHealthSettings() {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [secretSet, setSecretSet] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    getIHealthSettings()
      .then(d => { setClientId(d.client_id || ''); setSecretSet(!!d.client_secret_set) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const patch = { client_id: clientId }
      if (clientSecret) patch.client_secret = clientSecret   // blank = keep existing
      const d = await saveIHealthSettings(patch)
      setSecretSet(!!d.client_secret_set)
      setClientSecret('')
      toast.success('iHealth credentials saved')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!window.confirm('Remove the stored iHealth credentials?')) return
    setClearing(true)
    try {
      const d = await clearIHealthSettings()
      setClientId(d.client_id || '')
      setSecretSet(!!d.client_secret_set)
      setClientSecret('')
      toast.success('iHealth credentials cleared')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Clear failed')
    } finally {
      setClearing(false)
    }
  }

  const field = 'w-full text-sm px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300'

  return (
    <div>
      <PageHeader title="iHealth Credentials"
        sub="F5 iHealth API token used to pull QKViews for LTM, Bot and DDoS audits." />
      <Card>
        <div className="p-5 max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input className={field} value={clientId} onChange={e => setClientId(e.target.value)}
              placeholder="iHealth API client id" disabled={!loaded} autoComplete="off" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret {secretSet && <span className="text-xs text-green-600 font-normal">· set</span>}
            </label>
            <input className={field} value={clientSecret} onChange={e => setClientSecret(e.target.value)}
              type="password" placeholder={secretSet ? '•••••••• (leave blank to keep)' : 'iHealth API client secret'}
              disabled={!loaded} autoComplete="new-password" />
          </div>
          <div className="pt-1 flex items-center gap-2">
            <Btn variant="primary" size="md" onClick={save} disabled={saving || !loaded}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
            <Btn variant="secondary" size="md" onClick={clear} disabled={clearing || !loaded || (!secretSet && !clientId)}>
              {clearing ? 'Clearing…' : 'Clear'}
            </Btn>
          </div>
          <p className="text-xs text-gray-400">
            Get a token from <span className="text-gray-600">ihealth.f5.com → Settings → API Token</span>.
            Credentials are stored on the server and used only to call the iHealth API.
          </p>
        </div>
      </Card>
    </div>
  )
}
