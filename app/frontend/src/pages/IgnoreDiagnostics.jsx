import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import { getIgnoreDiagnostics, saveIgnoreDiagnostics } from '../api/ignoreDiagnostics'

// Editable list of iHealth diagnostic headers to suppress as known noise. One
// header per line; edits take effect when an audit is re-analyzed / re-pulled.
export default function IgnoreDiagnostics() {
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getIgnoreDiagnostics()
      .then(d => setText(d.text || ''))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const d = await saveIgnoreDiagnostics(text)
      setText(d.text || '')
      toast.success(`Saved — ${d.entries.length} ignored diagnostic(s)`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const count = text.split('\n').filter(l => l.trim()).length

  return (
    <div>
      <PageHeader title="Ignore Diagnostics"
        sub="iHealth diagnostic headers suppressed as known noise in the LTM audit — one per line." />
      <Card>
        <div className="p-5 max-w-3xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suppressed diagnostic headers <span className="text-xs text-gray-400 font-normal">· {count} entr{count === 1 ? 'y' : 'ies'}</span>
            </label>
            <textarea
              className="w-full h-96 text-[13px] font-mono px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 resize-y"
              value={text} onChange={e => setText(e.target.value)} disabled={!loaded}
              spellCheck={false}
              placeholder="One diagnostic header (h_header) per line…" />
          </div>
          <div className="pt-1">
            <Btn variant="primary" size="md" onClick={save} disabled={saving || !loaded}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
          </div>
          <p className="text-xs text-gray-400">
            Each line is matched exactly against a diagnostic's header (<span className="font-mono">h_header</span>).
            Matching entries are removed from both the CVE and Other diagnostics lists. Changes apply the next time
            an audit is analyzed (re-pull, or reprocess).
          </p>
        </div>
      </Card>
    </div>
  )
}
