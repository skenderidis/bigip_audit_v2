import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadAuditPolicy, setPolicyTemplate, analyzePolicy } from '../api/auditPolicies'
import { listTemplates } from '../api/templates'

// Three-step Import wizard: Upload → Choose Template → Analyze.
// Built to handle many policies at once — files upload and analyze in parallel
// with a small concurrency cap, and every row carries its own status.

const ASM_HINT_KEYS = ['cookies', 'urls', 'parameters', 'signature-sets', 'blocking-settings']

// Sentinel option value for "no template" (config quality + OWASP only, no gap
// analysis). Stored on a row as '' so the API clears the policy's template.
const NONE = '__none__'

// Run `worker` over items with at most `cap` in flight at once.
async function runPool(items, cap, worker) {
  let i = 0
  const runners = Array.from({ length: Math.min(cap, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
}

const readJson = (file) => new Promise((resolve) => {
  const r = new FileReader()
  r.onload = () => { try { resolve(JSON.parse(r.result)) } catch { resolve(undefined) } }
  r.onerror = () => resolve(undefined)
  r.readAsText(file)
})

// Does this JSON look like an ASM policy?
function validateShape(doc) {
  if (!doc || typeof doc !== 'object') return 'Not valid JSON'
  const pol = (doc.policy && typeof doc.policy === 'object') ? doc.policy : doc
  if (doc.policy && typeof doc.policy === 'object') return null       // top-level policy object
  if (ASM_HINT_KEYS.some(k => k in pol)) return null                 // flat with a known section
  return "Doesn't look like an ASM policy (no policy / cookies / urls / parameters / signature-sets / blocking-settings)"
}

const fmtSize = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`

const STEPS = ['Upload', 'Choose Template', 'Analyze']

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < step, active = i === step
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${
              active ? 'bg-gray-900 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] ${
                active ? 'bg-white text-gray-900' : done ? 'bg-green-600 text-white' : 'bg-gray-300 text-white'}`}>
                {done ? '✓' : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-gray-200" />}
          </div>
        )
      })}
    </div>
  )
}

const Pill = ({ tone, children }) => {
  const c = {
    ready: 'bg-gray-100 text-gray-600', invalid: 'bg-rose-100 text-rose-700',
    uploading: 'bg-sky-100 text-sky-700', uploaded: 'bg-green-100 text-green-700',
    failed: 'bg-rose-100 text-rose-700', queued: 'bg-gray-100 text-gray-500',
    analyzing: 'bg-sky-100 text-sky-700', done: 'bg-green-100 text-green-700',
  }[tone] || 'bg-gray-100 text-gray-600'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c}`}>{children}</span>
}

export default function ImportWizard({ onClose }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  // Step 1 — files: {key, file, name, size, status, reason, policyId, policyName}
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  // Step 2 — rows: {id, name, template, status, reason}. `template` is a template
  // display name, or '' for None (gap analysis skipped).
  const [rows, setRows] = useState([])
  const [tplOpts, setTplOpts] = useState([])   // template display names from Settings

  // Step 3
  const [countdown, setCountdown] = useState(null)
  const cdTimer = useRef(null)

  useEffect(() => () => clearInterval(cdTimer.current), [])

  // ── close guards ──
  const attemptClose = useCallback(() => {
    if (busy) {
      if (!window.confirm('Upload/analysis is in progress. Close anyway?')) return
    }
    onClose()
  }, [busy, onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // ── Step 1: add / validate files ──
  async function addFiles(fileList) {
    const incoming = [...fileList].filter(f => /\.json$/i.test(f.name) || f.type === 'application/json')
    const have = new Set(files.map(f => f.name))
    const fresh = incoming.filter(f => !have.has(f.name))   // dedupe by filename
    if (fresh.length === 0) return
    const staged = fresh.map(f => ({ key: `${f.name}:${f.size}:${Math.random().toString(36).slice(2)}`, file: f, name: f.name, size: f.size, status: 'validating' }))
    setFiles(prev => [...prev, ...staged])
    // validate each
    for (const s of staged) {
      const doc = await readJson(s.file)
      const reason = validateShape(doc)
      setFiles(prev => prev.map(x => x.key === s.key ? { ...x, status: reason ? 'invalid' : 'ready', reason: reason || undefined } : x))
    }
  }

  const removeFile = (key) => setFiles(prev => prev.filter(f => f.key !== key))

  const canUpload = files.some(f => f.status === 'ready' || f.status === 'failed')
  const allResolved = files.length > 0 && files.every(f => ['uploaded', 'invalid'].includes(f.status))

  async function doUpload() {
    const toUpload = files.filter(f => f.status === 'ready' || f.status === 'failed')
    if (toUpload.length === 0) return
    setBusy(true)
    setFiles(prev => prev.map(f => toUpload.find(t => t.key === f.key) ? { ...f, status: 'uploading', reason: undefined } : f))
    await runPool(toUpload, 4, async (f) => {
      try {
        const res = await uploadAuditPolicy(f.file)
        setFiles(prev => prev.map(x => x.key === f.key
          ? { ...x, status: 'uploaded', policyId: res.id, policyName: res.name } : x))
      } catch (err) {
        setFiles(prev => prev.map(x => x.key === f.key
          ? { ...x, status: 'failed', reason: err.response?.data?.detail || 'Upload failed' } : x))
      }
    })
    setBusy(false)
  }

  // advance to step 2 when everything is uploaded or invalid (nothing pending)
  async function goTemplates() {
    const uploaded = files.filter(f => f.status === 'uploaded')
    let opts = []
    try {
      const t = await listTemplates()
      opts = Object.values(t || {}).map(v => v?.name).filter(Boolean)
    } catch { /* no templates available */ }
    setTplOpts(opts)
    // Default to None (config quality + OWASP only); the user opts into a
    // template for the coverage-gap check.
    setRows(uploaded.map(f => ({ id: f.policyId, name: f.policyName, template: '', status: 'queued' })))
    setStep(1)
  }

  const setRowTemplate = (id, template) => setRows(prev => prev.map(r => r.id === id ? { ...r, template } : r))
  const applyToAll = (template) => setRows(prev => prev.map(r => ({ ...r, template })))

  // ── Step 2 → analyze all ──
  async function startAnalysis() {
    setBusy(true)
    setStep(2)
    setRows(prev => prev.map(r => ({ ...r, status: 'queued' })))
    await runPool(rows, 4, async (r) => {
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: 'analyzing' } : x))
      try {
        await setPolicyTemplate(r.id, r.template)
        await analyzePolicy(r.id)
        setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: 'done' } : x))
      } catch (err) {
        setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: 'failed', reason: err.response?.data?.detail || 'Analyze failed' } : x))
      }
    })
    setBusy(false)
  }

  // when analysis finishes with no failures, auto-redirect with a countdown
  const analysisDone = step === 2 && !busy && rows.length > 0 && rows.every(r => ['done', 'failed'].includes(r.status))
  const failed = rows.filter(r => r.status === 'failed')
  useEffect(() => {
    if (analysisDone && failed.length === 0) {
      setCountdown(2)
      cdTimer.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(cdTimer.current); navigate('/waf'); onClose(); return 0 }
          return c - 1
        })
      }, 1000)
      return () => clearInterval(cdTimer.current)
    }
  }, [analysisDone])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── render ──
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onMouseDown={() => { if (!busy) attemptClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}>
        {/* header + stepper */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Import policies</h3>
          <Stepper step={step} />
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {/* STEP 1 — UPLOAD */}
          {step === 0 && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                <div className="text-sm font-medium text-gray-700">Drop policy JSON files here, or click to browse</div>
                <div className="text-xs text-gray-400 mt-1">.json — add more in multiple drops; duplicates are skipped</div>
                <input ref={inputRef} type="file" accept="application/json,.json" multiple hidden
                  onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {files.map(f => (
                    <div key={f.key} className="flex items-center gap-3 text-sm border border-gray-100 rounded px-3 py-2">
                      <span className="font-mono text-xs text-gray-700 truncate flex-1" title={f.name}>{f.name}</span>
                      <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>
                      <Pill tone={f.status}>{f.status === 'uploaded' ? (f.policyName || 'uploaded') : f.status}</Pill>
                      {f.reason && <span className="text-[11px] text-rose-600 max-w-[220px] truncate" title={f.reason}>{f.reason}</span>}
                      {!busy && f.status !== 'uploaded' && (
                        <button onClick={() => removeFile(f.key)} className="text-gray-300 hover:text-rose-600" title="Remove">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — CHOOSE TEMPLATE */}
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">{rows.length} polic{rows.length === 1 ? 'y' : 'ies'} to analyze</span>
                <label className="text-xs text-gray-500 flex items-center gap-2">
                  Apply to all:
                  <select value="__pick__"
                    onChange={e => { if (e.target.value !== '__pick__') applyToAll(e.target.value === NONE ? '' : e.target.value) }}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                    <option value="__pick__">—</option>
                    <option value={NONE}>None (config & OWASP only)</option>
                    {tplOpts.map(nm => <option key={nm} value={nm}>{nm}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-xs text-gray-400 mb-2">
                Config quality and OWASP are always analyzed. The template drives the coverage-gap check —
                choose <span className="font-medium text-gray-500">None</span> to skip it.
              </p>
              <div className="border border-gray-100 rounded divide-y divide-gray-50">
                {rows.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800 truncate">{r.name}</span>
                    <select value={r.template || NONE}
                      onChange={e => setRowTemplate(r.id, e.target.value === NONE ? '' : e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                      <option value={NONE}>None (config & OWASP only)</option>
                      {tplOpts.map(nm => <option key={nm} value={nm}>{nm}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 — ANALYZE / DONE */}
          {step === 2 && (
            <div>
              {!analysisDone ? (
                <div className="border border-gray-100 rounded divide-y divide-gray-50">
                  {rows.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-gray-800 truncate">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <Pill tone={r.status}>{r.status}</Pill>
                        {r.reason && <span className="text-[11px] text-rose-600">{r.reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">Analysis complete</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {rows.length - failed.length} of {rows.length} analyzed{failed.length > 0 && `, ${failed.length} failed`}
                  </div>
                  {failed.length > 0 && (
                    <div className="mt-3 text-xs text-rose-600">Failed: {failed.map(r => r.name).join(', ')}</div>
                  )}
                  {failed.length === 0 && countdown != null && (
                    <div className="text-xs text-gray-400 mt-2">Redirecting to the WAF page in {countdown}s…</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <button onClick={attemptClose} className="text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step === 0 && !allResolved && (
              <button onClick={doUpload} disabled={!canUpload || busy}
                className={`text-sm px-3 py-1.5 rounded-md font-medium ${(!canUpload || busy) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
                {busy ? 'Uploading…' : 'Upload'}
              </button>
            )}
            {step === 0 && allResolved && (
              <button onClick={goTemplates} disabled={files.every(f => f.status !== 'uploaded')}
                className={`text-sm px-3 py-1.5 rounded-md font-medium ${files.every(f => f.status !== 'uploaded') ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
                Next
              </button>
            )}
            {step === 1 && (
              <button onClick={startAnalysis} disabled={rows.length === 0}
                className="text-sm px-3 py-1.5 rounded-md font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400">
                Start analysis
              </button>
            )}
            {step === 2 && analysisDone && (
              <button onClick={() => { navigate('/waf'); onClose() }}
                className="text-sm px-3 py-1.5 rounded-md font-medium bg-gray-900 text-white hover:bg-gray-700">
                {failed.length > 0 ? 'Finish' : 'Go to policies now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
