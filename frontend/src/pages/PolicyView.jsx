import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Badge, Btn, Card, PageHeader } from '../components/ui'
import { getAuditPolicy } from '../api/auditPolicies'
import SignaturesSection from './SignaturesSection'
import ThreatCampaignsSection from './ThreatCampaignsSection'
import CharacterSetsSection from './CharacterSetsSection'

// Synthetic sections that fold several policy keys into one dedicated
// read-only view (matching the editor's tabs), each with its own component.
const FOLDED = [
  { id: '__signatures__',  label: 'Attack Signatures', keys: ['signature-sets', 'signature-settings', 'signatures'], Comp: SignaturesSection },
  { id: '__threat__',      label: 'Threat Campaigns',  keys: ['threat-campaigns', 'threat-campaign-settings'],        Comp: ThreatCampaignsSection },
  { id: '__charsets__',    label: 'Character Sets',    keys: ['character-sets'],                                      Comp: CharacterSetsSection },
]
const FOLDED_KEYS = new Set(FOLDED.flatMap(f => f.keys))
const FOLDED_BY_ID = Object.fromEntries(FOLDED.map(f => [f.id, f]))

// Read-only policy configuration viewer — the auditor's view of an uploaded
// policy. Section nav on the left (like the WAF Manager editor), formatted
// read-only content on the right, plus a Raw JSON section.

// Friendly labels + preferred order for the sections we know about. Anything
// else in the policy still shows up (appended, generic-rendered).
const SECTION_LABELS = {
  general: 'General',
  'blocking-settings': 'Blocking Settings',
  'signature-sets': 'Signature Sets',
  'signature-settings': 'Signature Settings',
  'server-technologies': 'Server Technologies',
  parameters: 'Parameters',
  urls: 'URLs',
  headers: 'Headers',
  cookies: 'Cookies',
  filetypes: 'File Types',
  'data-guard': 'Data Guard',
  'policy-builder': 'Policy Builder',
  'threat-campaign-settings': 'Threat Campaigns',
  'header-settings': 'Header Settings',
  'cookie-settings': 'Cookie Settings',
  methods: 'Methods',
  'json-profiles': 'JSON Profiles',
  'xml-profiles': 'XML Profiles',
  'graphql-profiles': 'GraphQL Profiles',
  'csrf-protection': 'CSRF Protection',
  'brute-force-attack-preventions': 'Brute Force',
  'ip-intelligence': 'IP Intelligence',
}
const ORDER = Object.keys(SECTION_LABELS)

// Scalar meta fields that belong in the header, not as their own sections.
const META_KEYS = new Set([
  'name', 'description', 'enforcementMode', 'template', 'applicationLanguage',
  'caseInsensitive', 'protocolIndependent', 'fullPath', 'type', 'softwareVersion',
])

const isPrimitive = (v) => v === null || typeof v !== 'object'

function Primitive({ v }) {
  if (typeof v === 'boolean') return <span className={v ? 'text-green-700' : 'text-gray-400'}>{String(v)}</span>
  if (v === null || v === '') return <span className="text-gray-300">—</span>
  return <span className="text-gray-800 break-words">{String(v)}</span>
}

// Render an array of objects as a table (columns = union of keys, scalars only).
function ObjectTable({ rows }) {
  const cols = useMemo(() => {
    const seen = []
    for (const r of rows) for (const k of Object.keys(r || {})) if (!seen.includes(k)) seen.push(k)
    return seen
  }, [rows])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-200">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-500">
            {cols.map(c => <th key={c} className="px-2.5 py-1.5 font-medium border-b border-gray-200 whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 align-top">
              {cols.map(c => (
                <td key={c} className="px-2.5 py-1.5 font-mono">
                  {isPrimitive(r?.[c]) ? <Primitive v={r?.[c]} /> : <JsonBlock v={r?.[c]} compact />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KeyValue({ obj }) {
  const keys = Object.keys(obj)
  return (
    <table className="text-xs border border-gray-200">
      <tbody>
        {keys.map(k => (
          <tr key={k} className="border-b border-gray-100 last:border-0 align-top">
            <td className="px-2.5 py-1.5 text-gray-500 font-medium whitespace-nowrap bg-gray-50/50">{k}</td>
            <td className="px-2.5 py-1.5 font-mono">
              {isPrimitive(obj[k]) ? <Primitive v={obj[k]} /> : <SectionBody value={obj[k]} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function JsonBlock({ v, compact }) {
  return (
    <pre className={`font-mono text-[11px] text-gray-700 whitespace-pre-wrap break-words ${compact ? '' : 'bg-gray-50 rounded p-3 border border-gray-200'}`}>
      {JSON.stringify(v, null, compact ? 0 : 2)}
    </pre>
  )
}

// Pick the right rendering for a section value.
function SectionBody({ value }) {
  if (isPrimitive(value)) return <Primitive v={value} />
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-300">empty</span>
    if (value.every(isPrimitive)) return <span className="font-mono text-gray-700">{value.join(', ')}</span>
    if (value.every(x => x && typeof x === 'object' && !Array.isArray(x))) return <ObjectTable rows={value} />
    return <JsonBlock v={value} />
  }
  return <KeyValue obj={value} />
}

export default function PolicyView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [policy, setPolicy] = useState(null)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(null)
  const [raw, setRaw] = useState(false)

  useEffect(() => {
    getAuditPolicy(id)
      .then(setPolicy)
      .catch(() => setError('Policy not found'))
  }, [id])

  const pol = policy?.content?.policy || policy?.content || {}
  const sections = useMemo(() => {
    const keys = Object.keys(pol).filter(k => !META_KEYS.has(k) && !FOLDED_KEYS.has(k) && pol[k] != null)
    keys.sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    // Dedicated folded sections first, in declaration order, when present.
    const folded = FOLDED.filter(f => f.keys.some(k => pol[k] != null)).map(f => f.id)
    return [...folded, ...keys]
  }, [pol])  // eslint-disable-line react-hooks/exhaustive-deps

  // Derived, not stored: default to the first section until the user picks one.
  const activeSection = active || sections[0] || null

  if (error) return (
    <div className="text-sm text-gray-500 py-10 text-center">
      {error}<div className="mt-3"><Btn onClick={() => navigate('/policies')}>← Policies</Btn></div>
    </div>
  )
  if (!policy) return <div className="text-sm text-gray-400 py-10 text-center">Loading…</div>

  const foldedCount = (f) => { for (const k of f.keys) { const v = pol[k]; if (Array.isArray(v)) return v.length } return null }
  const count = (k) => FOLDED_BY_ID[k] ? foldedCount(FOLDED_BY_ID[k])
    : Array.isArray(pol[k]) ? pol[k].length
    : (pol[k] && typeof pol[k] === 'object' ? Object.keys(pol[k]).length : null)

  return (
    <div>
      <PageHeader title={policy.name}
        sub={policy.filename ? `Uploaded from ${policy.filename}` : 'Uploaded policy'}
        actions={<>
          <Btn onClick={() => setRaw(r => !r)}>{raw ? 'Sections' : 'Raw JSON'}</Btn>
          <Btn onClick={() => navigate('/policies')}>← Policies</Btn>
        </>} />

      {/* header meta */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {pol.enforcementMode && (
          pol.enforcementMode === 'blocking'
            ? <Badge color="red">Blocking</Badge> : <Badge color="green">Transparent</Badge>
        )}
        {pol.applicationLanguage && <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">lang: {pol.applicationLanguage}</span>}
        {pol.template?.name && <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">template: {pol.template.name}</span>}
        {pol.description && <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 max-w-md truncate" title={pol.description}>{pol.description}</span>}
      </div>

      {raw ? (
        <Card><div className="p-4"><JsonBlock v={pol} /></div></Card>
      ) : (
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* section nav */}
          <div className="col-span-3 sticky top-4">
            <Card>
              <div className="p-2 space-y-0.5">
                {sections.map(s => {
                  const n = count(s)
                  return (
                    <button key={s} onClick={() => setActive(s)}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                        activeSection === s ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <span>{FOLDED_BY_ID[s]?.label || SECTION_LABELS[s] || s}</span>
                      {n != null && <span className={activeSection === s ? 'text-gray-300' : 'text-gray-400'}>{n}</span>}
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
          {/* section content */}
          <div className="col-span-9">
            {FOLDED_BY_ID[activeSection] ? (
              // Dedicated folded section — renders its own cards.
              (() => { const C = FOLDED_BY_ID[activeSection].Comp; return <C policy={pol} /> })()
            ) : (
              <Card>
                <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">
                  {SECTION_LABELS[activeSection] || activeSection}
                </div>
                <div className="p-4 overflow-x-auto">
                  {activeSection ? <SectionBody value={pol[activeSection]} /> : <span className="text-gray-400 text-sm">Select a section.</span>}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
