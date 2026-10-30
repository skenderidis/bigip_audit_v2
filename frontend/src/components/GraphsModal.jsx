import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { uploadLtmGraphs, deleteLtmGraph, ltmGraphBlobUrl } from '../api/ltm'

// The six Resources-Utilization graph slots (key → label), in report order.
const SLOTS = [
  ['throughput', 'Throughput'],
  ['http_requests', 'HTTP Requests'],
  ['memory', 'Memory Usage'],
  ['ssl', 'SSL Transactions'],
  ['cpu', 'CPU Utilization'],
  ['active_connections', 'Active Connections'],
]

function Thumb({ id, slot, version, big }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let dead = false, created = null
    ltmGraphBlobUrl(id, slot).then((u) => { if (dead) { URL.revokeObjectURL(u) } else { created = u; setUrl(u) } }).catch(() => {})
    return () => { dead = true; if (created) URL.revokeObjectURL(created) }
  }, [id, slot, version])
  if (!url) return <div className={`${big ? 'h-40' : 'h-12'} bg-gray-50 rounded animate-pulse`} />
  return <img src={url} alt="" className={`w-full ${big ? '' : 'h-12'} object-contain rounded bg-white border border-gray-100`} />
}

export function GraphsPanel({ audit, onChanged, big, readOnly }) {
  const [present, setPresent] = useState(new Set(audit.graph_keys || []))
  const [version, setVersion] = useState(0)   // bump to re-fetch thumbnails
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  const upload = useCallback(async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setBusy(true)
    try {
      const r = await uploadLtmGraphs(audit.id, files)
      setPresent(new Set(r.graph_keys))
      setVersion((v) => v + 1)
      if (r.stored.length) toast.success(`Uploaded ${r.stored.length} graph(s)`)
      if (r.unrecognized.length) toast.error(`Not recognized: ${r.unrecognized.join(', ')}`)
      if (r.rejected?.length) toast.error(`Rejected: ${r.rejected.join(', ')}`)
      onChanged?.()
    } catch (e) {
      const d = e.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }, [audit.id, onChanged])

  async function remove(key) {
    try {
      const r = await deleteLtmGraph(audit.id, key)
      setPresent(new Set(r.graph_keys))
      onChanged?.()
    } catch { toast.error('Remove failed') }
  }

  const onDrop = (e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) }

  return (
    <>
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            drag ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg" multiple className="hidden"
            onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
          <p className="text-sm text-gray-600">{busy ? 'Uploading…' : 'Drag & drop graph images here, or click to browse'}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            Recognized by filename (throughput, httprequests, memory, SSL, cpu/cpucores, activecons).
          </p>
        </div>
      )}

      <div className={`${readOnly ? '' : 'mt-4'} grid gap-3 ${big ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
        {SLOTS.map(([key, label]) => {
          const set = present.has(key)
          return (
            <div key={key} className="rounded-lg border border-gray-100 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-gray-800">{label}</span>
                {!readOnly && (set
                  ? <button onClick={() => remove(key)} title="Remove" className="text-gray-300 hover:text-rose-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  : <span className="text-[11px] text-gray-300">not set</span>)}
              </div>
              {set
                ? <Thumb id={audit.id} slot={key} version={version} big={big} />
                : <div className={`${big ? 'h-40' : 'h-12'} bg-gray-50 rounded flex items-center justify-center text-[11px] text-gray-300`}>—</div>}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <p className="text-[11px] text-gray-400 mt-4">
          Uploaded graphs appear in the Word report's <span className="text-gray-600">Resources Utilization</span> section.
        </p>
      )}
    </>
  )
}

export default function GraphsModal({ audit, onClose, onChanged }) {
  return (
    <Modal title={`Resource Graphs — ${audit.device_name}`} onClose={onClose} maxWidth="max-w-2xl">
      <GraphsPanel audit={audit} onChanged={onChanged} />
    </Modal>
  )
}
