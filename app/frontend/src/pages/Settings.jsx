import { useState, useEffect, useMemo, useRef } from 'react'
import {
  listViolations, saveViolation, restoreViolations,
} from '../api/violations'

// Violation Catalog editor. Files-on-disk storage via /api/settings/violations.
// (Built as .jsx with inline icons to match this project's stack — the rest of
// the app is JS/JSX, not TS, and doesn't use lucide-react.)

const SEVERITIES = ['info', 'warning', 'error']

// ── inline icons ──
const IconRestore  = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>

const btn = 'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700'

export default function Settings() {
  const [catalog, setCatalog] = useState(null)   // name -> entry
  const [edits, setEdits] = useState({})          // name -> partial overlay
  const [dirty, setDirty] = useState(new Set())
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('all')
  const [banner, setBanner] = useState(null)
  const bannerTimer = useRef(null)

  useEffect(() => { listViolations().then(setCatalog).catch(() => setCatalog({})) }, [])
  useEffect(() => () => clearTimeout(bannerTimer.current), [])

  function flash(msg) {
    setBanner(msg)
    clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 1500)
  }

  // Current value of a field = overlay edit if present, else the stored value.
  const val = (name, field) => (edits[name] && field in edits[name]) ? edits[name][field] : catalog[name][field]
  const setField = (name, field, value) => {
    setEdits(e => ({ ...e, [name]: { ...e[name], [field]: value } }))
    setDirty(d => new Set(d).add(name))
  }

  async function save(name) {
    const patch = edits[name] || {}
    const normalized = { ...patch }
    if ('score' in normalized) normalized.score = parseFloat(normalized.score) || 0
    try {
      const updated = await saveViolation(name, normalized)
      setCatalog(c => ({ ...c, [name]: updated }))
      setEdits(e => { const n = { ...e }; delete n[name]; return n })
      setDirty(d => { const n = new Set(d); n.delete(name); return n })
      flash(`Saved ${name}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Save failed')
    }
  }

  async function doRestore() {
    if (!window.confirm('Restore the catalog to the shipped defaults? Your changes will be lost.')) return
    try {
      const fresh = await restoreViolations()
      setCatalog(fresh); setEdits({}); setDirty(new Set())
      flash('Defaults restored')
    } catch (err) {
      alert(err.response?.data?.detail || 'Restore failed')
    }
  }

  const sections = useMemo(() => {
    if (!catalog) return []
    return [...new Set(Object.values(catalog).map(e => e.section).filter(Boolean))].sort()
  }, [catalog])

  const rows = useMemo(() => {
    if (!catalog) return []
    const q = search.trim().toLowerCase()
    return Object.keys(catalog)
      .filter(name => {
        if (section !== 'all' && (val(name, 'section') || '') !== section) return false
        if (!q) return true
        return name.toLowerCase().includes(q) || String(val(name, 'txt') || '').toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const sa = (val(a, 'section') || '').toLowerCase(), sb = (val(b, 'section') || '').toLowerCase()
        if (sa !== sb) return sa < sb ? -1 : 1
        return a < b ? -1 : 1
      })
  }, [catalog, edits, search, section])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-[1600px]">
      {/* header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Violation Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Per-check severity, score, section and recommendation text used by the analyzer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={doRestore}>
            <IconRestore className="w-4 h-4" /> Restore defaults
          </button>
        </div>
      </div>

      {/* transient banner */}
      {banner && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {banner}
        </div>
      )}

      {/* filter card */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 mb-4 flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or recommendation…"
          className="text-sm border border-gray-200 rounded px-3 py-1.5 w-72" />
        <select value={section} onChange={e => setSection(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
          <option value="all">All sections</option>
          {sections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{rows.length} {rows.length === 1 ? 'check' : 'checks'}</span>
      </div>

      {/* table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {catalog === null ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No matches.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 font-medium w-56">Name</th>
                <th className="px-3 py-2 font-medium w-44">Section</th>
                <th className="px-3 py-2 font-medium w-36">Severity</th>
                <th className="px-3 py-2 font-medium w-20 text-right">Score</th>
                <th className="px-3 py-2 font-medium">Recommendation</th>
                <th className="px-3 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(name => {
                const sev = val(name, 'severity')
                const isDirty = dirty.has(name)
                return (
                  <tr key={name} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="px-3 py-2"><span className="font-mono text-xs text-gray-700">{name}</span></td>
                    <td className="px-3 py-2">
                      <input value={val(name, 'section') || ''} onChange={e => setField(name, 'section', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={sev} onChange={e => setField(name, 'severity', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                        {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.1" value={val(name, 'score')}
                        onChange={e => setField(name, 'score', e.target.value)}
                        className="w-16 text-xs border border-gray-200 rounded px-2 py-1 text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <textarea rows={2} value={val(name, 'txt') || ''} onChange={e => setField(name, 'txt', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-y" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => save(name)} disabled={!isDirty}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium ${
                          isDirty ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                        Save
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
