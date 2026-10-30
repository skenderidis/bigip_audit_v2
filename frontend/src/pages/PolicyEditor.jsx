import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { Btn, Badge, Input, Select, Toggle, Card, SectionHeader } from '../components/ui'
import toast from 'react-hot-toast'
import api from '../api/client'
import { getPolicy, savePolicy, getGroupPolicy, saveGroupPolicy, listPolicies, listVersions } from '../api/policies'
import { getDefaultCharacterSets } from '../api/settings'
import useBreadcrumbStore from '../store/useBreadcrumbStore'
import useSubTabStore from '../store/useSubTabStore'

const SERVER_TECHNOLOGIES = [
  'Apache/NCSA HTTP Server','Apache Struts','Apache Tomcat','AngularJS','ASP','ASP.NET',
  'Backbone.js','BEA Systems WebLogic Server','CGI','Cisco','CitrixCodeIgniter',
  'CouchDB','Django','Elasticsearch','Ember.js','ef.js','Express.js',
  'Front Page Server Extensions (FPSE)','Google Web Toolkit','GraphQL','Handlebars',
  'IBM DB2','IIS','Java Servlets/JSP','JavaServer Faces (JSF)','JavaScript','JBoss',
  'Jenkins','Jetty','Joomla','jQuery','Laravel','Lotus Domino','Macromedia ColdFusion',
  'Macromedia JRun','Microsoft SQL Server','Microsoft Windows','MongoDB','MooTools',
  'Mustache','MySQL','Nginx','Node.js','Novell','Oracle','Oracle Application Server',
  'Oracle Identity Manager','Outlook Web Access','PHP','PostgreSQL','Prototype',
  'Proxy Servers','Python','React','Redis','RequireJS','Ruby','SharePoint','Spring Boot',
  'SQLite','SSI (Server Side Includes)','Sybase/ASE','TYPO3 CMS','UIKit','Underscore.js',
  'Unix/Linux','Vue.js','WebDAV','WordPress','XML','Zend','ZURB Foundation',
].sort()

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','American Samoa','Andorra','Angola','Anguilla',
  'Antarctica','Antigua and Barbuda','Argentina','Armenia','Aruba','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize',
  'Benin','Bermuda','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil',
  'British Virgin Islands','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia',
  'Cameroon','Canada','Cape Verde','Cayman Islands','Central African Republic','Chad',
  'Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
  'El Salvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland',
  'France','French Guiana','Gabon','Gambia','Georgia','Germany','Ghana','Greece',
  'Greenland','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras',
  'Hong Kong','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos',
  'Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Macau','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta',
  'Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco',
  'Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua',
  'Niger','Nigeria','North Korea','Norway','Oman','Pakistan','Palestine','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Puerto Rico',
  'Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone',
  'Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea','Spain',
  'Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan',
  'Tanzania','Thailand','Togo','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
]

const APP_LANGUAGES = [
  'auto-detect','big5','euc-jp','euc-kr','gb18030','gb2312','gbk',
  'iso-8859-1','iso-8859-10','iso-8859-13','iso-8859-15','iso-8859-16',
  'iso-8859-2','iso-8859-3','iso-8859-4','iso-8859-5','iso-8859-6',
  'iso-8859-7','iso-8859-8','iso-8859-9','koi8-r','shift_jis','utf-8',
  'windows-1250','windows-1251','windows-1252','windows-1253',
  'windows-1255','windows-1256','windows-1257','windows-874',
]

const NAV_GROUPS = [
  { group: 'Policy', tabs: [
    { id: 'general',    label: 'General'    },
    { id: 'signatures', label: 'Signatures' },
  ]},
  { group: 'Request', tabs: [
    { id: 'headers',    label: 'Headers'    },
    { id: 'cookies',    label: 'Cookies'    },
    { id: 'parameters', label: 'Parameters' },
    { id: 'urls',       label: 'URLs'       },
    { id: 'methods',    label: 'Methods'    },
    { id: 'filetypes',  label: 'File Types'  },
  ]},
  { group: 'Blocking', tabs: [
    { id: 'violations',     label: 'Blocking Settings' },
    { id: 'blocking-pages', label: 'Blocking Pages' },
  ]},
  { group: 'Traffic', tabs: [
    { id: 'websocket',   label: 'WebSocket URLs'      },
    { id: 'csrf',        label: 'CSRF protection'     },
    { id: 'sessions',    label: 'Brute Force'         },
  ]},
  { group: 'Advanced', tabs: [
    { id: 'behavioral',  label: 'Behavioral'          },
    { id: 'dataguard',   label: 'Data guard'          },
    { id: 'ipintel',     label: 'IPs'                  },
    { id: 'ssrf',        label: 'SSRF'                 },
  ]},
  { group: 'Profiles', tabs: [
    { id: 'plaintext', label: 'Plain Text'       },
    { id: 'gwt',       label: 'GWT profiles'     },
    { id: 'xml',       label: 'XML profiles'     },
    { id: 'json',      label: 'JSON profiles'    },
    { id: 'graphql',   label: 'GraphQL profiles' },
    { id: 'rawjson',   label: 'Raw JSON'         },
  ]},
  { group: 'Config', tabs: [
    { id: 'charsets',  label: 'Character Sets'   },
  ]},
]
// All policy-level character-set types (schema characterSetType enum)
const CHAR_SET_TYPES = [
  { type: 'url',                label: 'URL' },
  { type: 'parameter-name',    label: 'Parameter Name' },
  { type: 'parameter-value',   label: 'Parameter Value' },
  { type: 'header',            label: 'Header' },
  { type: 'json-content',      label: 'JSON Content' },
  { type: 'xml-content',       label: 'XML Content' },
  { type: 'gwt-content',       label: 'GWT Content' },
  { type: 'plain-text-content',label: 'Plain Text Content' },
]
const URL_METACHARS = [
  { hex: '0x04', name: 'EOT',   defaultAllowed: false },
  { hex: '0x08', name: 'BS',    defaultAllowed: false },
  { hex: '0x09', name: 'TAB',   defaultAllowed: false },
  { hex: '0x0a', name: 'LF',    defaultAllowed: false },
  { hex: '0x0d', name: 'CR',    defaultAllowed: false },
  { hex: '0x1b', name: 'ESC',   defaultAllowed: false },
  { hex: '0x20', name: 'Space', defaultAllowed: true  },
  { hex: '0x21', name: '!',     defaultAllowed: true  },
  { hex: '0x22', name: '"',     defaultAllowed: true  },
  { hex: '0x23', name: '#',     defaultAllowed: true  },
  { hex: '0x24', name: '$',     defaultAllowed: true  },
  { hex: '0x25', name: '%',     defaultAllowed: true  },
  { hex: '0x26', name: '&',     defaultAllowed: true  },
  { hex: '0x27', name: "'",     defaultAllowed: false },
  { hex: '0x28', name: '(',     defaultAllowed: true  },
  { hex: '0x29', name: ')',     defaultAllowed: true  },
  { hex: '0x2a', name: '*',     defaultAllowed: true  },
  { hex: '0x2d', name: '-',     defaultAllowed: true  },
  { hex: '0x2f', name: '/',     defaultAllowed: true  },
  { hex: '0x3a', name: ':',     defaultAllowed: true  },
  { hex: '0x3b', name: ';',     defaultAllowed: true  },
  { hex: '0x3c', name: '<',     defaultAllowed: true  },
  { hex: '0x3e', name: '>',     defaultAllowed: true  },
  { hex: '0x3f', name: '?',     defaultAllowed: true  },
  { hex: '0x40', name: '@',     defaultAllowed: true  },
  { hex: '0x5b', name: '[',     defaultAllowed: true  },
  { hex: '0x5c', name: '\\',   defaultAllowed: true  },
  { hex: '0x5d', name: ']',     defaultAllowed: true  },
  { hex: '0x5e', name: '^',     defaultAllowed: true  },
  { hex: '0x60', name: '`',     defaultAllowed: false },
  { hex: '0x7b', name: '{',     defaultAllowed: true  },
  { hex: '0x7c', name: '|',     defaultAllowed: true  },
  { hex: '0x7d', name: '}',     defaultAllowed: true  },
  { hex: '0x7e', name: '~',     defaultAllowed: true  },
  { hex: '0x7f', name: 'DEL',   defaultAllowed: false },
]

const CTRL_NAMES = {0:'NULL',1:'SOH',2:'STX',3:'ETX',4:'EOT',5:'ENQ',6:'ACK',7:'BEL',8:'BS',9:'TAB',10:'LF',11:'VT',12:'FF',13:'CR',14:'SO',15:'SI',16:'DLE',17:'DC1',18:'DC2',19:'DC3',20:'DC4',21:'NAK',22:'SYN',23:'ETB',24:'CAN',25:'EM',26:'SUB',27:'ESC',28:'FS',29:'GS',30:'RS',31:'US',127:'DEL'}
const PT_ALL_CHARS = Array.from({length: 128}, (_, i) => {
  const hex = '0x' + i.toString(16)
  const name = CTRL_NAMES[i] ?? String.fromCharCode(i)
  const meta = URL_METACHARS.find(m => m.hex === hex)
  const defaultAllowed = meta ? meta.defaultAllowed : (i >= 0x30 && i <= 0x39) || (i >= 0x41 && i <= 0x5a) || (i >= 0x61 && i <= 0x7a) || i === 0x2b || i === 0x2c || i === 0x2e || i === 0x3d || i === 0x5f
  return { hex, name, isMeta: !!meta, defaultAllowed, disabled: i === 0 }
})
const PT_META_DEFAULTS = URL_METACHARS.map(m => ({ metachar: m.hex, isAllowed: m.defaultAllowed }))

const IP_INTEL_CATEGORIES = [
  ['Tor Proxies', 'Denial of Service'],
  ['Mobile Threats', 'Scanners'],
  ['Cloud-based Services', 'BotNets'],
  ['Anonymous Proxy', 'Web Attacks'],
  ['Phishing Proxies', 'Windows Exploits'],
  ['Infected Sources', 'Spam Sources'],
]

const XML_DEFENSE_PRESETS = {
  low:    { allowDTDs: true,  allowExternalRefs: true,  tolerateLeadingWS: true,  tolerateCloseTagShorthand: true,  tolerateNumericNames: true,  allowProcessingInstructions: true,  allowCDATA: true,  maxDocSize: 'any', maxElements: 'any', maxNameLength: 'any', maxAttrValueLength: 'any', maxDocDepth: 'any', maxChildrenPerElement: 'any', maxAttrsPerElement: 'any', maxNsDeclarations: 'any', maxNamespaceLength: 'any' },
  medium: { allowDTDs: true,  allowExternalRefs: false, tolerateLeadingWS: false, tolerateCloseTagShorthand: false, tolerateNumericNames: false, allowProcessingInstructions: true,  allowCDATA: true,  maxDocSize: 10240000, maxElements: 512000, maxNameLength: 1024, maxAttrValueLength: 4096, maxDocDepth: 128, maxChildrenPerElement: 4096, maxAttrsPerElement: 64, maxNsDeclarations: 256, maxNamespaceLength: 1024 },
  high:   { allowDTDs: false, allowExternalRefs: false, tolerateLeadingWS: false, tolerateCloseTagShorthand: false, tolerateNumericNames: false, allowProcessingInstructions: true,  allowCDATA: false, maxDocSize: 1024000,  maxElements: 65536,  maxNameLength: 256,  maxAttrValueLength: 1024, maxDocDepth: 32,  maxChildrenPerElement: 1024, maxAttrsPerElement: 16, maxNsDeclarations: 64,  maxNamespaceLength: 256  },
}

const PARAM_VALUE_TYPES = [
  { value: 'array',           label: 'Array value' },
  { value: 'dynamic-content', label: 'Dynamic content value' },
  { value: 'ignore',          label: 'Ignore value' },
  { value: 'json',            label: 'JSON value' },
  { value: 'static-content',  label: 'Static content value' },
  { value: 'user-input',      label: 'User-input value' },
  { value: 'auto-detect',     label: 'Auto detect' },
  { value: 'xml',             label: 'XML value' },
]
// ASM only serializes array parameters four ways. The OpenAPI styles (multi, form,
// label, matrix, multipart) describe request encoding, not an ASM parameter setting.
const ARRAY_SERIALIZATION_FORMATS = [
  { value: 'csv',  label: 'Comma-separated values (CSV)' },
  { value: 'ssv',  label: 'Space-separated values (SSV)' },
  { value: 'tsv',  label: 'Tab-separated values (TSV)' },
  { value: 'pipe', label: 'Pipe-separated values' },
]
const PARAM_DATA_TYPES = [
  { value: 'alpha-numeric', label: 'Alpha-Numeric' },
  { value: 'binary',        label: 'Binary' },
  { value: 'decimal',       label: 'Decimal' },
  { value: 'integer',       label: 'Integer' },
  { value: 'boolean',       label: 'Boolean' },
  { value: 'email',         label: 'Email' },
  { value: 'phone',         label: 'Phone' },
  { value: 'uri',           label: 'URI' },
]
const paramSubTabsFor = (vt) => {
  if (vt === 'static-content') return [['static-values','Parameter Static Values']]
  if (vt === 'json')           return [['json-profile','JSON Profile']]
  if (vt === 'xml')            return [['xml-profile','XML Profile']]
  if (vt === 'dynamic-content') return []
  if (vt === 'ignore')         return []
  return [['data-type','Data Type'],['value-meta','Value Meta Characters'],['attack-sigs','Attack Signatures']]
}

const STANDARD_METHODS = [
  'ACL','BCOPY','BDELETE','BMOVE','BPROPFIND','BPROPPATCH',
  'CHECKIN','CHECKOUT','CONNECT','COPY','DELETE','GET','HEAD',
  'LINK','LOCK','MERGE','MKCOL','MKWORKSPACE','MOVE','NOTIFY',
  'OPTIONS','PATCH','POLL','POST','PROPFIND','PROPPATCH','PUT',
  'SEARCH','SUBSCRIBE','TRACE','UNLINK','UNLOCK','UNSUBSCRIBE',
  'UPDATE','VERSION-CONTROL',
]


// ── Live diff utilities ────────────────────────────────────────
function normalize(val) {
  if (Array.isArray(val)) {
    const items = val.map(normalize)
    return items.sort((a, b) => {
      const sa = JSON.stringify(a) ?? ''; const sb = JSON.stringify(b) ?? ''
      return sa < sb ? -1 : sa > sb ? 1 : 0
    })
  }
  if (val !== null && typeof val === 'object')
    return Object.fromEntries(Object.keys(val).sort().map(k => [k, normalize(val[k])]))
  return val
}
function diffLines(aLines, bLines) {
  const m = aLines.length, n = bLines.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aLines[i-1] === bLines[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  const result = []; let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i-1] === bLines[j-1]) { result.push({ type: 'same', content: aLines[i-1] }); i--; j-- }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { result.push({ type: 'added', content: bLines[j-1] }); j-- }
    else { result.push({ type: 'removed', content: aLines[i-1] }); i-- }
  }
  return result.reverse()
}
const MAX_DIFF_LINES = 800
function computeDiff(polA, polB) {
  const allKeys = [...new Set([...Object.keys(polA), ...Object.keys(polB)])]
  const sections = []
  for (const key of allKeys) {
    const strA = JSON.stringify(normalize(polA[key]), null, 2) ?? ''
    const strB = JSON.stringify(normalize(polB[key]), null, 2) ?? ''
    if (strA === strB) continue
    const lA = strA.split('\n'), lB = strB.split('\n')
    if (lA.length > MAX_DIFF_LINES || lB.length > MAX_DIFF_LINES) {
      sections.push({ key, lines: null, changes: -1, tooLarge: true }); continue
    }
    const lines = diffLines(lA, lB)
    sections.push({ key, lines, changes: lines.filter(l => l.type !== 'same').length })
  }
  return sections
}

function ToggleRow({ label, sub, on, onClick, disabled, labelClass = 'text-xs font-medium text-gray-700' }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className={labelClass}>{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
      <Toggle on={on} onClick={disabled ? undefined : onClick} />
    </div>
  )
}

function SegBtn({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs flex-shrink-0">
      {options.map(([label, val]) => (
        <button key={val}
          className={`px-4 py-1 transition-colors whitespace-nowrap ${value === val ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          onClick={() => onChange(val)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function AdvRow({ label, children }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-700 pr-6">{label}</span>
      {children}
    </div>
  )
}

function Tags({ values = [] }) {
  if (!values.length) return <span className="text-xs text-gray-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v, i) => (
        <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{v}</span>
      ))}
    </div>
  )
}

// Reusable table for the content-profile tabs (Plain Text / GWT / JSON / XML / GraphQL).
// Full treatment: search, sortable columns, DeviceFleet pagination, multi-select delete.
// Protected (non-deletable) profiles: the Default profile and any profile in use (attached
// to a URL/WebSocket) — these get no checkbox and are skipped by bulk/Delete-All.
function ProfileTable({ title, profiles, cpType, urls, collapsed, onToggleCollapse, onCreate, onEdit, onChange }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState(new Set())
  const [delMenu, setDelMenu] = useState(false)
  const [expanded, setExpanded] = useState(new Set())

  const usedByOf = (p) => {
    const isDef = (p.name || '').toLowerCase() === 'default'
    return urls.filter(u => (u.urlContentProfiles || []).some(cp => cp.type === cpType && (cp.profileName === p.name || (isDef && !cp.profileName))))
  }
  const wsOf = (p) => (p.websocketUrls || [])
  const isProtected = (p) => (p.name || '').toLowerCase() === 'default' || usedByOf(p).length > 0 || wsOf(p).length > 0

  const q = search.trim().toLowerCase()
  let list = profiles.map((p, i) => ({ p, i }))
  if (q) list = list.filter(({ p }) => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  const keyVal = ({ p }) => {
    switch (sortCol) {
      case 'name': return (p.name || '').toLowerCase()
      case 'description': return (p.description || '').toLowerCase()
      case 'usedBy': return usedByOf(p).length + wsOf(p).length
      default: return ''
    }
  }
  if (sortCol) { const dir = sortDir === 'desc' ? -1 : 1; list = [...list].sort((a, b) => { const av = keyVal(a), bv = keyVal(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 }) }
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(pageNum, totalPages)
  const pageRows = list.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selIdxs = pageRows.filter(r => !isProtected(r.p)).map(r => r.i)
  const allSel = selIdxs.length > 0 && selIdxs.every(i => selected.has(i))
  const removableCount = profiles.filter(p => !isProtected(p)).length

  const sortBy = (key) => { if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(key); setSortDir('asc') } }
  const toggleSel = (i) => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const toggleExp = (i) => setExpanded(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const bulkDelete = () => { if (selected.size === 0) return; onChange(profiles.filter((p, idx) => isProtected(p) || !selected.has(idx))); setSelected(new Set()) }
  const deleteAll = () => { if (removableCount === 0) return; if (!window.confirm(`Delete all ${removableCount} profiles? (default and in-use profiles are kept)`)) return; onChange(profiles.filter(p => isProtected(p))); setSelected(new Set()); setPageNum(1); setDelMenu(false) }

  const SORT_COLS = [['name', 'Profile Name'], ['description', 'Description'], ['usedBy', 'Used By URLs']]
  return (
    <Card>
      <SectionHeader title={title} sub={`${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`}
        onClick={onToggleCollapse} collapsed={collapsed}
        action={
          <>
            <input value={search} onChange={e => { setSearch(e.target.value); setPageNum(1) }} placeholder="Search…"
              className="text-xs border border-gray-200 rounded px-2 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            {selected.size > 0 && (
              <div className="relative inline-flex">
                <button onClick={bulkDelete} className="text-xs px-2.5 py-1.5 rounded-l bg-red-600 text-white hover:bg-red-700 border border-red-600 font-medium">Delete ({selected.size})</button>
                <button onClick={() => setDelMenu(o => !o)} title="More delete options" className="text-xs px-1.5 py-1.5 rounded-r bg-red-600 text-white hover:bg-red-700 border-y border-r border-red-600 border-l border-l-red-400">▾</button>
                {delMenu && (<>
                  <div className="fixed inset-0 z-0" onClick={() => setDelMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
                    <button onClick={deleteAll} className="block w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 whitespace-nowrap">Delete All ({removableCount})</button>
                  </div>
                </>)}
              </div>
            )}
            <Btn size="sm" onClick={onCreate}>Create…</Btn>
          </>
        } />
      {!collapsed && (
        <div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-8 px-2 py-2 text-center">
                {selIdxs.length > 0 && (
                  <input type="checkbox" checked={allSel}
                    onChange={() => setSelected(s => { const n = new Set(s); if (allSel) selIdxs.forEach(i => n.delete(i)); else selIdxs.forEach(i => n.add(i)); return n })} />
                )}
              </th>
              {SORT_COLS.map(([key, label]) => (
                <th key={key} onClick={() => sortBy(key)} className="text-left px-4 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 group">
                  <span className="inline-flex items-center gap-1">{label}
                    {sortCol === key
                      ? <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                      : <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                  </span>
                </th>
              ))}
              <th className="w-12 px-2 py-2 text-right font-medium text-gray-500">Edit</th>
            </tr></thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">{search ? 'No profiles match your search.' : 'No profiles configured.'}</td></tr>
              )}
              {pageRows.flatMap(({ p, i }) => {
                const isDef = (p.name || '').toLowerCase() === 'default'
                const usedByUrls = usedByOf(p)
                const ws = wsOf(p)
                const hasWs = ws.length > 0
                const isExp = expanded.has(i)
                const protectedRow = isProtected(p)
                return [
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${selected.has(i) ? 'bg-blue-50' : ''}`}>
                    <td className="px-2 py-2.5 text-center">
                      {!protectedRow && <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSel(i)} />}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {p.name || 'Default'}
                      {isDef && <span className="ml-1.5 text-[10px] text-gray-400 font-sans">(default)</span>}
                      {!isDef && protectedRow && <span className="ml-1.5 text-[10px] text-gray-400 font-sans">(in use)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{p.description || ''}</td>
                    <td className="px-4 py-2.5">
                      {usedByUrls.length === 0 && !hasWs
                        ? <span className="text-gray-300 text-[11px]">—</span>
                        : <button onClick={() => toggleExp(i)} className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800">
                            <span className="font-medium">{[usedByUrls.length > 0 && `${usedByUrls.length} URL${usedByUrls.length !== 1 ? 's' : ''}`, hasWs && `${ws.length} WS`].filter(Boolean).join(', ')}</span>
                            <span className="text-[10px]">{isExp ? '▾' : '▸'}</span>
                          </button>}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button onClick={() => onEdit(i)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit profile">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                    </td>
                  </tr>,
                  isExp && (usedByUrls.length > 0 || hasWs) && (
                    <tr key={`${i}-exp`} className="border-b border-gray-100 bg-blue-50/40">
                      <td colSpan={5} className="px-6 py-3 space-y-3">
                        {usedByUrls.length > 0 && (
                          <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-blue-100">
                              <th className="text-left py-1 pr-4 font-medium text-gray-400 w-20">Protocol</th>
                              <th className="text-left py-1 pr-4 font-medium text-gray-400 w-16">Method</th>
                              <th className="text-left py-1 font-medium text-gray-400">URI</th>
                            </tr></thead>
                            <tbody>
                              {usedByUrls.map((u, ui) => (
                                <tr key={ui} className="border-b border-blue-50 last:border-0">
                                  <td className="py-1 pr-4"><Badge color={u.protocol === 'https' ? 'green' : 'blue'}>{(u.protocol || 'http').toUpperCase()}</Badge></td>
                                  <td className="py-1 pr-4 font-mono text-gray-500">{(!u.method || u.method === '*') ? '' : u.method}</td>
                                  <td className="py-1 font-mono text-gray-800">{u.name}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {hasWs && (
                          <div>
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">WebSocket URLs</div>
                            {ws.map((u, j) => <div key={j} className="text-xs text-amber-700 font-medium py-0.5">{u}</div>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>
          {/* Pagination — DeviceFleet style */}
          {total > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {[10, 20, 50].map((size, idx) => (
                  <span key={size} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-gray-300">|</span>}
                    <button onClick={() => { setPageSize(size); setPageNum(1) }} className={`px-1 py-0.5 rounded transition-colors ${pageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>{size}</button>
                  </span>
                ))}
                
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>Page {safePage} of {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                  <button onClick={() => setPageNum(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// Policy-level character-set editor (the `character-sets` key). Renders the
// JSON-profile-style metachar grid for one characterSetType, with orange
// highlighting for entries that differ from their default.
function PolicyCharSetPanel({ title, csType, charSets, onChange, collapsed, onToggleCollapse, defaultCharSet }) {
  const [view, setView] = useState('meta-only')
  const entry = (charSets || []).find(e => e.characterSetType === csType)
  // Baseline for "default": the global default for this type (from settings) if available,
  // otherwise the built-in PT_ALL_CHARS fallback.
  const defaultFor = (hex) => {
    if (defaultCharSet && hex in defaultCharSet) return defaultCharSet[hex]
    return PT_ALL_CHARS.find(x => x.hex === hex)?.defaultAllowed ?? true
  }
  const getState = (hex) => {
    const c = entry?.characterSet?.find(c => c.metachar === hex)
    if (c) return c.isAllowed
    return defaultFor(hex)
  }
  const setState = (hex, allowed) => {
    const cs = charSets || []
    const idx = cs.findIndex(e => e.characterSetType === csType)
    const base = idx === -1 ? PT_META_DEFAULTS.map(m => ({ ...m })) : [...(cs[idx].characterSet || PT_META_DEFAULTS.map(m => ({ ...m })))]
    const ci = base.findIndex(c => c.metachar === hex)
    const ns = ci === -1 ? [...base, { metachar: hex, isAllowed: allowed }] : base.map((c, j) => j === ci ? { ...c, isAllowed: allowed } : c)
    const newCs = idx === -1 ? [...cs, { characterSetType: csType, characterSet: ns }] : cs.map((e, j) => j === idx ? { ...e, characterSet: ns } : e)
    onChange(newCs)
  }
  const restore = () => onChange((charSets || []).filter(e => e.characterSetType !== csType))
  const allDisplay = view === 'meta-only' ? PT_ALL_CHARS.filter(c => c.isMeta)
    : view === 'allowed' ? PT_ALL_CHARS.filter(c => !c.disabled && getState(c.hex))
    : view === 'disallowed' ? PT_ALL_CHARS.filter(c => !c.disabled && !getState(c.hex))
    : PT_ALL_CHARS
  const colSize = Math.ceil(allDisplay.length / 4)
  const cols = [0, 1, 2, 3].map(ci => allDisplay.slice(ci * colSize, (ci + 1) * colSize))
  return (
    <Card>
      <SectionHeader title={title} onClick={onToggleCollapse} collapsed={collapsed} />
      {!collapsed && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">View</span>
              <select value={view} onChange={e => setView(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="all">All characters</option>
                <option value="allowed">Allowed characters</option>
                <option value="disallowed">Disallowed characters</option>
                <option value="meta-only">Meta characters only</option>
              </select>
            </div>
            <button onClick={restore} className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Restore Defaults</button>
          </div>
          <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
            {cols.map((col, ci) => (
              <div key={ci} className={`flex-1 ${ci < 3 ? 'border-r border-gray-200' : ''}`}>
                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                  {['Hex', 'Char', 'State'].map(h => <div key={h} className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">{h}</div>)}
                </div>
                {col.map(ch => {
                  const allowed = getState(ch.hex)
                  const modified = !ch.disabled && allowed !== defaultFor(ch.hex)
                  return (
                    <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                      <div className={`px-2 py-1 text-[10px] font-mono text-center ${modified ? 'text-orange-600' : 'text-blue-600'}`}>{ch.hex}</div>
                      <div className={`px-2 py-1 text-[10px] text-center font-medium ${modified ? 'text-orange-700' : 'text-gray-700'}`}>{ch.name}</div>
                      <div className="px-1 py-0.5 text-center">
                        {ch.disabled
                          ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full"><option>Disallow</option></select>
                          : <select value={allowed ? 'allow' : 'disallow'} onChange={e => setState(ch.hex, e.target.value === 'allow')} className={`text-[10px] border rounded px-1 py-0 w-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${modified ? 'border-orange-300 bg-orange-50' : 'border-gray-300 bg-white'}`}>
                              <option value="allow">Allow</option>
                              <option value="disallow">Disallow</option>
                            </select>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// BIG-IP defaults for policy-builder-url, used to reset a field when it becomes disabled.
const URL_PB_DEFAULTS = {
  maximumUrls: 10000,
  classifyUrls: true,
  collapseUrlsIntoOneEntity: false,
  collapseUrlOccurrences: 500,
  collapseUrlDepth: 2,
  wildcardUrlFiletypes: [],
  maximumWebsocketUrls: 100,
  classifyWebsocketUrls: true,
}

function UrlLearningSettings({ pbu, onChange }) {
  const [ftInput, setFtInput] = useState('')
  const [stashedFiletypes, setStashedFiletypes] = useState(null) // holds the list while disabled so it survives + stays out of JSON
  const httpLearn = pbu.learnExplicitUrls ?? 'selective'
  const wsLearn = pbu.learnExplicitWebsocketUrls ?? 'selective'

  // enable/disable rules
  const enHttpMax = httpLearn !== 'never'
  const enHttpClassify = httpLearn !== 'never'
  const enHttpCollapse = httpLearn === 'always'
  const enHttpFiletypes = httpLearn === 'selective' || httpLearn === 'always'
  const enWs = wsLearn !== 'never'

  function setHttpLearn(val) {
    const patch = { learnExplicitUrls: val }
    const resetCollapse = () => {
      patch.collapseUrlsIntoOneEntity = URL_PB_DEFAULTS.collapseUrlsIntoOneEntity
      patch.collapseUrlOccurrences = URL_PB_DEFAULTS.collapseUrlOccurrences
      patch.collapseUrlDepth = URL_PB_DEFAULTS.collapseUrlDepth
    }
    // numeric/boolean fields reset to default when this mode disables them
    if (val === 'never') {
      patch.maximumUrls = URL_PB_DEFAULTS.maximumUrls
      patch.classifyUrls = URL_PB_DEFAULTS.classifyUrls
      resetCollapse()
    } else if (val === 'selective' || val === 'compact') {
      resetCollapse()
    }
    // File types: never lose the user's list — stash it and drop it from the JSON while disabled,
    // restore it to the JSON when re-enabled.
    const willEnableFiletypes = (val === 'selective' || val === 'always')
    if (!willEnableFiletypes) {
      if ((pbu.wildcardUrlFiletypes || []).length) setStashedFiletypes(pbu.wildcardUrlFiletypes)
      patch.wildcardUrlFiletypes = undefined  // omitted from policy JSON while grayed out
    } else if (stashedFiletypes != null) {
      patch.wildcardUrlFiletypes = stashedFiletypes
      setStashedFiletypes(null)
    }
    onChange(patch)
  }

  function setWsLearn(val) {
    const patch = { learnExplicitWebsocketUrls: val }
    if (val === 'never') {
      patch.maximumWebsocketUrls = URL_PB_DEFAULTS.maximumWebsocketUrls
      patch.classifyWebsocketUrls = URL_PB_DEFAULTS.classifyWebsocketUrls
    }
    onChange(patch)
  }

  const lbl = (enabled) => `text-xs ${enabled ? 'text-gray-700' : 'text-gray-400'}`
  const numCls = (enabled) => `w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${enabled ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`
  const filetypes = pbu.wildcardUrlFiletypes || []
  // while disabled, show the stashed list (grayed); it's not in the policy JSON
  const displayFiletypes = enHttpFiletypes ? filetypes : (stashedFiletypes ?? filetypes)

  function addFiletype() {
    const v = ftInput.trim().toLowerCase().replace(/^\*\./, '')
    if (!v || filetypes.includes(v)) { setFtInput(''); return }
    onChange({ wildcardUrlFiletypes: [...filetypes, v] })
    setFtInput('')
  }
  function removeFiletype(ft) {
    onChange({ wildcardUrlFiletypes: filetypes.filter(f => f !== ft) })
  }

  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50 space-y-3">
      {/* learn dropdowns + maximums */}
      <div className="grid grid-cols-[260px_auto] gap-x-3 gap-y-2 items-center">
        <label className="text-xs text-gray-700 font-medium">Learn New HTTP URLs</label>
        <select value={httpLearn} onChange={e => setHttpLearn(e.target.value)}
          className="w-56 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="never">Never (wildcard only)</option>
          <option value="selective">Selective</option>
          <option value="compact">Compact</option>
          <option value="always">Always</option>
        </select>

        <label className={lbl(enHttpMax) + ' font-medium'}>Maximum Learned HTTP URLs</label>
        <input type="number" min={1} disabled={!enHttpMax} className={numCls(enHttpMax)}
          value={pbu.maximumUrls ?? URL_PB_DEFAULTS.maximumUrls}
          onChange={e => onChange({ maximumUrls: Number(e.target.value) })} />

        <label className="text-xs text-gray-700 font-medium">Learn New WebSocket URLs</label>
        <select value={wsLearn} onChange={e => setWsLearn(e.target.value)}
          className="w-56 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="never">Never (wildcard only)</option>
          <option value="selective">Selective</option>
          <option value="always">Always</option>
        </select>

        <label className={lbl(enWs) + ' font-medium'}>Maximum Learned WebSocket URLs</label>
        <input type="number" min={1} disabled={!enWs} className={numCls(enWs)}
          value={pbu.maximumWebsocketUrls ?? URL_PB_DEFAULTS.maximumWebsocketUrls}
          onChange={e => onChange({ maximumWebsocketUrls: Number(e.target.value) })} />
      </div>

      {/* checkbox options */}
      <div className="space-y-1.5 pt-1">
        <label className={`flex items-center gap-2 ${enHttpClassify ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!enHttpClassify}
            checked={pbu.classifyUrls ?? true}
            onChange={e => onChange({ classifyUrls: e.target.checked })} />
          <span className={lbl(enHttpClassify)}>Classify Request Content of Learned HTTP URLs</span>
        </label>

        <label className={`flex items-center gap-2 ${enWs ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!enWs}
            checked={pbu.classifyWebsocketUrls ?? true}
            onChange={e => onChange({ classifyWebsocketUrls: e.target.checked })} />
          <span className={lbl(enWs)}>Classify Client Message Payload Format of Learned WebSocket URLs</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox"
            checked={pbu.learnMethodsOnUrls ?? true}
            onChange={e => onChange({ learnMethodsOnUrls: e.target.checked })} />
          <span className="text-xs text-gray-700">Learn Allowed Methods on HTTP URLs</span>
        </label>

        <div className={`flex items-center gap-2 flex-wrap ${enHttpCollapse ? '' : 'opacity-50'}`}>
          <label className={`flex items-center gap-2 ${enHttpCollapse ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input type="checkbox" disabled={!enHttpCollapse}
              checked={pbu.collapseUrlsIntoOneEntity ?? false}
              onChange={e => onChange({ collapseUrlsIntoOneEntity: e.target.checked })} />
            <span className={lbl(enHttpCollapse)}>Collapse many common HTTP URLs into one wildcard HTTP URL after</span>
          </label>
          <input type="number" min={1} disabled={!enHttpCollapse} className={numCls(enHttpCollapse).replace('w-24', 'w-20')}
            value={pbu.collapseUrlOccurrences ?? URL_PB_DEFAULTS.collapseUrlOccurrences}
            onChange={e => onChange({ collapseUrlOccurrences: Number(e.target.value) })} />
          <span className={lbl(enHttpCollapse)}>occurrences of depth</span>
          <input type="number" min={1} disabled={!enHttpCollapse} className={numCls(enHttpCollapse).replace('w-24', 'w-16')}
            value={pbu.collapseUrlDepth ?? URL_PB_DEFAULTS.collapseUrlDepth}
            onChange={e => onChange({ collapseUrlDepth: Number(e.target.value) })} />
          <span className={lbl(enHttpCollapse)}>at least</span>
        </div>
      </div>

      {/* wildcard filetypes */}
      <div className={enHttpFiletypes ? '' : 'opacity-50'}>
        <div className={lbl(enHttpFiletypes) + ' font-medium mb-1'}>File types for which wildcard HTTP URLs will be configured (e.g. *.jpg)</div>
        <div className="flex items-center gap-2 mb-2">
          <input value={ftInput} disabled={!enHttpFiletypes}
            onChange={e => setFtInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFiletype() } }}
            placeholder="jpg"
            className={`w-40 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${enHttpFiletypes ? 'bg-white' : 'bg-gray-50 cursor-not-allowed'}`} />
          <button type="button" disabled={!enHttpFiletypes} onClick={addFiletype}
            className={`text-xs px-3 py-1 rounded ${enHttpFiletypes ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Add</button>
        </div>
        {displayFiletypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {displayFiletypes.map(ft => (
              <span key={ft} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                {ft}
                {enHttpFiletypes && (
                  <button type="button" onClick={() => removeFiletype(ft)} className="text-gray-400 hover:text-red-600">×</button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Signature-ID autocomplete input. `candidates` is the already-scoped list of signatures the user
// is allowed to pick from (e.g., header-scope only); `existingIds` are IDs already added and should
// be excluded from suggestions. On selection, calls `onAdd(sig)` with the chosen device-signature.
function SigIdAutocomplete({ candidates, existingIds = [], onAdd, placeholder = 'Signature ID…', width = 144 }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [hi, setHi] = useState(0)
  const inputRef = useRef(null)
  const existing = new Set(existingIds.map(String))

  const matches = (() => {
    if (!candidates?.length) return []
    const term = q.trim().toLowerCase()
    const arr = []
    for (const s of candidates) {
      const sid = String(s.signatureId)
      if (existing.has(sid)) continue
      if (term && !sid.includes(term) && !(s.name || '').toLowerCase().includes(term)) continue
      arr.push(s)
      if (arr.length >= 30) break
    }
    return arr
  })()

  function place() {
    const r = inputRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 320) })
  }

  function commit(sig) {
    if (!sig) return
    onAdd(sig)
    setQ(''); setOpen(false); setHi(0)
    inputRef.current?.focus()
  }

  function onKeyDown(e) {
    if (!open || matches.length === 0) {
      if (e.key === 'Enter') e.preventDefault()   // block plain-text Enter
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); commit(matches[hi]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <>
      <input ref={inputRef} name="sigId" value={q}
        onChange={e => { setQ(e.target.value); if (!open) { place(); setOpen(true) } else place(); setHi(0) }}
        onFocus={() => { place(); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width }}
        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
      {open && pos && matches.length > 0 && createPortal(
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded shadow-lg max-h-72 overflow-y-auto py-1"
          onMouseDown={e => e.preventDefault()}>
          {matches.map((s, i) => (
            <button key={String(s.signatureId)} type="button"
              onClick={() => commit(s)}
              onMouseEnter={() => setHi(i)}
              className={`w-full text-left px-2 py-1 text-xs flex items-center gap-2 ${i === hi ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <span className="font-mono text-gray-600 flex-shrink-0">{s.signatureId}</span>
              <span className="text-gray-800 truncate">{s.name || '—'}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
      {open && pos && matches.length === 0 && q.trim() && createPortal(
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded shadow-lg py-2 px-3 text-xs text-gray-400">
          No matching signatures
        </div>,
        document.body
      )}
    </>
  )
}

function PolicyTitleSwitcher({ currentId, currentName, onSelect }) {
  const [open, setOpen] = useState(false)
  const [policies, setPolicies] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (!open || policies.length) return
    listPolicies().then(setPolicies).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-xl font-semibold text-gray-900 hover:text-gray-600 transition-colors">
        {currentName}
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {policies.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>}
          {policies.map(p => (
            <button key={p.id} onClick={() => { setOpen(false); if (String(p.id) !== String(currentId)) onSelect(p.id) }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 ${String(p.id) === String(currentId) ? 'bg-gray-50' : ''}`}>
              <span className={`truncate ${String(p.id) === String(currentId) ? 'text-teal-700 font-semibold' : 'text-gray-700 font-normal'}`}>{p.name}</span>
              <span className="text-xs text-gray-400 font-normal flex-shrink-0 truncate max-w-[120px]">{p.device_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// BIG-IP defaults for policy-builder-cookie, used to reset a field when learning is set to Never.
const COOKIE_PB_DEFAULTS = {
  maximumCookies: 100,
  enforceUnmodifiedCookies: false,
  collapseCookiesIntoOneEntity: false,
  collapseCookieOccurrences: 10,
}

function CookieLearningSettings({ pbc, onChange }) {
  const learn = pbc.learnExplicitCookies ?? 'selective'
  const en = learn === 'selective'   // only Selective unlocks the learn/enforce + collapse options
  const lbl = (enabled) => `text-xs ${enabled ? 'text-gray-700' : 'text-gray-400'}`
  const numCls = (enabled) => `text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${enabled ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`

  function setLearn(val) {
    const patch = { learnExplicitCookies: val }
    if (val === 'never') {
      // Never = no learning: the selective-only fields don't apply, so drop them from the JSON.
      patch.maximumCookies = undefined
      patch.enforceUnmodifiedCookies = undefined
      patch.collapseCookiesIntoOneEntity = undefined
      patch.collapseCookieOccurrences = undefined
    } else if (val === 'selective') {
      // Selective learns explicit cookies — add Maximum Learned Cookies to the config.
      patch.maximumCookies = pbc.maximumCookies ?? COOKIE_PB_DEFAULTS.maximumCookies
    }
    onChange(patch)
  }

  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50 space-y-3">
      <div className="grid grid-cols-[220px_auto] gap-x-3 gap-y-2 items-center">
        <label className="text-xs text-gray-700 font-medium">Learn New Cookies</label>
        <select value={learn} onChange={e => setLearn(e.target.value)}
          className="w-56 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="never">Never (wildcard only)</option>
          <option value="selective">Selective</option>
        </select>

        <label className={`text-xs font-medium ${en ? 'text-gray-700' : 'text-gray-400'}`}>Maximum Learned Cookies</label>
        <input type="number" min={1} disabled={!en} className={`w-24 ${numCls(en)}`}
          value={pbc.maximumCookies ?? COOKIE_PB_DEFAULTS.maximumCookies}
          onChange={e => onChange({ maximumCookies: Number(e.target.value) })} />
      </div>

      <div className="space-y-1.5 pt-1">
        <label className={`flex items-center gap-2 ${en ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!en}
            checked={pbc.enforceUnmodifiedCookies ?? false}
            onChange={e => onChange({ enforceUnmodifiedCookies: e.target.checked })} />
          <span className={lbl(en)}>Learn and enforce new unmodified cookies</span>
        </label>

        <div className={`flex items-center gap-2 flex-wrap ${en ? '' : 'opacity-50'}`}>
          <label className={`flex items-center gap-2 ${en ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input type="checkbox" disabled={!en}
              checked={pbc.collapseCookiesIntoOneEntity ?? false}
              onChange={e => {
                const checked = e.target.checked
                const patch = { collapseCookiesIntoOneEntity: checked }
                // when enabling, persist the occurrences value; when disabling, drop it from the JSON
                patch.collapseCookieOccurrences = checked
                  ? (pbc.collapseCookieOccurrences ?? COOKIE_PB_DEFAULTS.collapseCookieOccurrences)
                  : undefined
                onChange(patch)
              }} />
            <span className={lbl(en)}>Collapse many common Cookies into one wildcard Cookie after</span>
          </label>
          <input type="number" min={2} disabled={!en || !(pbc.collapseCookiesIntoOneEntity ?? false)} className={`w-20 ${numCls(en && (pbc.collapseCookiesIntoOneEntity ?? false))}`}
            value={pbc.collapseCookieOccurrences ?? COOKIE_PB_DEFAULTS.collapseCookieOccurrences}
            onChange={e => onChange({ collapseCookieOccurrences: Number(e.target.value) })} />
          <span className={lbl(en && (pbc.collapseCookiesIntoOneEntity ?? false))}>occurrences</span>
        </div>
      </div>
    </div>
  )
}

const PARAM_PB_DEFAULTS = {
  parameterLearningLevel: 'url',
  maximumParameters: 100,
  classifyParameters: true,
  parametersIntegerValue: false,
  collapseParametersIntoOneEntity: false,
  collapseParameterOccurrences: 10,
}

// which controls are available for each learn mode
function paramFlags(m) {
  return {
    level:    m !== 'compact',                       // Parameter Level: all modes except compact
    max:      m !== 'never',                          // Maximum Learned Parameters
    classify: m !== 'never',                          // Classify Value Content
    integer:  m !== 'never',                          // Learn Integer Parameters
    dynamic:  m === 'selective' || m === 'always',    // Learn Dynamic Parameters
    collapse: m === 'always',                         // Collapse into wildcard
  }
}

function ParameterLearningSettings({ pbp, onChange }) {
  const learn = pbp.learnExplicitParameters ?? 'selective'
  const f = paramFlags(learn)
  const dynOn = !!(pbp.dynamicParameters && Object.values(pbp.dynamicParameters).some(Boolean))
  const lbl = (en) => `text-xs ${en ? 'text-gray-700' : 'text-gray-400'}`
  const numCls = (en) => `text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${en ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`

  function setLearn(val) {
    const nf = paramFlags(val)
    const patch = { learnExplicitParameters: val }
    if (!nf.level)    patch.parameterLearningLevel = PARAM_PB_DEFAULTS.parameterLearningLevel
    if (!nf.max)      patch.maximumParameters = PARAM_PB_DEFAULTS.maximumParameters
    if (!nf.classify) patch.classifyParameters = PARAM_PB_DEFAULTS.classifyParameters
    if (!nf.integer)  patch.parametersIntegerValue = PARAM_PB_DEFAULTS.parametersIntegerValue
    if (!nf.dynamic)  patch.dynamicParameters = undefined
    if (!nf.collapse) {
      patch.collapseParametersIntoOneEntity = PARAM_PB_DEFAULTS.collapseParametersIntoOneEntity
      patch.collapseParameterOccurrences = PARAM_PB_DEFAULTS.collapseParameterOccurrences
    }
    onChange(patch)
  }

  // Learn Integer & Learn Dynamic are mutually exclusive
  function setInteger(checked) {
    const patch = { parametersIntegerValue: checked }
    if (checked) patch.dynamicParameters = undefined
    onChange(patch)
  }
  function setDynamic(checked) {
    const patch = { dynamicParameters: checked ? { formParameters: true, linkParameters: true, allHiddenFields: true, uniqueValueSets: false } : undefined }
    if (checked) patch.parametersIntegerValue = false
    onChange(patch)
  }

  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50 space-y-3">
      <div className="grid grid-cols-[230px_auto] gap-x-3 gap-y-2 items-center">
        <label className="text-xs text-gray-700 font-medium">Learn New Parameters</label>
        <select value={learn} onChange={e => setLearn(e.target.value)}
          className="w-56 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="never">Never (wildcard only)</option>
          <option value="selective">Selective</option>
          <option value="compact">Compact</option>
          <option value="always">Always</option>
        </select>

        <label className={`text-xs font-medium ${f.level ? 'text-gray-700' : 'text-gray-400'}`}>Parameter Level</label>
        <select value={pbp.parameterLearningLevel ?? PARAM_PB_DEFAULTS.parameterLearningLevel} disabled={!f.level}
          onChange={e => onChange({ parameterLearningLevel: e.target.value })}
          className={`w-56 ${numCls(f.level)}`}>
          <option value="global">Global</option>
          <option value="url">URL</option>
        </select>

        <label className={`text-xs font-medium ${f.max ? 'text-gray-700' : 'text-gray-400'}`}>Maximum Learned Parameters</label>
        <input type="number" min={1} disabled={!f.max} className={`w-24 ${numCls(f.max)}`}
          value={pbp.maximumParameters ?? PARAM_PB_DEFAULTS.maximumParameters}
          onChange={e => onChange({ maximumParameters: Number(e.target.value) })} />
      </div>

      <div className="space-y-1.5 pt-1">
        <label className={`flex items-center gap-2 ${f.classify ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!f.classify}
            checked={pbp.classifyParameters ?? false}
            onChange={e => onChange({ classifyParameters: e.target.checked })} />
          <span className={lbl(f.classify)}>Classify Value Content of Learned Parameters</span>
        </label>

        <label className={`flex items-center gap-2 ${f.integer ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!f.integer}
            checked={pbp.parametersIntegerValue ?? false}
            onChange={e => setInteger(e.target.checked)} />
          <span className={lbl(f.integer)}>Learn Integer Parameters</span>
        </label>

        <label className={`flex items-center gap-2 ${f.dynamic ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!f.dynamic}
            checked={dynOn}
            onChange={e => setDynamic(e.target.checked)} />
          <span className={lbl(f.dynamic)}>Learn Dynamic Parameters</span>
        </label>

        <div className={`flex items-center gap-2 flex-wrap ${f.collapse ? '' : 'opacity-50'}`}>
          <label className={`flex items-center gap-2 ${f.collapse ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input type="checkbox" disabled={!f.collapse}
              checked={pbp.collapseParametersIntoOneEntity ?? false}
              onChange={e => onChange({ collapseParametersIntoOneEntity: e.target.checked })} />
            <span className={lbl(f.collapse)}>Collapse many common Parameters into one wildcard Parameter after</span>
          </label>
          <input type="number" min={2} disabled={!f.collapse} className={`w-20 ${numCls(f.collapse)}`}
            value={pbp.collapseParameterOccurrences ?? PARAM_PB_DEFAULTS.collapseParameterOccurrences}
            onChange={e => onChange({ collapseParameterOccurrences: Number(e.target.value) })} />
          <span className={lbl(f.collapse)}>occurrences</span>
        </div>
      </div>
    </div>
  )
}

// The 13 Web Services Security sub-violations (schema enum), in BIG-IP display order.
const WSS_SUBVIOLATIONS = [
  'UnSigned Timestamp', 'Timestamp expiration is too far in the future', 'Expired Timestamp',
  'Invalid Timestamp', 'Missing Timestamp', 'Verification Error', 'Signing Error',
  'Encryption Error', 'Decryption Error', 'Certificate Error', 'Certificate Expired',
  'Malformed Error', 'Internal Error',
]

function SessionsLoginsSettings({ pbs, onChange }) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
        <input type="checkbox" checked={pbs.learnLoginPage ?? false}
          onChange={e => onChange({ learnLoginPage: e.target.checked })} />
        Detect login pages
      </label>
    </div>
  )
}

const HEADER_PB_DEFAULTS = { maximumHosts: 100 }

function HeaderLearningSettings({ pbh, onChange }) {
  const learn = pbh.validHostNames ?? false   // "Learn New Host Names"
  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50 space-y-3">
      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
        <input type="checkbox" checked={learn}
          onChange={e => {
            // Maximum Learned Host Names is disabled when not learning, but keep its
            // value as-is so toggling doesn't show up as a spurious change.
            onChange({ validHostNames: e.target.checked })
          }} />
        Learn New Host Names
      </label>
      <div className="grid grid-cols-[220px_auto] gap-x-3 items-center">
        <label className={`text-xs font-medium ${learn ? 'text-gray-700' : 'text-gray-400'}`}>Maximum Learned Host Names</label>
        <input type="number" min={1} disabled={!learn}
          className={`w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${learn ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
          value={pbh.maximumHosts ?? HEADER_PB_DEFAULTS.maximumHosts}
          onChange={e => onChange({ maximumHosts: Number(e.target.value) })} />
      </div>
    </div>
  )
}

const REDIRECTION_PB_DEFAULTS = { maximumRedirectionDomains: 100 }

function RedirectionLearningSettings({ pbr, onChange }) {
  const learn = pbr.learnExplicitRedirectionDomains ?? 'never'
  const enMax = learn === 'always'   // Maximum Learned Redirection Domains is only available on Always

  function setLearn(val) {
    const patch = { learnExplicitRedirectionDomains: val }
    if (val === 'never') patch.maximumRedirectionDomains = REDIRECTION_PB_DEFAULTS.maximumRedirectionDomains
    onChange(patch)
  }

  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50">
      <div className="grid grid-cols-[240px_auto] gap-x-3 gap-y-2 items-center">
        <label className="text-xs text-gray-700 font-medium">Learn New Redirection Domains</label>
        <select value={learn} onChange={e => setLearn(e.target.value)}
          className="w-56 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="never">Never</option>
          <option value="always">Always</option>
        </select>

        <label className={`text-xs font-medium ${enMax ? 'text-gray-700' : 'text-gray-400'}`}>Maximum Learned Redirection Domains</label>
        <input type="number" min={1} disabled={!enMax}
          className={`w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${enMax ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
          value={pbr.maximumRedirectionDomains ?? REDIRECTION_PB_DEFAULTS.maximumRedirectionDomains}
          onChange={e => onChange({ maximumRedirectionDomains: Number(e.target.value) })} />
      </div>
    </div>
  )
}

const FILETYPE_PB_DEFAULTS = { maximumFileTypes: 100 }

function FiletypeLearningSettings({ pbf, onChange }) {
  const learn = pbf.learnExplicitFiletypes ?? 'selective'
  const enMax = learn !== 'never'   // Maximum Learned File Types is ignored when Never

  function setLearn(val) {
    // Maximum Learned File Types is disabled when Never, but keep its value as-is
    // so switching modes doesn't show up as a spurious change.
    onChange({ learnExplicitFiletypes: val })
  }

  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50">
      <div className="grid grid-cols-[220px_auto] gap-x-3 gap-y-2 items-center">
        <label className="text-xs text-gray-700 font-medium">Learn New File Types</label>
        <select value={learn} onChange={e => setLearn(e.target.value)}
          className="w-56 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="never">Never (wildcard only)</option>
          <option value="selective">Selective</option>
          <option value="compact">Compact</option>
          <option value="always">Always</option>
        </select>

        <label className={`text-xs font-medium ${enMax ? 'text-gray-700' : 'text-gray-400'}`}>Maximum Learned File Types</label>
        <input type="number" min={1} disabled={!enMax}
          className={`w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ${enMax ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
          value={pbf.maximumFileTypes ?? FILETYPE_PB_DEFAULTS.maximumFileTypes}
          onChange={e => onChange({ maximumFileTypes: Number(e.target.value) })} />
      </div>
    </div>
  )
}

// Save choice, shown only while the current version is a draft the device hasn't seen:
// fold this edit into it, or leave it alone and start a new version. Once a version is
// deployed there's no choice to offer — editing it always branches a new one.
function SaveSplit({ currentNum, saving, onSave }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const Option = ({ title, sub, onClick }) => (
    <button type="button" onClick={onClick} className="w-full text-left px-3 py-2 hover:bg-gray-50">
      <div className="text-xs font-medium text-gray-800">{title}</div>
      <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</div>
    </button>
  )

  return (
    <div ref={ref} className="relative flex">
      <Btn size="sm" disabled={saving} onClick={() => onSave(true)} className="rounded-r-none">
        {saving ? 'Saving…' : `Update v${currentNum}`}
      </Btn>
      <button type="button" disabled={saving} onClick={() => setOpen(o => !o)}
        title="Other save options"
        className="inline-flex items-center px-1.5 text-xs rounded-r-md border border-l-0 border-gray-200
          bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">
        ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-20">
          <Option title={`Update v${currentNum}`} sub="Fold this edit into the current draft."
            onClick={() => { setOpen(false); onSave(true) }} />
          <Option title={`Save as v${currentNum + 1}`} sub="Keep the draft as-is and start a new version."
            onClick={() => { setOpen(false); onSave(false) }} />
        </div>
      )}
    </div>
  )
}

// Shown only while the edited policy is AHEAD of what the device is running.
// Primary action deploys the current version; the caret lists the other versions
// (and a route into the full Deploy wizard). Disappears once current == deployed.
function DeploySplit({ policyId, templateId, isGroup, current, deployed, navigate }) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  // Only fetched when the menu is opened — the button itself needs no version list.
  useEffect(() => {
    if (!open || versions.length) return
    listVersions(policyId).then(setVersions).catch(() => setVersions([]))
  }, [open, policyId, versions.length])

  const goDeploy = (versionNum) => navigate('/deploy', {
    state: { preselect: isGroup ? { templateId } : { policyId, versionNum } },
  })

  // Anything the device isn't already running is worth offering.
  const others = versions.filter(v => v.version_num !== current && v.version_num !== deployed)

  return (
    <div ref={ref} className="relative flex">
      <Btn variant="primary" onClick={() => goDeploy(current)} className="rounded-r-none">
        Deploy v{current}
      </Btn>
      <button type="button" onClick={() => setOpen(o => !o)}
        title="Other versions"
        className="inline-flex items-center px-1.5 text-xs rounded-r-md border border-l-0 border-gray-900
          bg-gray-900 text-white hover:bg-gray-800 cursor-pointer">
        ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-20">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            Device is running {deployed ? `v${deployed}` : 'nothing yet'}
          </div>
          <button type="button" onClick={() => { setOpen(false); goDeploy(current) }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50">
            <div className="text-xs font-medium text-gray-800">Deploy v{current}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">The version you're editing.</div>
          </button>
          {others.length > 0 && (
            <div className="max-h-56 overflow-y-auto border-t border-gray-100">
              {others.map(v => (
                <button key={v.id} type="button" onClick={() => { setOpen(false); goDeploy(v.version_num) }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50">
                  <div className="text-xs text-gray-800">Deploy v{v.version_num}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate" title={v.change_message}>
                    {v.change_message || 'No message'}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setOpen(false); navigate('/deploy') }}
            className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 border-t border-gray-100">
            Open Deploy wizard…
          </button>
        </div>
      )}
    </div>
  )
}

export default function PolicyEditor() {
  const { id, templateId } = useParams()
  const isGroup = !!templateId
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')
  const [rawSearch, setRawSearch] = useState('')
  const rawPreRef = useRef(null)
  const [unsaved, setUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  // Optional "why" for this edit — becomes the version's change_message, so it shows up
  // in Version history and in the audit trail. Blank falls back to the API's default.
  const [changeMessage, setChangeMessage] = useState('')
  const [policy, setPolicy] = useState(null)
  const [editedPol, setEditedPol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [violFilter, setViolFilter] = useState('')
  const [showDiff, setShowDiff] = useState(false)
  const [collapsed, setCollapsed] = useState({
    advanced: true, 'http-msg': true, antivirus: true,
    'sig-settings': true, 'tc-settings': true, 'sig-sets': false, 'sig-individual': true,
    'header-settings': true, 'header-general': false, 'header-redir': false, headers: false, 'cookie-settings': true, cookies: false,
    parameters: false, urls: false, methods: false, filetypes: false, violations: true, evasions: false,
    http: false, websocket: true, csrf: true, redir: true, 'redir-domains': true,
    behavioral: true, bruteforce: true, dataguard: false, ipintel: true, 'ip-cats': true,
    servertech: true, json: false, xml: false, graphql: false, rawjson: false, plaintext: false, gwt: false,
    'cs-url': true, 'cs-parameter-name': true, 'cs-parameter-value': true, 'cs-header': true,
    'cs-json-content': true, 'cs-xml-content': true, 'cs-gwt-content': true, 'cs-plain-text-content': true,
  })
  const [expandedPlainText, setExpandedPlainText] = useState(null)
  const [gqlModalIdx, setGqlModalIdx] = useState(null)
  const [gqlModalDraft, setGqlModalDraft] = useState(null)
  const [gqlSubTab, setGqlSubTab] = useState('attack-sigs')
  const [gqlMetaView, setGqlMetaView] = useState('meta-only')
  const [gqlSigSearch, setGqlSigSearch] = useState('')
  const [gqlSigFilters, setGqlSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [gqlSigAdvancedOpen, setGqlSigAdvancedOpen] = useState(false)
  const [gqlSigAdvancedSelected, setGqlSigAdvancedSelected] = useState(new Set())
  const [gqlNewPattern, setGqlNewPattern] = useState('')
  const [gqlNewMaskVar, setGqlNewMaskVar] = useState('')
  const [jsonModalIdx, setJsonModalIdx] = useState(null)
  const [jsonModalDraft, setJsonModalDraft] = useState(null)
  const [jsonSubTab, setJsonSubTab] = useState('attack-sigs')
  const [jsonMetaView, setJsonMetaView] = useState('meta-only')
  const [jsonSigSearch, setJsonSigSearch] = useState('')
  const [jsonSigFilters, setJsonSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [jsonSigAdvancedOpen, setJsonSigAdvancedOpen] = useState(false)
  const [jsonSigAdvancedSelected, setJsonSigAdvancedSelected] = useState(new Set())
  const [jsonNewMaskEl, setJsonNewMaskEl] = useState('')
  const [jsonProfExpanded, setJsonProfExpanded] = useState(new Set())
  const [xmlProfExpanded, setXmlProfExpanded] = useState(new Set())
  const [ptProfExpanded, setPtProfExpanded] = useState(new Set())
  const [gwtProfExpanded, setGwtProfExpanded] = useState(new Set())
  const [gqlProfExpanded, setGqlProfExpanded] = useState(new Set())
  const [xmlModalIdx, setXmlModalIdx] = useState(null)
  const [xmlModalDraft, setXmlModalDraft] = useState(null)
  const [xmlSubTab, setXmlSubTab] = useState('firewall-config')
  const [xmlSigSearch, setXmlSigSearch] = useState('')
  const [xmlSigFilters, setXmlSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [xmlSigAdvancedOpen, setXmlSigAdvancedOpen] = useState(false)
  const [xmlSigAdvancedSelected, setXmlSigAdvancedSelected] = useState(new Set())
  const [xmlElemMetaView, setXmlElemMetaView] = useState('meta-only')
  const [xmlAttrMetaView, setXmlAttrMetaView] = useState('meta-only')
  const [xmlMaskNs, setXmlMaskNs] = useState('any')
  const [xmlMaskNsCustom, setXmlMaskNsCustom] = useState('')
  const [xmlMaskNameType, setXmlMaskNameType] = useState('element')
  const [xmlMaskNameValue, setXmlMaskNameValue] = useState('')
  const [ftModalIdx, setFtModalIdx] = useState(null)
  const [ftModalDraft, setFtModalDraft] = useState(null)
  const [ftCreateOpen, setFtCreateOpen] = useState(false)
  const [csrfModalIdx, setCsrfModalIdx] = useState(null)
  const [csrfModalDraft, setCsrfModalDraft] = useState(null)
  const [csrfNewParam, setCsrfNewParam] = useState('')
  const [ssrfModalIdx, setSsrfModalIdx] = useState(null)
  const [ssrfModalDraft, setSsrfModalDraft] = useState(null)
  const [ssrfSearch, setSsrfSearch] = useState('')
  const [loginModalIdx, setLoginModalIdx] = useState(null)
  const [loginModalDraft, setLoginModalDraft] = useState(null)
  const [loginUrlSearch, setLoginUrlSearch] = useState('')
  const [loginUrlOpen, setLoginUrlOpen] = useState(false)
  const [logoutUrlSearch, setLogoutUrlSearch] = useState('')
  const [logoutUrlOpen, setLogoutUrlOpen] = useState(false)
  const [logoutModalIdx, setLogoutModalIdx] = useState(null)
  const [logoutModalDraft, setLogoutModalDraft] = useState(null)
  const [newAuthUrl, setNewAuthUrl] = useState('')
  const [newCondType, setNewCondType] = useState('responseContains')
  const [newCondValue, setNewCondValue] = useState('')
  const [newCondMatch, setNewCondMatch] = useState('exact')
  const [bfModalIdx, setBfModalIdx] = useState(null)
  const [bfModalDraft, setBfModalDraft] = useState(null)
  const [ipExcModalIdx, setIpExcModalIdx] = useState(null)
  const [ipExcModalDraft, setIpExcModalDraft] = useState(null)
  const [ipExcSearch, setIpExcSearch] = useState('')
  const [ipExcSelected, setIpExcSelected] = useState(new Set())
  const [gwtModalIdx, setGwtModalIdx] = useState(null)
  const [gwtModalDraft, setGwtModalDraft] = useState(null)
  const [gwtSubTab, setGwtSubTab] = useState('attack-sigs')
  const [gwtMetaView, setGwtMetaView] = useState('meta-only')
  const [gwtSigSearch, setGwtSigSearch] = useState('')
  const [gwtSigFilters, setGwtSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [gwtSigAdvancedOpen, setGwtSigAdvancedOpen] = useState(false)
  const [gwtSigAdvancedSelected, setGwtSigAdvancedSelected] = useState(new Set())
  const [ptModalIdx, setPtModalIdx] = useState(null)
  const [ptModalDraft, setPtModalDraft] = useState(null)
  const [plainTextSubTab, setPlainTextSubTab] = useState('attack-sigs')
  const [ptMetaView, setPtMetaView] = useState('meta-only')
  const [ptSigSearch, setPtSigSearch] = useState('')
  // Plain Text Profile signature-picker selections. (Upstream WAF Manager
  // references these setters without declaring the state — a latent crash on
  // opening the modal; declared here so the ported editor is sound.)
  const [ptSelectedLeft, setPtSelectedLeft] = useState(new Set())
  const [ptSelectedRight, setPtSelectedRight] = useState(new Set())
  const [ptSigFilters, setPtSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [ptSigAdvancedOpen, setPtSigAdvancedOpen] = useState(false)
  const [ptSigAdvancedSelected, setPtSigAdvancedSelected] = useState(new Set())
  const [newStatusCode, setNewStatusCode] = useState('')
  const [newXffHeader, setNewXffHeader] = useState('')
  const [newServerTech, setNewServerTech] = useState('')
  const [geoFilter, setGeoFilter] = useState('')
  const [newXmlProfile, setNewXmlProfile] = useState('')
  const [deviceSigs, setDeviceSigs] = useState([])
  const [deviceSigSets, setDeviceSigSets] = useState([])
  const [deviceViolations, setDeviceViolations] = useState([])
  const [sigsLoading, setSigsLoading] = useState(false)
  const [sigSearch, setSigSearch] = useState('')
  const [sigPage, setSigPage] = useState(1)
  const [sigPageSize, setSigPageSize] = useState(20)
  const [sigSortCol, setSigSortCol] = useState(null)
  const [sigSortDir, setSigSortDir] = useState('asc')
  const [expandedSig, setExpandedSig] = useState(null)
  const [expandedSigSet, setExpandedSigSet] = useState(null)
  const [expandedHeader, setExpandedHeader] = useState(null)
  const [headerSigModal, setHeaderSigModal] = useState(null)
  const [headerSigSearch, setHeaderSigSearch] = useState('')
  const [headerSigSelected, setHeaderSigSelected] = useState(new Set())
  const [headerSigFilters, setHeaderSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [expandedCookie, setExpandedCookie] = useState(null)
  const [cookieSigModal, setCookieSigModal] = useState(null)
  const [cookieSigSearch, setCookieSigSearch] = useState('')
  const [cookieSigSelected, setCookieSigSelected] = useState(new Set())
  const [cookieSigFilters, setCookieSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [urlSigModal, setUrlSigModal] = useState(null)
  const [urlSigSearch, setUrlSigSearch] = useState('')
  const [urlSigSelected, setUrlSigSelected] = useState(new Set())
  const [urlSigFilters, setUrlSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [expandedParam, setExpandedParam] = useState(null)
  const [paramModalSnapshot, setParamModalSnapshot] = useState(null)
  const [paramSubTab, setParamSubTab] = useState('data-type')
  const [paramMetaView, setParamMetaView] = useState('meta-only')
  const [paramMetaSearch, setParamMetaSearch] = useState('')
  const [paramUrlSearch, setParamUrlSearch] = useState('')
  const [paramUrlOpen, setParamUrlOpen] = useState(false)
  const [paramSigModal, setParamSigModal] = useState(null)
  const [paramSigSearch, setParamSigSearch] = useState('')
  const [paramSigSelected, setParamSigSelected] = useState(new Set())
  const [paramSigFilters, setParamSigFilters] = useState({ accuracy: 'all', risk: 'all', cve: 'all' })
  const [sigFilters, setSigFilters] = useState({ learn: 'all', alarm: 'all', block: 'all', status: 'all', accuracy: 'all', risk: 'all', cve: 'all' })
  const [selectedSigs, setSelectedSigs] = useState(new Set())
  const [sigActionOpen, setSigActionOpen] = useState(null)
  const [deviceTCs, setDeviceTCs] = useState([])
  const [tcSearch, setTcSearch] = useState('')
  const [tcPage, setTcPage] = useState(1)
  const [tcPageSize, setTcPageSize] = useState(20)
  const [tcSortCol, setTcSortCol] = useState(null)
  const [tcSortDir, setTcSortDir] = useState('asc')
  const [expandedTC, setExpandedTC] = useState(null)
  const [tcFilters, setTcFilters] = useState({ status: 'all', risk: 'all', attackType: 'all' })
  const [selectedTCs, setSelectedTCs] = useState(new Set())
  const [tcActionOpen, setTcActionOpen] = useState(null)
  const [headerSubTab, setHeaderSubTab] = useState('general')
  const [expandedUrl, setExpandedUrl] = useState(null)
  const [urlSubTab, setUrlSubTab] = useState('attack-sigs')
  const [urlSearch, setUrlSearch] = useState('')
  const [urlSortCol, setUrlSortCol] = useState(null)
  const [urlSortDir, setUrlSortDir] = useState('asc')
  const [urlPageNum, setUrlPageNum] = useState(1)
  const [urlPageSize, setUrlPageSize] = useState(20)
  const [urlSelected, setUrlSelected] = useState(new Set())
  const [urlDeleteMenuOpen, setUrlDeleteMenuOpen] = useState(false)
  const [urlModalSnapshot, setUrlModalSnapshot] = useState(null)
  const [urlMetaView, setUrlMetaView] = useState('meta-only')
  const [urlMetaSearch, setUrlMetaSearch] = useState('')
  const [urlMethodRightSel, setUrlMethodRightSel] = useState(null)
  const [urlMethodLeftSel, setUrlMethodLeftSel] = useState(null)
  const [newMethodName, setNewMethodName] = useState('')
  const [newMethodActAs, setNewMethodActAs] = useState('GET')
  const [showMethodSuggestions, setShowMethodSuggestions] = useState(false)
  const [dgCustomInput, setDgCustomInput] = useState('')
  const [dgExceptionInput, setDgExceptionInput] = useState('')
  const [dgFileTypeInput, setDgFileTypeInput] = useState('')
  const [dgUrlInput, setDgUrlInput] = useState('')
  const [hostnameSubdomain, setHostnameSubdomain] = useState(false)
  const [hostnameInput, setHostnameInput] = useState('')
  const [redirSubdomain, setRedirSubdomain] = useState(false)
  const [redirType, setRedirType] = useState('explicit')
  const [redirInput, setRedirInput] = useState('')
  const [rpTabState, setRpTabState] = useState({})
  function sortTcBy(col) {
    if (tcSortCol === col) setTcSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setTcSortCol(col); setTcSortDir('asc') }
  }
  function sortSigBy(col) {
    if (sigSortCol === col) setSigSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSigSortCol(col); setSigSortDir('asc') }
  }
  const [ftPageSize, setFtPageSize] = useState(20)
  const [ftPageNum, setFtPageNum] = useState(1)
  const [ftSearch, setFtSearch] = useState('')
  const [ftSortCol, setFtSortCol] = useState(null)
  const [ftSortDir, setFtSortDir] = useState('asc')
  const [ftSelected, setFtSelected] = useState(new Set())
  const [ftDeleteMenuOpen, setFtDeleteMenuOpen] = useState(false)
  const [hdrPageSize, setHdrPageSize] = useState(20)
  const [hdrPageNum, setHdrPageNum] = useState(1)
  const [hdrSearch, setHdrSearch] = useState('')
  const [hdrSortCol, setHdrSortCol] = useState(null)
  const [hdrSortDir, setHdrSortDir] = useState('asc')
  const [hdrSelected, setHdrSelected] = useState(new Set())
  const [hdrDeleteMenuOpen, setHdrDeleteMenuOpen] = useState(false)
  const [hdrModalSnapshot, setHdrModalSnapshot] = useState(null)
  const [hdrAddOpen, setHdrAddOpen] = useState(false)
  const [hdrAddName, setHdrAddName] = useState('')
  const [hdrAddType, setHdrAddType] = useState('explicit')
  const [hdrAddPos, setHdrAddPos] = useState(null)
  const hdrAddBtnRef = useRef(null)
  const [ckPageSize, setCkPageSize] = useState(20)
  const [ckPageNum, setCkPageNum] = useState(1)
  const [ckSearch, setCkSearch] = useState('')
  const [ckSortCol, setCkSortCol] = useState(null)
  const [ckSortDir, setCkSortDir] = useState('asc')
  const [ckSelected, setCkSelected] = useState(new Set())
  const [ckDeleteMenuOpen, setCkDeleteMenuOpen] = useState(false)
  const [ckModalSnapshot, setCkModalSnapshot] = useState(null)
  const [ckAddOpen, setCkAddOpen] = useState(false)
  const [ckAddName, setCkAddName] = useState('')
  const [ckAddType, setCkAddType] = useState('explicit')
  const [ckAddPos, setCkAddPos] = useState(null)
  const ckAddBtnRef = useRef(null)

  const [pmAddOpen, setPmAddOpen] = useState(false)
  const [pmAddName, setPmAddName] = useState('')
  const [pmAddType, setPmAddType] = useState('explicit')
  const [pmAddPos, setPmAddPos] = useState(null)
  const pmAddBtnRef = useRef(null)
  const [urlAddOpen, setUrlAddOpen] = useState(false)
  const [urlAddName, setUrlAddName] = useState('')
  const [urlAddType, setUrlAddType] = useState('explicit')
  const [urlAddIsAllowed, setUrlAddIsAllowed] = useState(true)
  const [urlAddPos, setUrlAddPos] = useState(null)
  const [urlAccessFilter, setUrlAccessFilter] = useState('all')   // 'all' | 'allowed' | 'disallowed'
  const urlAddBtnRef = useRef(null)
  // Parameter table: search / sort / pagination / multi-select
  const [paramSearch, setParamSearch] = useState('')
  const [paramSortKey, setParamSortKey] = useState(null)
  const [paramSortDir, setParamSortDir] = useState('asc')
  const [paramPage, setParamPage] = useState(1)
  const [paramPageSize, setParamPageSize] = useState(20)
  const [paramSelected, setParamSelected] = useState(new Set())
  const [pmDeleteMenuOpen, setPmDeleteMenuOpen] = useState(false)

  const setPolicyName  = useBreadcrumbStore(s => s.setPolicyName)
  const clearBreadcrumb = useBreadcrumbStore(s => s.clear)
  const setSubTab   = useSubTabStore(s => s.setSubTab)
  const clearSubTab = useSubTabStore(s => s.clearSubTab)

  function toggleSection(key) { setCollapsed(p => ({ ...p, [key]: !p[key] })) }

  useEffect(() => {
    // Guided Configuration hands off a locally-built, schema-validated draft
    // through sessionStorage rather than the API (there is no create-with-content
    // endpoint yet). The editor loads it read-to-tweak; saving a brand-new policy
    // from here is the one follow-up still to wire.
    const fetch = (id === 'guided-draft' && !isGroup)
      ? Promise.resolve(JSON.parse(sessionStorage.getItem('wafmgr:guidedDraft') || 'null'))
          .then(d => { if (!d) throw new Error('No guided draft found'); return { ...d, _guidedDraft: true } })
      : (isGroup ? getGroupPolicy(templateId) : getPolicy(id))
    fetch
      .then(p => {
        setPolicy(p)
        // Normalize any legacy shapes on the way in so the editor + save-path only ever deal
        // with the schema-correct form. BIG-IP's importer crashes on `signatureOverrides` entries
        // that are bare strings/ints instead of objects (Perl `HASH ref` error).
        const raw = JSON.parse(JSON.stringify(p.content?.policy || {}))
        const normalizeOverrides = (arr) => {
          if (!Array.isArray(arr)) return arr
          for (const item of arr) {
            if (item && Array.isArray(item.signatureOverrides)) {
              item.signatureOverrides = item.signatureOverrides.map(e =>
                typeof e === 'object' && e !== null
                  ? e
                  : { signatureId: Number(e), enabled: false, name: '', tag: '' }
              )
            }
          }
          return arr
        }
        for (const key of ['parameters', 'urls', 'headers', 'cookies']) {
          normalizeOverrides(raw[key])
        }
        setEditedPol(raw)
        setPolicyName(p.name)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load policy'))
      .finally(() => setLoading(false))
    // NOTE: don't clear the side-nav here. Switching policies changes `id` without
    // remounting, so this cleanup would blank the nav while the effect that owns it
    // (below) doesn't re-run — leaving no nav at all. It clears itself on unmount.
    return () => clearBreadcrumb()
  }, [id, templateId])

  // Global default character sets (from System Settings) — used as the baseline on the
  // Character Sets page when a policy doesn't define a given character-set type.
  const [charsetDefaults, setCharsetDefaults] = useState({})
  useEffect(() => {
    getDefaultCharacterSets()
      .then(d => {
        const map = {}
        for (const t of (d?.types || [])) {
          map[t.characterSetType] = Object.fromEntries((t.characterSet || []).map(c => [c.metachar, c.isAllowed]))
        }
        setCharsetDefaults(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // NGINX App Protect policies (template POLICY_TEMPLATE_NGINX_*) don't support
    // some BIG-IP-only features — hide those tabs for NGINX-sourced policies.
    const isNginx = (editedPol?.template?.name || '').toUpperCase().includes('NGINX')
    const NGINX_HIDDEN_TABS = new Set(['behavioral', 'sessions'])
    const groups = NAV_GROUPS
      .map(g => ({ ...g, tabs: isNginx ? g.tabs.filter(t => !NGINX_HIDDEN_TABS.has(t.id)) : g.tabs }))
      .filter(g => g.tabs.length > 0)
    setSubTab(
      <div className="px-3 py-4 space-y-5">
        {isNginx && (
          <div className="mx-3 px-2 py-1.5 rounded bg-green-50 border border-green-200 text-[10px] text-green-700 font-medium">
            NGINX App Protect — BIG-IP-only features hidden
          </div>
        )}
        {groups.map(g => (
          <div key={g.group}>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">{g.group}</div>
            <div className="space-y-0.5">
              {g.tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors
                    ${activeTab === t.id
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
    // Owned here, so it's torn down here — on unmount, not on every policy switch.
    return () => clearSubTab()
  }, [activeTab, editedPol?.template?.name])

  // Preload the device's signature catalog + sig-sets as soon as we know the policy's device — other
  // tabs (Headers/Cookies/URLs/Parameters) also need `deviceSigs` for the sigId autocomplete and the
  // Advanced exclusion modals, so we can't gate this on the Signatures tab being active.
  useEffect(() => {
    if (!policy?.device_id) return
    if (deviceSigs.length === 0) {
      setSigsLoading(true)
      api.get(`/api/devices/${policy.device_id}/signatures`, { params: { limit: 100000 } })
        .then(r => setDeviceSigs(r.data))
        .catch(() => {})
        .finally(() => setSigsLoading(false))
    }
    if (deviceSigSets.length === 0) {
      api.get(`/api/devices/${policy.device_id}/signature-sets`)
        .then(r => setDeviceSigSets(r.data))
        .catch(() => {})
    }
  }, [policy?.device_id])

  // Threat campaigns are only needed on the Signatures tab.
  useEffect(() => {
    if (activeTab !== 'signatures' || !policy?.device_id) return
    if (deviceTCs.length === 0) {
      api.get(`/api/devices/${policy.device_id}/threat-campaigns`)
        .then(r => setDeviceTCs(r.data))
        .catch(() => {})
    }
  }, [activeTab, policy?.device_id])

  // Scroll the Raw JSON view to the first line matching the search.
  useEffect(() => {
    if (activeTab !== 'rawjson' || !rawSearch.trim()) return
    const el = rawPreRef.current?.querySelector('[data-match="1"]')
    el?.scrollIntoView({ block: 'center' })
  }, [rawSearch, activeTab])

  // Load the device's violation catalog (name → human title) for the Violations tab.
  useEffect(() => {
    if (activeTab !== 'violations' || !policy?.device_id || deviceViolations.length > 0) return
    api.get(`/api/devices/${policy.device_id}/violations`)
      .then(r => setDeviceViolations(r.data))
      .catch(() => {})
  }, [activeTab, policy?.device_id])

  // Materialize staging signatures: imported policies don't list staging signatures in the
  // `signatures` key, so once the device's signature sets are loaded we add every set-covered
  // signature that isn't already an explicit override — those come in as staging.
  useEffect(() => {
    // Run materialization as soon as sig-sets are loaded — the Header/Cookie/URL/Parameter
    // Advanced modals also need these staging entries to appear in `pol.signatures`, not just
    // the Signatures tab.
    if (deviceSigSets.length === 0) return
    setEditedPol(p => {
      if (!p) return p
      const sets = p['signature-sets'] || []
      if (sets.length === 0) return p
      const members = Object.fromEntries(deviceSigSets.map(ds => [ds.name, ds.memberIds || []]))
      const seen = new Set((p.signatures || []).map(s => String(s.signatureId)))
      const additions = []
      for (const set of sets) {
        for (const sid of (members[set.name] || [])) {
          const key = String(sid)
          if (!seen.has(key)) { seen.add(key); additions.push({ signatureId: key, enabled: true, performStaging: true, alarm: true, block: true, learn: true }) }
        }
      }
      return additions.length ? { ...p, signatures: [...(p.signatures || []), ...additions] } : p
    })
  }, [deviceSigSets, editedPol?.['signature-sets']?.length])

  // ── State helpers ──────────────────────────────────────────────
  function setTop(key, val) { setEditedPol(p => ({ ...p, [key]: val })); setUnsaved(true) }
  function toggleTop(key, def = false) { setEditedPol(p => ({ ...p, [key]: !(p[key] ?? def) })); setUnsaved(true) }

  // Parameter edit modal: snapshot the whole edited policy on open so Cancel can
  // revert (the param's value-meta lives at policy level, so a param-only snapshot
  // wouldn't fully undo). Update keeps the live edits; Cancel restores the snapshot.
  function openParamModal(idx, firstSubTab) {
    setParamModalSnapshot({ pol: JSON.parse(JSON.stringify(editedPol)), unsaved })
    setExpandedParam(idx)
    if (firstSubTab) setParamSubTab(firstSubTab)
  }
  function cancelParamModal() {
    if (paramModalSnapshot) { setEditedPol(paramModalSnapshot.pol); setUnsaved(paramModalSnapshot.unsaved) }
    setParamModalSnapshot(null); setExpandedParam(null)
  }
  function commitParamModal() { setParamModalSnapshot(null); setExpandedParam(null) }
  function sortParamBy(key) {
    if (paramSortKey === key) setParamSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setParamSortKey(key); setParamSortDir('asc') }
  }
  function toggleParamSelected(idx) {
    setParamSelected(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function bulkDeleteParams() {
    if (paramSelected.size === 0) return
    setTop('parameters', (editedPol.parameters || []).filter((_, idx) => !paramSelected.has(idx)))
    setParamSelected(new Set()); setExpandedParam(null)
  }
  function deleteAllParams() {
    if (!window.confirm(`Delete all ${(editedPol.parameters || []).length} parameters?`)) return
    setTop('parameters', [])
    setParamSelected(new Set()); setExpandedParam(null); setParamPage(1); setPmDeleteMenuOpen(false)
  }
  // ── Cookie table: modal + sort + multi-select delete (the '*' default cookie is protected) ──
  function openCookieModal(idx) {
    setCkModalSnapshot({ pol: JSON.parse(JSON.stringify(editedPol)), unsaved })
    setExpandedCookie(idx)
  }
  function cancelCookieModal() {
    if (ckModalSnapshot) { setEditedPol(ckModalSnapshot.pol); setUnsaved(ckModalSnapshot.unsaved) }
    setCkModalSnapshot(null); setExpandedCookie(null)
  }
  function commitCookieModal() { setCkModalSnapshot(null); setExpandedCookie(null) }
  function sortCookieBy(key) {
    if (ckSortCol === key) setCkSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setCkSortCol(key); setCkSortDir('asc') }
  }
  function toggleCookieSelected(idx) {
    setCkSelected(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function bulkDeleteCookies() {
    if (ckSelected.size === 0) return
    setTop('cookies', (editedPol.cookies || []).filter((c, idx) => c.name === '*' || !ckSelected.has(idx)))
    setCkSelected(new Set()); setExpandedCookie(null)
  }
  function deleteAllCookies() {
    const list = editedPol.cookies || []
    const removable = list.filter(c => c.name !== '*').length
    if (removable === 0) return
    if (!window.confirm(`Delete all ${removable} cookies? (the '*' default cookie is kept)`)) return
    setTop('cookies', list.filter(c => c.name === '*'))
    setCkSelected(new Set()); setExpandedCookie(null); setCkPageNum(1); setCkDeleteMenuOpen(false)
  }
  // ── Header table: modal + sort + multi-select delete (mandatory/default headers are protected) ──
  const HDR_PROTECTED = ['transfer-encoding', 'authorization', 'cookie', '*', 'referer']
  const isHeaderProtected = (h) => HDR_PROTECTED.includes((h.name || '').toLowerCase())
  function openHeaderModal(idx) {
    setHdrModalSnapshot({ pol: JSON.parse(JSON.stringify(editedPol)), unsaved })
    setExpandedHeader(idx)
  }
  function cancelHeaderModal() {
    if (hdrModalSnapshot) { setEditedPol(hdrModalSnapshot.pol); setUnsaved(hdrModalSnapshot.unsaved) }
    setHdrModalSnapshot(null); setExpandedHeader(null)
  }
  function commitHeaderModal() { setHdrModalSnapshot(null); setExpandedHeader(null) }
  function sortHeaderBy(key) {
    if (hdrSortCol === key) setHdrSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setHdrSortCol(key); setHdrSortDir('asc') }
  }
  function toggleHeaderSelected(idx) {
    setHdrSelected(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function bulkDeleteHeaders() {
    if (hdrSelected.size === 0) return
    setTop('headers', (editedPol.headers || []).filter((h, idx) => isHeaderProtected(h) || !hdrSelected.has(idx)))
    setHdrSelected(new Set()); setExpandedHeader(null)
  }
  function deleteAllHeaders() {
    const list = editedPol.headers || []
    const removable = list.filter(h => !isHeaderProtected(h)).length
    if (removable === 0) return
    if (!window.confirm(`Delete all ${removable} headers? (mandatory headers are kept)`)) return
    setTop('headers', list.filter(h => isHeaderProtected(h)))
    setHdrSelected(new Set()); setExpandedHeader(null); setHdrPageNum(1); setHdrDeleteMenuOpen(false)
  }
  // ── URL table: modal + sort + multi-select delete (no protected rows) ──
  function openUrlModal(idx) {
    setUrlModalSnapshot({ pol: JSON.parse(JSON.stringify(editedPol)), unsaved })
    setExpandedUrl(idx); setUrlSubTab('attack-sigs')
  }
  function cancelUrlModal() {
    if (urlModalSnapshot) { setEditedPol(urlModalSnapshot.pol); setUnsaved(urlModalSnapshot.unsaved) }
    setUrlModalSnapshot(null); setExpandedUrl(null)
  }
  function commitUrlModal() { setUrlModalSnapshot(null); setExpandedUrl(null) }
  function sortUrlBy(key) {
    if (urlSortCol === key) setUrlSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setUrlSortCol(key); setUrlSortDir('asc') }
  }
  function toggleUrlSelected(idx) {
    setUrlSelected(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function bulkDeleteUrls() {
    if (urlSelected.size === 0) return
    setTop('urls', (editedPol.urls || []).filter((_, idx) => !urlSelected.has(idx)))
    setUrlSelected(new Set()); setExpandedUrl(null)
  }
  function deleteAllUrls() {
    if (!window.confirm(`Delete all ${(editedPol.urls || []).length} URLs?`)) return
    setTop('urls', [])
    setUrlSelected(new Set()); setExpandedUrl(null); setUrlPageNum(1); setUrlDeleteMenuOpen(false)
  }
  // ── File Types table: sort + multi-select delete (no protected rows; edit uses existing modal) ──
  function sortFtBy(key) {
    if (ftSortCol === key) setFtSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setFtSortCol(key); setFtSortDir('asc') }
  }
  function toggleFtSelected(idx) {
    setFtSelected(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function bulkDeleteFts() {
    if (ftSelected.size === 0) return
    setTop('filetypes', (editedPol.filetypes || []).filter((_, idx) => !ftSelected.has(idx)))
    setFtSelected(new Set())
  }
  function deleteAllFts() {
    if (!window.confirm(`Delete all ${(editedPol.filetypes || []).length} file types?`)) return
    setTop('filetypes', [])
    setFtSelected(new Set()); setFtPageNum(1); setFtDeleteMenuOpen(false)
  }

  function setNested(parent, key, val) {
    setEditedPol(p => ({ ...p, [parent]: { ...(p[parent] || {}), [key]: val } }))
    setUnsaved(true)
  }
  function toggleNested(parent, key, def = false) {
    setEditedPol(p => {
      const obj = p[parent] || {}
      return { ...p, [parent]: { ...obj, [key]: !(obj[key] ?? def) } }
    })
    setUnsaved(true)
  }

  function toggleItem(arrayKey, index, field, def = false) {
    setEditedPol(p => {
      const arr = [...(p[arrayKey] || [])]
      arr[index] = { ...arr[index], [field]: !(arr[index][field] ?? def) }
      return { ...p, [arrayKey]: arr }
    })
    setUnsaved(true)
  }

  function removeItem(arrayKey, index) {
    setEditedPol(p => {
      const arr = [...(p[arrayKey] || [])]
      arr.splice(index, 1)
      return { ...p, [arrayKey]: arr }
    })
    setUnsaved(true)
  }

  function toggleBlockingItem(section, index, field, def = false) {
    setEditedPol(p => {
      const bs = { ...(p['blocking-settings'] || {}) }
      const arr = [...(bs[section] || [])]
      arr[index] = { ...arr[index], [field]: !(arr[index][field] ?? def) }
      bs[section] = arr
      return { ...p, 'blocking-settings': bs }
    })
    setUnsaved(true)
  }

  function setBlockingItemField(section, index, field, val) {
    setEditedPol(p => {
      const bs = { ...(p['blocking-settings'] || {}) }
      const arr = [...(bs[section] || [])]
      arr[index] = { ...arr[index], [field]: val }
      bs[section] = arr
      return { ...p, 'blocking-settings': bs }
    })
    setUnsaved(true)
  }

  function toggleIpCategory(index, field) {
    setEditedPol(p => {
      const ipIntel = { ...(p['ip-intelligence'] || {}) }
      const cats = [...(ipIntel.ipIntelligenceCategories || [])]
      cats[index] = { ...cats[index], [field]: !cats[index][field] }
      ipIntel.ipIntelligenceCategories = cats
      return { ...p, 'ip-intelligence': ipIntel }
    })
    setUnsaved(true)
  }

  // amend=true overwrites the current undeployed draft; false branches a new version.
  // Always pass it explicitly — a bare onClick={saveDraft} would hand us the click event.
  async function saveDraft(amend = false) {
    setSaving(true)
    try {
      // Staging signatures are implied by the policy's signature sets — don't persist them
      // in the `signatures` key (matches how BIG-IP exports). Only enforced/disabled overrides stay.
      const polForSave = {
        ...editedPol,
        signatures: (editedPol.signatures || []).filter(s => !s.performStaging),
      }
      const newContent = { ...policy.content, policy: polForSave }
      // undefined (not '') so the api layer's default change_message still applies.
      const msg = changeMessage.trim() || undefined
      const saved = isGroup
        ? await saveGroupPolicy(templateId, newContent, msg, amend)
        : await savePolicy(id, newContent, msg, amend)
      setPolicy(saved)
      setUnsaved(false)
      setChangeMessage('')
      toast.success(
        amend ? `Updated v${saved.version_num}`
              : isGroup ? `Saved to all devices as v${saved.version_num}`
                        : `Saved as v${saved.version_num}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Derived from editedPol ────────────────────────────────────
  const pol         = editedPol || {}
  // While the parameter modal is open, edits are live but should not surface the
  // "Unsaved changes" indicator until Update is pressed — so reflect the pre-modal
  // snapshot value. On Update/Cancel the snapshot clears and real `unsaved` shows.
  const editModalSnapshot = paramModalSnapshot || ckModalSnapshot || hdrModalSnapshot || urlModalSnapshot
  const showUnsaved = editModalSnapshot ? editModalSnapshot.unsaved : unsaved
  // Server-computed: the current version exists and hasn't been pushed to the device, so
  // this edit may be folded into it. Defaults to branching a new version when false.
  const canAmend = !!policy?.can_amend
  const gen         = pol.general || {}
  const sigSettings = pol['signature-settings'] || {}
  const tcSettings  = pol['threat-campaign-settings'] || {}
  const headers     = pol.headers    || []
  const cookies     = pol.cookies    || []
  const parameters  = pol.parameters || []
  const urls        = pol.urls       || []
  const methods     = pol.methods    || []
  const sigSets     = pol['signature-sets'] || []
  const signatures  = pol.signatures || []
  const evasions    = pol['blocking-settings']?.evasions || []
  const violations  = pol['blocking-settings']?.violations || []
  const httpProtos  = pol['blocking-settings']?.['http-protocols'] || []
  const wsUrls      = pol['websocket-urls'] || []
  const jsonProfs   = pol['json-profiles']  || []
  const xmlProfs    = pol['xml-profiles']   || []
  const graphqlProfs= pol['graphql-profiles'] || []
  const gwtProfs    = pol['gwt-profiles'] || []
  const plainProfs  = pol['plain-text-profiles'] || []
  const serverTechs = pol['server-technologies'] || []
  const ipCats      = pol['ip-intelligence']?.ipIntelligenceCategories || []
  const redirDomains= pol['redirection-protection']?.redirectionDomains || []
  const hostNames   = pol['host-names'] || []

  const filteredViolations = violFilter
    ? violations.filter(v => v.name?.toLowerCase().includes(violFilter.toLowerCase()))
    : violations

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading policy…</div>
  if (error)   return <div className="text-sm text-red-500 py-8 text-center">{error}</div>
  if (!policy || !editedPol) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-xs text-gray-400 mb-1">
            <span className="cursor-pointer hover:text-gray-600" onClick={() => navigate('/policies')}>← All policies</span>
            <span className="mx-1">·</span>
            <span>{policy.name}</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            {isGroup
              ? <h1 className="text-xl font-semibold text-gray-900">{policy.name}</h1>
              : <PolicyTitleSwitcher currentId={id} currentName={policy.name} onSelect={pid => navigate(`/policies/${pid}/edit`)} />}
            {policy.version_num && <Badge color="blue">v{policy.version_num}</Badge>}
            <Badge color={policy.enforcement_mode === 'blocking' ? 'red' : 'yellow'}>
              {policy.enforcement_mode}
            </Badge>
          </div>
          <div className="text-xs text-gray-400">
            {pol.applicationLanguage || '—'} · {policy.device_name}
            {signatures.length > 0 && ` · ${signatures.length} signatures`}
          </div>
        </div>
        {/* Saving lives in the unsaved-changes banner — it's the only place that knows
            which version the edit lands on. */}
        <div className="flex gap-2 flex-shrink-0">
          <Btn onClick={() => navigate(isGroup ? `/policies/group/${templateId}/history` : `/policies/${id}/history`)}>History</Btn>
          <Btn onClick={() => setShowDiff(v => !v)}
            className={showDiff ? 'ring-2 ring-orange-400' : ''}>
            {showDiff ? 'Hide diff' : '± Diff'}
          </Btn>
          {policy.version_num > (policy.deployed_version_num || 0) && (
            <DeploySplit policyId={policy.id} templateId={templateId} isGroup={isGroup}
              current={policy.version_num} deployed={policy.deployed_version_num}
              navigate={navigate} />
          )}
        </div>
      </div>

      {/* Tab bar + content + optional JSON panel */}
      <div className={`flex gap-4 ${showDiff ? 'items-start' : ''}`}>
      <div className={showDiff ? 'flex-1 min-w-0' : 'w-full'}>

      {/* Unsaved banner */}
      {showUnsaved && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-sm">
          <span className="text-amber-800 font-medium flex-shrink-0">Unsaved changes</span>

          {/* Optional reason — saved onto the version, so History/Audit say *why*. */}
          <input
            value={changeMessage}
            onChange={e => setChangeMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !saving) saveDraft(canAmend) }}
            maxLength={200}
            placeholder="Reason for this change (optional)"
            title="Optional — stored with this version and shown in Version history and the audit trail"
            className="flex-1 min-w-0 text-xs border border-amber-200 rounded px-2 py-1 bg-white text-gray-700
              placeholder:text-amber-600/50 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
          />

          <div className="flex gap-2 flex-shrink-0">
            <Btn size="sm" onClick={() => {
              setEditedPol(JSON.parse(JSON.stringify(policy.content?.policy || {})))
              setUnsaved(false)
              setChangeMessage('')
            }}>
              Discard
            </Btn>
            {canAmend
              ? <SaveSplit currentNum={policy.version_num} saving={saving} onSave={saveDraft} />
              : <Btn size="sm" onClick={() => saveDraft(false)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save draft'}
                </Btn>}
          </div>
        </div>
      )}

      {/* ── GENERAL ── */}
      {activeTab === 'general' && (
        <div className="space-y-3">
          {/* Identity */}
          <Card>
            <SectionHeader title="Policy details"
              onClick={() => toggleSection('identity')} collapsed={collapsed.identity} />
            {!collapsed.identity && <>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Input label="Policy name" value={pol.name || policy.name}
                  onChange={e => setTop('name', e.target.value)}
                  readOnly />
                <Input label="Description" value={pol.description || ''}
                  onChange={e => setTop('description', e.target.value)} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Device</label>
                  <div className="flex flex-wrap gap-1 min-h-[34px] items-center">
                    {(policy.template_devices?.length > 0
                      ? policy.template_devices.map(t => t.device_name)
                      : [policy.device_name]
                    ).filter(Boolean).map((d, i) => (
                      <span key={i} className="inline-flex items-center text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">{d}</span>
                    ))}
                  </div>
                </div>
                <Select label="Type" value={pol.type || 'security'}
                  onChange={e => setTop('type', e.target.value)}
                  disabled={!!policy.last_synced_at}>
                  <option value="security">Security</option>
                  <option value="parent">Parent</option>
                </Select>
                <Select label="Enforcement mode" value={pol.enforcementMode || 'transparent'}
                  onChange={e => setTop('enforcementMode', e.target.value)}>
                  <option value="blocking">Blocking</option>
                  <option value="transparent">Transparent</option>
                </Select>
                <Select label="Application language" value={pol.applicationLanguage || 'auto-detect'}
                  onChange={e => setTop('applicationLanguage', e.target.value)}
                  disabled={!!policy.last_synced_at}>
                  {APP_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
              </div>
            </>}
          </Card>

          {/* Advanced */}
          <Card>
            <SectionHeader title="Advanced settings"
              onClick={() => toggleSection('advanced')} collapsed={collapsed.advanced} />
            {!collapsed.advanced && <div className="p-4 space-y-4">
              {/* 2-per-row grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {/* Case Sensitive */}
                <ToggleRow label="Case Sensitive" sub="Store URLs, filetypes, parameters in their original case"
                  on={!pol.caseInsensitive}
                  onClick={policy.last_synced_at ? undefined : () => toggleTop('caseInsensitive')}
                  disabled={!!policy.last_synced_at} />
                {/* Protocol Independent */}
                <ToggleRow label="Protocol Independent" sub="Do not differentiate between HTTP and HTTPS URLs"
                  on={pol.protocolIndependent ?? false}
                  onClick={policy.last_synced_at ? undefined : () => toggleTop('protocolIndependent')}
                  disabled={!!policy.last_synced_at} />
                {/* Event Correlation */}
                <ToggleRow label="Event Correlation Reporting"
                  sub="Aggregate related security events into a single correlated event"
                  on={gen.enableEventCorrelation ?? false}
                  onClick={() => toggleNested('general', 'enableEventCorrelation')} />
                {/* Mask Credit Card */}
                <ToggleRow label="Mask Credit Card Numbers in Request Log"
                  sub="Replace card numbers with asterisks in request logs"
                  on={gen.maskCreditCardNumbersInRequest ?? false}
                  onClick={() => toggleNested('general', 'maskCreditCardNumbersInRequest')} />
              </div>

              {/* Trigger ASM iRule Events Mode + Handle Path Parameters */}
              <div className="grid grid-cols-2 gap-x-8 border-t border-gray-50 pt-3">
                <div className="flex flex-col gap-1.5 items-start">
                  <div className="text-xs font-medium text-gray-700">Trigger ASM iRule Events Mode</div>
                  <SegBtn
                    options={[['Disabled', 'disabled'], ['Normal', 'enabled-normal'], ['Compatibility', 'enabled-compatibility']]}
                    value={gen.triggerAsmIruleEvent || 'disabled'}
                    onChange={val => setNested('general', 'triggerAsmIruleEvent', val)} />
                </div>
                <div className="flex flex-col gap-1.5 items-start">
                  <div className="text-xs font-medium text-gray-700">Handle Path Parameters</div>
                  <SegBtn
                    options={[['As Parameters', 'as-parameters'], ['As URL', 'as-url'], ['Ignore', 'ignore']]}
                    value={gen.pathParameterHandling || 'as-parameters'}
                    onChange={val => setNested('general', 'pathParameterHandling', val)} />
                </div>
              </div>

              {/* Server Technologies */}
              <div className="border-t border-gray-50 pt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Server Technologies</div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select size={1}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none"
                      onChange={e => {
                        const val = e.target.value
                        if (!val) return
                        const existing = serverTechs.map(t => t.serverTechnologyName)
                        if (!existing.includes(val))
                          setTop('server-technologies', [...serverTechs, { serverTechnologyName: val }])
                        e.target.value = ''
                      }}>
                      <option value="">— select a technology to add —</option>
                      {SERVER_TECHNOLOGIES.filter(t => !serverTechs.some(s => s.serverTechnologyName === t)).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {serverTechs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {serverTechs.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                        {t.serverTechnologyName}
                        <button onClick={() => setTop('server-technologies', serverTechs.filter((_, j) => j !== i))}
                          className="hover:text-gray-900 text-gray-400 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Geolocation Enforcement */}
              <div className="border-t border-gray-50 pt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Geolocation Enforcement</div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Allow Access */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1 font-medium">Allow Access</div>
                    <div className="border border-gray-200 rounded-md overflow-y-auto" style={{ height: 160 }}>
                      {COUNTRIES
                        .filter(c => !geoFilter || c.toLowerCase().includes(geoFilter.toLowerCase()))
                        .filter(c => !(pol['geolocation-enforcement']?.disallowedGeolocations || []).some(g => g.countryName === c))
                        .map(c => (
                          <div key={c}
                            className="flex items-center justify-between px-2 py-0.5 hover:bg-gray-50 cursor-pointer group"
                            onClick={() => {
                              const disallowed = pol['geolocation-enforcement']?.disallowedGeolocations || []
                              setTop('geolocation-enforcement', {
                                ...(pol['geolocation-enforcement'] || {}),
                                disallowedGeolocations: [...disallowed, { countryName: c, countryCode: c.slice(0,2).toUpperCase() }],
                              })
                            }}>
                            <span className="text-xs text-gray-700">{c}</span>
                            <span className="text-xs text-gray-300 group-hover:text-gray-500">→</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                  {/* Disallow Access */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1 font-medium">Disallow Access</div>
                    <div className="border border-gray-200 rounded-md overflow-y-auto" style={{ height: 160 }}>
                      {(pol['geolocation-enforcement']?.disallowedGeolocations || [])
                        .filter(g => !geoFilter || g.countryName.toLowerCase().includes(geoFilter.toLowerCase()))
                        .map((g, i) => (
                          <div key={i}
                            className="flex items-center justify-between px-2 py-0.5 hover:bg-red-50 cursor-pointer group"
                            onClick={() => {
                              const disallowed = pol['geolocation-enforcement']?.disallowedGeolocations || []
                              setTop('geolocation-enforcement', {
                                ...(pol['geolocation-enforcement'] || {}),
                                disallowedGeolocations: disallowed.filter((_, j) => j !== i),
                              })
                            }}>
                            <span className="text-xs text-red-600">{g.countryName}</span>
                            <span className="text-xs text-gray-300 group-hover:text-red-400">←</span>
                          </div>
                        ))
                      }
                      {!(pol['geolocation-enforcement']?.disallowedGeolocations?.length) && (
                        <div className="px-2 py-2 text-xs text-gray-300 italic">Click a country to disallow</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-400">Click a country to move it between lists.</div>
                  <input type="text" placeholder="Filter countries…" value={geoFilter}
                    onChange={e => setGeoFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none w-40" />
                </div>
              </div>
            </div>}
          </Card>

          {/* Basic HTTP Message Settings */}
          <Card>
            <SectionHeader title="Basic HTTP Message Settings"
              onClick={() => toggleSection('http-msg')} collapsed={collapsed['http-msg']} />
            {!collapsed['http-msg'] && <div className="divide-y divide-gray-50">
              {/* Max HTTP Header Length */}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Maximum HTTP Header Length</span>
                <div className="flex items-center gap-2">
                  {pol['header-settings']?.maximumHttpHeaderLength !== 'any' && <>
                    <input type="number" min={1} max={65536}
                      value={pol['header-settings']?.maximumHttpHeaderLength ?? 8192}
                      onChange={e => setNested('header-settings', 'maximumHttpHeaderLength', Number(e.target.value))}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none w-20" />
                    <span className="text-xs text-gray-400">bytes</span>
                  </>}
                  <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      className={`w-16 py-1 text-center transition-colors ${pol['header-settings']?.maximumHttpHeaderLength !== 'any' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setNested('header-settings', 'maximumHttpHeaderLength', 8192)}>Length</button>
                    <button
                      className={`w-16 py-1 text-center transition-colors ${pol['header-settings']?.maximumHttpHeaderLength === 'any' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setNested('header-settings', 'maximumHttpHeaderLength', 'any')}>Any</button>
                  </div>
                </div>
              </div>
              {/* Max Cookie Header Length */}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Maximum Cookie Header Length</span>
                <div className="flex items-center gap-2">
                  {pol['cookie-settings']?.maximumCookieHeaderLength !== 'any' && <>
                    <input type="number" min={1} max={65536}
                      value={pol['cookie-settings']?.maximumCookieHeaderLength ?? 8192}
                      onChange={e => setNested('cookie-settings', 'maximumCookieHeaderLength', Number(e.target.value))}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none w-20" />
                    <span className="text-xs text-gray-400">bytes</span>
                  </>}
                  <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                    <button
                      className={`w-16 py-1 text-center transition-colors ${pol['cookie-settings']?.maximumCookieHeaderLength !== 'any' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setNested('cookie-settings', 'maximumCookieHeaderLength', 8192)}>Length</button>
                    <button
                      className={`w-16 py-1 text-center transition-colors ${pol['cookie-settings']?.maximumCookieHeaderLength === 'any' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setNested('cookie-settings', 'maximumCookieHeaderLength', 'any')}>Any</button>
                  </div>
                </div>
              </div>
              {/* Allowed Response Status Codes */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Allowed Response Status Codes</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={100} max={999} placeholder="e.g. 404"
                      value={newStatusCode}
                      onChange={e => setNewStatusCode(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const code = parseInt(newStatusCode)
                          if (!isNaN(code) && code >= 100 && code <= 999) {
                            const existing = gen.allowedResponseCodes || []
                            if (!existing.includes(code)) setNested('general', 'allowedResponseCodes', [...existing, code].sort((a,b)=>a-b))
                            setNewStatusCode('')
                          }
                        }
                      }}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none w-24" />
                    <button
                      onClick={() => {
                        const code = parseInt(newStatusCode)
                        if (!isNaN(code) && code >= 100 && code <= 999) {
                          const existing = gen.allowedResponseCodes || []
                          if (!existing.includes(code)) setNested('general', 'allowedResponseCodes', [...existing, code].sort((a,b)=>a-b))
                          setNewStatusCode('')
                        }
                      }}
                      className="text-xs border border-gray-900 rounded-md px-2.5 py-1 bg-gray-900 hover:bg-gray-700 text-white">Add</button>
                  </div>
                </div>
                {(gen.allowedResponseCodes?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {gen.allowedResponseCodes.map(code => (
                      <span key={code} className="inline-flex items-center gap-1 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                        {code}
                        <button onClick={() => setNested('general', 'allowedResponseCodes', gen.allowedResponseCodes.filter(c => c !== code))}
                          className="hover:text-blue-200 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-blue-500 mt-1">ⓘ Note: Response codes 200 through 399 are automatically allowed by the system</div>
              </div>
              {/* Trust XFF Header */}
              <div className="px-4 py-3">
                <ToggleRow label="Trust X-Forwarded-For" sub="Trust XFF header — use only behind a trusted proxy"
                  on={gen.trustXff ?? false}
                  onClick={() => toggleNested('general', 'trustXff')}
                  labelClass="text-sm font-medium text-gray-700" />
              </div>
              {/* Custom XFF Headers — only when Trust XFF is enabled */}
              {gen.trustXff && <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Custom XFF Headers</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text" placeholder="Header name"
                      style={{ width: '180px' }}
                      value={newXffHeader}
                      onChange={e => setNewXffHeader(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newXffHeader.trim()) {
                          const existing = gen.customXffHeaders || []
                          if (!existing.includes(newXffHeader.trim())) setNested('general', 'customXffHeaders', [...existing, newXffHeader.trim()])
                          setNewXffHeader('')
                        }
                      }}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none w-36" />
                    <button
                      onClick={() => {
                        if (newXffHeader.trim()) {
                          const existing = gen.customXffHeaders || []
                          if (!existing.includes(newXffHeader.trim())) setNested('general', 'customXffHeaders', [...existing, newXffHeader.trim()])
                          setNewXffHeader('')
                        }
                      }}
                      className="text-xs border border-gray-900 rounded-md px-2.5 py-1 bg-gray-900 hover:bg-gray-700 text-white">Add</button>
                  </div>
                </div>
                {(gen.customXffHeaders?.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {gen.customXffHeaders.map((h, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                        {h}
                        <button onClick={() => setNested('general', 'customXffHeaders', gen.customXffHeaders.filter((_, j) => j !== i))}
                          className="hover:text-blue-200 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>}
            </div>}
          </Card>

          {/* Integrated Services */}
          <Card>
            <SectionHeader title="Integrated Services"
              onClick={() => toggleSection('antivirus')} collapsed={collapsed.antivirus} />
            {!collapsed.antivirus && <div className="px-4 py-4">
              <div className="flex gap-8">
                <span className="text-xs font-medium text-gray-700 w-36 flex-shrink-0 pt-0.5">Anti-Virus Protection</span>
                <div className="flex-1 space-y-2">
                  {/* Scan HTTP Uploads checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={pol.antivirus?.inspectHttpUploads ?? false}
                      onChange={() => toggleNested('antivirus', 'inspectHttpUploads')}
                      className="rounded border-gray-300" />
                    <span className="text-xs text-blue-600 font-medium">Scan HTTP Uploads</span>
                  </label>

                  {/* Scan SOAP Attachments */}
                  <div className="text-xs text-gray-600">Scan SOAP Attachments on the following XML Profiles:</div>
                  <div className="flex items-center gap-1">
                    <select
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none w-64 text-gray-400 italic"
                      onChange={e => {
                        const val = e.target.value
                        if (!val) return
                        const existing = pol.antivirus?.xmlProfiles || []
                        if (!existing.includes(val))
                          setNested('antivirus', 'xmlProfiles', [...existing, val])
                        e.target.value = ''
                      }}>
                      <option value="">Specify one or few XML profiles</option>
                      {xmlProfs
                        .filter(p => !(pol.antivirus?.xmlProfiles || []).includes(p.name))
                        .map(p => <option key={p.name} value={p.name}>{p.name}</option>)
                      }
                      {xmlProfs.length === 0 && (
                        <option disabled>No XML profiles defined in this policy</option>
                      )}
                    </select>
                  </div>
                  {(pol.antivirus?.xmlProfiles?.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {pol.antivirus.xmlProfiles.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {p}
                          <button onClick={() => setNested('antivirus', 'xmlProfiles', pol.antivirus.xmlProfiles.filter((_, j) => j !== i))}
                            className="hover:text-gray-900 text-gray-400 leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Warning */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    To use this option, first set up your Anti-Virus Protection Server on your BIGIP.
                  </div>
                </div>
              </div>
            </div>}
          </Card>
        </div>
      )}

      {/* ── SIGNATURES ── */}
      {activeTab === 'signatures' && (
        <div className="space-y-3">
          <Card>
            <SectionHeader title="Signature settings"
              onClick={() => toggleSection('sig-settings')} collapsed={collapsed['sig-settings']} />
            {!collapsed['sig-settings'] && <>
              <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-gray-50">
                <Select label="False positive mode" value={sigSettings.attackSignatureFalsePositiveMode || 'disabled'}
                  onChange={e => setNested('signature-settings', 'attackSignatureFalsePositiveMode', e.target.value)}>
                  <option value="disabled">Disabled</option>
                  <option value="detect">Detect</option>
                  <option value="detect-and-allow">Detect and allow</option>
                </Select>
                <Select label="Min accuracy for auto-add" value={sigSettings.minimumAccuracyForAutoAddedSignatures || 'medium'}
                  onChange={e => setNested('signature-settings', 'minimumAccuracyForAutoAddedSignatures', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
              <div className="px-4 py-2 space-y-0">
                <ToggleRow label="Signature staging" sub="New signatures start in staging mode"
                  on={sigSettings.signatureStaging ?? false}
                  onClick={() => {
                    const newVal = !(sigSettings.signatureStaging ?? false)
                    // When staging is turned off, reset placeSignaturesInStaging to its original (loaded) value
                    const orig = policy?.content?.policy?.['signature-settings']?.placeSignaturesInStaging ?? false
                    setEditedPol(p => {
                      const ss = { ...(p['signature-settings'] || {}), signatureStaging: newVal }
                      if (!newVal) ss.placeSignaturesInStaging = orig
                      return { ...p, 'signature-settings': ss }
                    })
                    setUnsaved(true)
                  }} />
                {(() => {
                  const stagingOn = sigSettings.signatureStaging ?? false
                  return (
                    <div className="flex items-center justify-between py-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-800">Updated Signature Enforcement</div>
                        <div className="text-xs text-gray-400">
                          How updated signature rules are applied{!stagingOn && ' — enable Signature staging to change'}
                        </div>
                      </div>
                      <select
                        value={(sigSettings.placeSignaturesInStaging ?? false) ? 'true' : 'false'}
                        disabled={!stagingOn}
                        onChange={e => setNested('signature-settings', 'placeSignaturesInStaging', e.target.value === 'true')}
                        className={`text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-[422px] max-w-full ${!stagingOn ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                        <option value="false">Enforce updated rule immediately for non-staged signatures</option>
                        <option value="true">Retain previous rule enforcement and place updated rule in staging</option>
                      </select>
                    </div>
                  )
                })()}
              </div>
            </>}
          </Card>

          <Card>
            <SectionHeader title="Threat campaign settings"
              onClick={() => toggleSection('tc-settings')} collapsed={collapsed['tc-settings']} />
            {!collapsed['tc-settings'] && (() => {
              const polTCs = pol['threat-campaigns'] || []
              const polTCMap = Object.fromEntries(polTCs.map(t => [t.name, t]))
              const tcSource = deviceTCs.length > 0 ? deviceTCs : polTCs
              // Distinct attack types present (for the Attack Type filter)
              const tcAttackTypes = [...new Set(tcSource.map(tc => tc.attackType).filter(Boolean))].sort()
              const tcFiltered = tcSource.filter(tc => {
                const name = (tc.displayName || tc.name).toLowerCase()
                const matchSearch = !tcSearch || name.includes(tcSearch.toLowerCase()) || (tc.attackType || '').toLowerCase().includes(tcSearch.toLowerCase())
                const st = tcStatus(tc.name)
                const matchStatus = tcFilters.status === 'all' || st === tcFilters.status
                const matchRisk = tcFilters.risk === 'all' || (tc.risk || '').toLowerCase() === tcFilters.risk
                const matchAttackType = tcFilters.attackType === 'all' || (tc.attackType || '') === tcFilters.attackType
                return matchSearch && matchStatus && matchRisk && matchAttackType
              })
              const tcKey = (tc) => {
                switch (tcSortCol) {
                  case 'name': return (tc.displayName || tc.name || '').toLowerCase()
                  case 'attackType': return (tc.attackType || '').toLowerCase()
                  case 'status': return tcStatus(tc.name)
                  case 'updated': return tc.lastUpdated || ''
                  default: return ''
                }
              }
              const tcRows = tcSortCol
                ? [...tcFiltered].sort((a, b) => { const av = tcKey(a), bv = tcKey(b), dir = tcSortDir === 'desc' ? -1 : 1; return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
                : tcFiltered
              const tcTotalPages = Math.max(1, Math.ceil(tcRows.length / tcPageSize))
              const tcPageNum = Math.min(tcPage, tcTotalPages)
              const tcPageRows = tcRows.slice((tcPageNum - 1) * tcPageSize, tcPageNum * tcPageSize)
              const TC_SORT_COLS = [['name', 'Threat Campaign Name', 'text-left'], ['attackType', 'Attack Type', 'text-left'], ['status', 'Status', 'text-left'], ['updated', 'Last Updated', 'text-right']]

              function tcStatus(name) {
                const override = polTCMap[name]
                if (!override) return 'Enforced'
                if (override.isEnabled === false) return 'Disabled'
                return 'Enforced'
              }
              function tcStatusColor(st) {
                if (st === 'Disabled') return 'text-red-500'
                return 'text-green-700'
              }
              function riskColor(r) {
                if (!r) return 'text-gray-400'
                if (r.toLowerCase() === 'high') return 'text-red-600'
                if (r.toLowerCase() === 'medium') return 'text-yellow-600'
                return 'text-green-600'
              }

              const applyTC = (names, action) => {
                setEditedPol(prev => {
                  const nameSet = new Set(names)
                  const existing = (prev['threat-campaigns'] || []).filter(t => !nameSet.has(t.name))
                  if (action === 'Enforced') return { ...prev, 'threat-campaigns': existing }
                  return { ...prev, 'threat-campaigns': [...existing, ...[...nameSet].map(n => ({ name: n, isEnabled: false }))] }
                })
                setUnsaved(true)
                setTcActionOpen(null)
              }

              return <div onClick={() => tcActionOpen && setTcActionOpen(null)}>
                <div className="px-4 py-3 space-y-0 border-b border-gray-50">
                  <ToggleRow label="Threat campaign staging" sub="New threat campaigns start in staging"
                    on={tcSettings.threatCampaignStaging ?? false}
                    onClick={() => toggleNested('threat-campaign-settings', 'threatCampaignStaging')} />
                </div>
                <div className="px-4 py-3 border-b border-gray-100">
                  <label className="text-xs font-medium text-gray-500">Enforcement readiness period (days)</label>
                  <input type="number" min={0} max={999}
                    value={tcSettings.threatCampaignEnforcementReadinessPeriod ?? 7}
                    onChange={e => setNested('threat-campaign-settings', 'threatCampaignEnforcementReadinessPeriod', Number(e.target.value))}
                    className="mt-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none w-24" />
                </div>

                {/* Summary + split buttons */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span><strong className="text-gray-800">{tcSource.filter(tc => !polTCMap[tc.name] || polTCMap[tc.name].isEnabled !== false).length}</strong> TC enforced</span>
                    <span><strong className="text-gray-800">{tcSource.filter(tc => polTCMap[tc.name]?.isEnabled === false).length}</strong> TC disabled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTCs.size > 0 && (
                      <span className="text-xs text-blue-600 font-medium">{selectedTCs.size} selected</span>
                    )}
                    {[
                      { label: 'Enforce', action: 'Enforced' },
                      { label: 'Disable', action: 'Disabled' },
                    ].map(({ label, action }) => {
                      const isOpen = tcActionOpen === label
                      return (
                        <div key={label} className="relative flex">
                          <button
                            className="text-xs px-2.5 py-1 rounded-l border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium border-r-0"
                            onClick={() => applyTC(selectedTCs.size > 0 ? [...selectedTCs] : tcFiltered.map(tc => tc.name), action)}>
                            {label}
                          </button>
                          <button
                            className="text-xs px-1.5 py-1 rounded-r border border-gray-300 bg-white hover:bg-gray-50 text-gray-500"
                            onClick={e => { e.stopPropagation(); setTcActionOpen(isOpen ? null : label) }}>
                            ▾
                          </button>
                          {isOpen && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-lg min-w-36 text-xs">
                              <button className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                onClick={() => applyTC(tcFiltered.map(tc => tc.name), action)}>
                                Apply to all ({tcFiltered.length})
                              </button>
                              <button
                                disabled={selectedTCs.size === 0}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => applyTC([...selectedTCs], action)}>
                                Apply to selected ({selectedTCs.size})
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Filters */}
                {(() => {
                  const setF = (k, v) => { setTcFilters(p => ({ ...p, [k]: v })); setTcPage(1) }
                  const active = Object.values(tcFilters).some(v => v !== 'all')
                  const Sel = ({ label, k, opts }) => (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-xs">{label}</span>
                      <select value={tcFilters[k]} onChange={e => setF(k, e.target.value)}
                        className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300 ${tcFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                        <option value="all">All</option>
                        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  )
                  return (
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
                      <Sel label="Status" k="status" opts={[['Enforced','Enforced'],['Disabled','Disabled']]} />
                      <Sel label="Risk"   k="risk"   opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                      <Sel label="Attack Type" k="attackType" opts={tcAttackTypes.map(t => [t, t])} />
                      {active && (
                        <button onClick={() => { setTcFilters({ status: 'all', risk: 'all', attackType: 'all' }); setTcPage(1) }}
                          className="text-xs text-blue-600 hover:underline ml-auto">
                          Clear filters
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Search */}
                <div className="flex items-center px-4 py-2 border-b border-gray-100">
                  <input
                    placeholder="Search name or attack type…"
                    value={tcSearch}
                    onChange={e => { setTcSearch(e.target.value); setTcPage(1) }}
                    className="text-xs border border-gray-200 rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>

                {/* Table */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left">
                      <th className="w-8 px-3 py-2">
                        <input type="checkbox"
                          checked={tcPageRows.length > 0 && tcPageRows.every(tc => selectedTCs.has(tc.name))}
                          onChange={e => {
                            setSelectedTCs(prev => {
                              const next = new Set(prev)
                              tcPageRows.forEach(tc => e.target.checked ? next.add(tc.name) : next.delete(tc.name))
                              return next
                            })
                          }} />
                      </th>
                      <th className="w-6 px-1 py-2"></th>
                      {TC_SORT_COLS.map(([col, label, align]) => (
                        <th key={col} onClick={() => sortTcBy(col)}
                          className={`px-3 py-2 ${align} font-semibold text-gray-700 cursor-pointer select-none hover:text-gray-900 group ${col === 'attackType' ? 'w-48' : col === 'status' || col === 'updated' ? 'w-28' : ''}`}>
                          <span className={`inline-flex items-center gap-1 ${align === 'text-right' ? 'justify-end' : ''}`}>
                            {label}
                            {tcSortCol === col
                              ? <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tcSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                              : <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tcPageRows.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        {deviceTCs.length === 0 ? 'No threat campaigns synced yet. Sync from the device page.' : 'No threat campaigns match your search.'}
                      </td></tr>
                    )}
                    {tcPageRows.map(tc => {
                      const isExp = expandedTC === tc.name
                      const st = tcStatus(tc.name)
                      const displayName = tc.displayName || tc.name
                      const isSel = selectedTCs.has(tc.name)
                      return [
                        <tr key={tc.name} className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer ${isExp ? 'bg-blue-50' : isSel ? 'bg-blue-50/50' : ''}`}
                          onClick={() => setExpandedTC(isExp ? null : tc.name)}>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSel}
                              onChange={e => setSelectedTCs(prev => {
                                const next = new Set(prev)
                                e.target.checked ? next.add(tc.name) : next.delete(tc.name)
                                return next
                              })} />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button className="w-4 h-4 rounded-sm bg-blue-500 text-white flex items-center justify-center text-xs font-bold leading-none">
                              {isExp ? '▾' : '▸'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-gray-800 font-medium">{displayName}</td>
                          <td className="px-3 py-2 text-blue-600">{tc.attackType || '—'}</td>
                          <td className={`px-3 py-2 font-medium ${tcStatusColor(st)}`}>{st}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{tc.lastUpdated || '—'}</td>
                        </tr>,
                        isExp && (
                          <tr key={tc.name + '-detail'} className="border-b border-gray-200 bg-blue-50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="text-sm font-semibold text-gray-800 mb-3">{displayName}</div>
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5 text-xs text-gray-700">
                                  <div><strong>Attack Type:</strong> <span className="text-blue-600">{tc.attackType || '—'}</span></div>
                                  <div><strong>Intent:</strong> {tc.intent || '—'}</div>
                                  <div><strong>Systems:</strong> {(tc.systems || []).join(', ') || '—'}</div>
                                  <div><strong>Risk:</strong> <span className={`font-medium ${riskColor(tc.risk)}`}>{tc.risk || '—'}</span></div>
                                  <div><strong>First Observed:</strong> {tc.firstObserved || '—'}</div>
                                  <div><strong>Last Updated:</strong> {tc.lastUpdated || '—'}</div>
                                  {(tc.malware || []).length > 0 && (
                                    <div>
                                      <strong>Malware:</strong>
                                      <ul className="mt-0.5 ml-3 list-disc space-y-0.5">
                                        {tc.malware.map((m, i) => (
                                          <li key={i}>
                                            {typeof m === 'object'
                                              ? [m.family, m.type, m.targetSystem].filter(Boolean).join(' · ')
                                              : m}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {tc.status && <div><strong>TC Status:</strong> <span className="font-medium capitalize text-blue-700">{tc.status}</span></div>}
                                  {(tc.references || []).length > 0 && (
                                    <div><strong>References:</strong>{' '}
                                      {tc.references.map((ref, i) => (
                                        <span key={i}>
                                          {i > 0 && ', '}
                                          <a href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${ref}`} target="_blank" rel="noreferrer"
                                            className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                                            {ref}
                                          </a>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {tc.description && (
                                  <div className="text-xs text-gray-700">
                                    <strong>Description:</strong>
                                    <p className="mt-1 text-gray-600 leading-relaxed">{tc.description}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      ]
                    })}
                  </tbody>
                </table>
                {/* Pagination — DeviceFleet style */}
                {tcRows.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {[10, 20, 50].map((size, idx) => (
                        <span key={size} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <button onClick={() => { setTcPageSize(size); setTcPage(1) }}
                            className={`px-1 py-0.5 rounded transition-colors ${tcPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                            {size}
                          </button>
                        </span>
                      ))}
                      
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>Page {tcPageNum} of {tcTotalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setTcPage(p => Math.max(1, p - 1))} disabled={tcPageNum <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => setTcPage(p => Math.min(tcTotalPages, p + 1))} disabled={tcPageNum >= tcTotalPages}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            })()}
          </Card>

          <Card>
            <SectionHeader
              title="Signature sets"
              sub={`${sigSets.length} set${sigSets.length !== 1 ? 's' : ''} configured`}
              onClick={() => toggleSection('sig-sets')}
              collapsed={collapsed['sig-sets']}
            />
            {!collapsed['sig-sets'] && (() => {
              const availableToAdd = deviceSigSets
                .filter(ds => !sigSets.some(s => s.name === ds.name))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              // Build a lookup from device sig sets for detail info
              const sigSetInfo = Object.fromEntries(deviceSigSets.map(ds => [ds.name, ds]))

              // Recalculate pol.signatures when sets change:
              // - Union of all remaining sets' memberIds determines which signatures stay
              // - User overrides (non-default fields) are always preserved
              // - New signatures added with defaults; removed only if no remaining set covers them
              function recalcSignatures(newSets, currentSigs) {
                const unionIds = new Set(
                  newSets.flatMap(s => sigSetInfo[s.name]?.memberIds || [])
                )
                // Build a map of existing per-signature customisations so they survive the recalc
                const existingMap = Object.fromEntries(
                  (currentSigs || []).map(s => [String(s.signatureId), s])
                )
                const result = []
                for (const sid of unionIds) {
                  // New members enter in staging; an existing enforced/disabled override takes precedence
                  result.push(existingMap[sid] ?? { signatureId: sid, enabled: true, performStaging: true, alarm: true, block: true, learn: true })
                }
                return result
              }

              // Membership: set name -> Set of signature ids it contains
              const setMembers = Object.fromEntries(
                deviceSigSets.map(ds => [ds.name, new Set((ds.memberIds || []).map(String))])
              )
              // A signature's alarm/block/learn is the OR across every set it belongs to:
              // it stays on if ANY containing set has the flag on; it's only off when ALL
              // its sets have it off. Recomputed whenever a set's flags change.
              function recalcSigFlags(sets, currentSigs) {
                return (currentSigs || []).map(sig => {
                  const sid = String(sig.signatureId)
                  let alarm = false, block = false, learn = false, inAny = false
                  for (const set of sets) {
                    if (setMembers[set.name]?.has(sid)) {
                      inAny = true
                      if (set.alarm ?? true) alarm = true
                      if (set.block ?? true) block = true
                      if (set.learn ?? false) learn = true
                    }
                  }
                  return inAny ? { ...sig, alarm, block, learn } : sig
                })
              }
              function toggleSetFlag(i, field, def) {
                const newSets = sigSets.map((s, j) => j === i ? { ...s, [field]: !(s[field] ?? def) } : s)
                setEditedPol(p => ({ ...p, 'signature-sets': newSets, 'signatures': recalcSigFlags(newSets, p.signatures) }))
                setUnsaved(true)
              }

              function addSet(name) {
                const newSets = [...sigSets, { name, alarm: true, block: true, learn: true }]
                // Update both keys in a single state transition to avoid ordering issues
                setEditedPol(p => ({
                  ...p,
                  'signature-sets': newSets,
                  'signatures': sigSetInfo[name]?.memberIds?.length
                    ? recalcSignatures(newSets, p.signatures)
                    : p.signatures,
                }))
                setUnsaved(true)
              }

              function removeSet(i) {
                const removedName = sigSets[i]?.name
                const newSets = sigSets.filter((_, j) => j !== i)
                setEditedPol(p => ({
                  ...p,
                  'signature-sets': newSets,
                  'signatures': deviceSigSets.length > 0
                    ? recalcSignatures(newSets, p.signatures)
                    : p.signatures,
                }))
                setUnsaved(true)
                if (expandedSigSet === removedName) setExpandedSigSet(null)
              }

              return <>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="w-6 px-1 py-2" />
                      <th className="text-left px-4 py-2 font-medium text-gray-500">Name</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-center w-16">Learn</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-center w-16">Alarm</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-center w-16">Block</th>
                      <th className="px-4 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sigSets.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-center text-gray-400">
                          No signature sets configured. Add one below.
                        </td>
                      </tr>
                    )}
                    {sigSets.map((s, i) => {
                      const isExpanded = expandedSigSet === s.name
                      const info = sigSetInfo[s.name]
                      return [
                        <tr key={s.name} className={`border-b border-gray-50 hover:bg-blue-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => setExpandedSigSet(isExpanded ? null : s.name)}
                              className="w-4 h-4 rounded-sm bg-blue-500 text-white flex items-center justify-center text-xs font-bold leading-none"
                            >
                              {isExpanded ? '▾' : '▸'}
                            </button>
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-2 text-center">
                            <Toggle on={s.learn ?? false} onClick={() => toggleSetFlag(i, 'learn', false)} />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Toggle on={s.alarm ?? true} onClick={() => toggleSetFlag(i, 'alarm', true)} />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Toggle on={s.block ?? true} onClick={() => toggleSetFlag(i, 'block', true)} />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => removeSet(i)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Remove"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>,
                        isExpanded && (
                          <tr key={s.name + '-detail'} className="border-b border-gray-100 bg-blue-50">
                            <td colSpan={6} className="px-6 py-4">
                              {info ? (
                                <div className="space-y-4 text-xs text-gray-700">
                                  {/* Top: general info + active settings */}
                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                      <div className="font-semibold text-gray-600 mb-1">General</div>
                                      <div><span className="text-gray-500 w-32 inline-block">Type</span><span className="font-medium">{info.type || '—'}</span></div>
                                      <div><span className="text-gray-500 w-32 inline-block">Category</span><span className="font-medium">{info.category || '—'}</span></div>
                                      <div><span className="text-gray-500 w-32 inline-block">Signatures</span><span className="font-medium">{info.signatureCount != null ? info.signatureCount.toLocaleString() : '—'}</span></div>
                                      <div><span className="text-gray-500 w-32 inline-block">Last synced</span><span className="font-medium">{info.syncedAt ? new Date(info.syncedAt).toLocaleString() : '—'}</span></div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <div className="font-semibold text-gray-600 mb-1">Active settings</div>
                                      <div><span className="text-gray-500 w-32 inline-block">Alarm</span><span className={`font-medium ${(s.alarm ?? true) ? 'text-green-600' : 'text-gray-400'}`}>{(s.alarm ?? true) ? 'Enabled' : 'Disabled'}</span></div>
                                      <div><span className="text-gray-500 w-32 inline-block">Block</span><span className={`font-medium ${(s.block ?? true) ? 'text-green-600' : 'text-gray-400'}`}>{(s.block ?? true) ? 'Enabled' : 'Disabled'}</span></div>
                                      <div><span className="text-gray-500 w-32 inline-block">Learn</span><span className={`font-medium ${(s.learn ?? false) ? 'text-green-600' : 'text-gray-400'}`}>{(s.learn ?? false) ? 'Enabled' : 'Disabled'}</span></div>
                                    </div>
                                  </div>

                                  {/* Filter definition */}
                                  {info.filter && Object.keys(info.filter).length > 0 && (() => {
                                    const f = info.filter
                                    const rows = [
                                      f.attackType?.name        && ['Attack type',   f.attackType.name],
                                      f.systems?.length         && ['Systems',        f.systems.map(sys => sys.name || sys).join(', ')],
                                      f.accuracyFilter          && ['Accuracy',       f.accuracyFilter],
                                      f.riskFilter              && ['Risk',           f.riskFilter],
                                      f.hasCve != null          && ['Has CVE',        f.hasCve ? 'Yes' : 'No'],
                                      f.userDefined != null     && ['User-defined',   f.userDefined ? 'Yes' : 'No'],
                                      f.signatureType           && ['Signature type', f.signatureType],
                                      f.minAccuracy             && ['Min accuracy',   f.minAccuracy],
                                    ].filter(Boolean)

                                    if (!rows.length) return null
                                    return (
                                      <div>
                                        <div className="font-semibold text-gray-600 mb-2 pt-2 border-t border-gray-200">Filter</div>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                          {rows.map(([label, val]) => (
                                            <div key={label}>
                                              <span className="text-gray-500 w-32 inline-block">{label}</span>
                                              <span className="font-medium capitalize">{String(val)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">
                                  No detail available — sync signature sets from the device page to see more information.
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      ]
                    })}
                  </tbody>
                </table>

                {/* Add signature set row */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <select
                    className="w-1/2 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                    value=""
                    onChange={e => {
                      const name = e.target.value
                      if (!name) return
                      addSet(name)
                    }}
                  >
                    <option value="">
                      {availableToAdd.length > 0
                        ? `Add signature set… (${availableToAdd.length} available)`
                        : deviceSigSets.length === 0
                          ? 'Sync signature sets from device first'
                          : 'All signature sets already added'}
                    </option>
                    {availableToAdd.map(ds => (
                      <option key={ds.name} value={ds.name}>{ds.name}</option>
                    ))}
                  </select>
                </div>
              </>
            })()}
          </Card>

          <Card>
            {(() => {
              // Device cache lookup by signatureId for enrichment
              const deviceSigMap = Object.fromEntries(deviceSigs.map(s => [String(s.signatureId), s]))

              // Rows = only signatures in the policy JSON, enriched with device cache info
              const allRows = signatures.map(s => {
                const sid = String(s.signatureId ?? '')
                const cached = deviceSigMap[sid] || {}
                return {
                  signatureId: s.signatureId,
                  name: cached.name ?? s.name ?? sid,
                  description: cached.description ?? s.description,
                  accuracy: cached.accuracy ?? s.accuracy,
                  risk: cached.risk ?? s.risk,
                  hasCve: cached.hasCve ?? s.hasCve,
                  systems: cached.systems ?? s.systems,
                  // overlay the policy override fields
                  enabled: s.enabled,
                  performStaging: s.performStaging,
                  alarm: s.alarm,
                  block: s.block,
                  learn: s.learn,
                }
              })

              const filtered = allRows.filter(s => {
                if (sigSearch && !String(s.signatureId).includes(sigSearch) && !(s.name || '').toLowerCase().includes(sigSearch.toLowerCase())) return false
                const st = s.enabled === false ? 'Disabled' : s.performStaging ? 'Staging' : 'Enforced'
                if (sigFilters.status   !== 'all' && st !== sigFilters.status)                       return false
                if (sigFilters.learn    !== 'all' && Boolean(s.learn)         !== (sigFilters.learn    === 'on')) return false
                if (sigFilters.alarm    !== 'all' && (s.alarm  ?? true)  !== (sigFilters.alarm    === 'on')) return false
                if (sigFilters.block    !== 'all' && (s.block  ?? true)  !== (sigFilters.block    === 'on')) return false
                if (sigFilters.accuracy !== 'all' && s.accuracy !== sigFilters.accuracy)             return false
                if (sigFilters.risk     !== 'all' && s.risk     !== sigFilters.risk)                 return false
                if (sigFilters.cve      !== 'all' && Boolean(s.hasCve)       !== (sigFilters.cve      === 'yes')) return false
                return true
              })

              const sigKey = (s) => {
                switch (sigSortCol) {
                  case 'name': return (s.name || String(s.signatureId) || '').toLowerCase()
                  case 'id': return Number(s.signatureId) || 0
                  case 'learn': return s.learn ? 1 : 0
                  case 'alarm': return (s.alarm ?? true) ? 1 : 0
                  case 'block': return (s.block ?? true) ? 1 : 0
                  case 'status': return s.enabled === false ? 0 : s.performStaging ? 1 : 2
                  default: return ''
                }
              }
              const sorted = sigSortCol
                ? [...filtered].sort((a, b) => { const av = sigKey(a), bv = sigKey(b), dir = sigSortDir === 'desc' ? -1 : 1; return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
                : filtered
              const totalPages = Math.max(1, Math.ceil(sorted.length / sigPageSize))
              const page = Math.min(sigPage, totalPages)
              const pageRows = sorted.slice((page - 1) * sigPageSize, page * sigPageSize)

              function sigStatus(row) {
                if (row.enabled === false) return 'Disabled'
                if (row.performStaging) return 'Staging'
                return 'Enforced'
              }
              function statusColor(st) {
                if (st === 'Disabled') return 'text-red-500'
                if (st === 'Staging') return 'text-yellow-600'
                return 'text-green-700'
              }

              const Check = ({ on }) => on !== false
                ? <svg className="w-4 h-4 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                : <span className="text-gray-300 text-xs mx-auto block text-center">—</span>

              return <div onClick={() => sigActionOpen && setSigActionOpen(null)}>
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span><strong className="text-gray-800">{signatures.filter(s => s.enabled !== false && !s.performStaging).length}</strong> ready to be enforced</span>
                    <span><strong className="text-gray-800">{signatures.filter(s => s.performStaging).length}</strong> staged</span>
                    <span><strong className="text-gray-800">{signatures.filter(s => s.enabled === false).length}</strong> disabled</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {selectedSigs.size > 0 && (
                      <span className="text-xs text-blue-600 font-medium">{selectedSigs.size} selected</span>
                    )}
                    {/* Row 2 (below): Learn / Alarm / Block — bulk on/off for selected-or-all */}
                    <div className="order-2 flex items-center gap-2 flex-wrap justify-end">
                    {[
                      { label: 'Learn', field: 'learn' },
                      { label: 'Alarm', field: 'alarm' },
                      { label: 'Block', field: 'block' },
                    ].map(({ label, field }) => {
                      const isOpen = sigActionOpen === label
                      const applyFlag = (ids, value) => {
                        const idSet = new Set(ids.map(String))
                        setTop('signatures', signatures.map(s => idSet.has(String(s.signatureId)) ? { ...s, [field]: value } : s))
                        setUnsaved(true)
                        setSigActionOpen(null)
                      }
                      const targetIds = selectedSigs.size > 0 ? [...selectedSigs] : filtered.map(s => s.signatureId)
                      return (
                        <div key={label} className="relative flex">
                          <button
                            className="text-xs px-2.5 py-1 rounded-l border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium border-r-0"
                            onClick={() => applyFlag(targetIds, true)}>
                            {label}
                          </button>
                          <button
                            className="text-xs px-1.5 py-1 rounded-r border border-gray-300 bg-white hover:bg-gray-50 text-gray-500"
                            onClick={() => setSigActionOpen(isOpen ? null : label)}>
                            ▾
                          </button>
                          {isOpen && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-lg min-w-44 text-xs">
                              <button className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                onClick={() => applyFlag(filtered.map(s => s.signatureId), true)}>Turn ON — all ({filtered.length})</button>
                              <button disabled={selectedSigs.size === 0}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => applyFlag([...selectedSigs], true)}>Turn ON — selected ({selectedSigs.size})</button>
                              <div className="border-t border-gray-100" />
                              <button className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                onClick={() => applyFlag(filtered.map(s => s.signatureId), false)}>Turn OFF — all ({filtered.length})</button>
                              <button disabled={selectedSigs.size === 0}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => applyFlag([...selectedSigs], false)}>Turn OFF — selected ({selectedSigs.size})</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </div>
                    {/* Row 1 (top): Enforce / Stage / Disable */}
                    <div className="order-1 flex items-center gap-2 flex-wrap justify-end">
                    {[
                      { label: 'Enforce', patch: { enabled: true,  performStaging: false } },
                      { label: 'Stage',   patch: { performStaging: true, enabled: true  } },
                      { label: 'Disable', patch: { enabled: false, performStaging: false } },
                    ].map(({ label, patch }) => {
                      const isOpen = sigActionOpen === label
                      const apply = (ids) => {
                        const idSet = new Set(ids.map(String))
                        setTop('signatures', signatures.map(s => idSet.has(String(s.signatureId)) ? { ...s, ...patch } : s))
                        setUnsaved(true)
                        setSigActionOpen(null)
                      }
                      return (
                        <div key={label} className="relative flex">
                          <button
                            className="text-xs px-2.5 py-1 rounded-l border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium border-r-0"
                            onClick={() => apply(selectedSigs.size > 0 ? [...selectedSigs] : filtered.map(s => s.signatureId))}>
                            {label}
                          </button>
                          <button
                            className="text-xs px-1.5 py-1 rounded-r border border-gray-300 bg-white hover:bg-gray-50 text-gray-500"
                            onClick={() => setSigActionOpen(isOpen ? null : label)}>
                            ▾
                          </button>
                          {isOpen && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-lg min-w-36 text-xs">
                              <button className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                onClick={() => apply(filtered.map(s => s.signatureId))}>
                                Apply to all ({filtered.length})
                              </button>
                              <button
                                disabled={selectedSigs.size === 0}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => apply([...selectedSigs])}>
                                Apply to selected ({selectedSigs.size})
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                </div>

                {/* Filters */}
                {(() => {
                  const sf = sigFilters
                  const setF = (k, v) => { setSigFilters(p => ({ ...p, [k]: v })); setSigPage(1) }
                  const active = Object.values(sf).some(v => v !== 'all')
                  const Sel = ({ label, k, opts }) => (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-xs">{label}</span>
                      <select value={sf[k]} onChange={e => setF(k, e.target.value)}
                        className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300 ${sf[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                        <option value="all">All</option>
                        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  )
                  return (
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
                      <Sel label="Learn"    k="learn"    opts={[['on','On'],['off','Off']]} />
                      <Sel label="Alarm"    k="alarm"    opts={[['on','On'],['off','Off']]} />
                      <Sel label="Block"    k="block"    opts={[['on','On'],['off','Off']]} />
                      <Sel label="Status"   k="status"   opts={[['Enforced','Enforced'],['Staging','Staging'],['Disabled','Disabled']]} />
                      <Sel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                      <Sel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                      <Sel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                      {active && (
                        <button onClick={() => { setSigFilters({ learn: 'all', alarm: 'all', block: 'all', status: 'all', accuracy: 'all', risk: 'all', cve: 'all' }); setSigPage(1) }}
                          className="text-xs text-blue-600 hover:underline ml-auto">
                          Clear filters
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Search */}
                <div className="flex items-center px-4 py-2 border-b border-gray-100">
                  <input
                    placeholder="Search name or ID…"
                    value={sigSearch}
                    onChange={e => { setSigSearch(e.target.value); setSigPage(1) }}
                    className="text-xs border border-gray-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>

                {/* Table */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left">
                      <th className="w-8 px-3 py-2">
                        <input type="checkbox" className="rounded"
                          checked={pageRows.length > 0 && pageRows.every(s => selectedSigs.has(String(s.signatureId)))}
                          onChange={e => {
                            const ids = pageRows.map(s => String(s.signatureId))
                            setSelectedSigs(prev => {
                              const next = new Set(prev)
                              ids.forEach(id => e.target.checked ? next.add(id) : next.delete(id))
                              return next
                            })
                          }}
                        />
                      </th>
                      <th className="w-6 px-1 py-2"></th>
                      {[['name', 'Signature Name and Tag', 'text-left', ''], ['id', 'Signature ID', 'text-right', 'w-32'], ['learn', 'Learn', 'text-center', 'w-16'], ['alarm', 'Alarm', 'text-center', 'w-16'], ['block', 'Block', 'text-center', 'w-16'], ['status', 'Status', 'text-right', 'w-24']].map(([col, label, align, w]) => (
                        <th key={col} onClick={() => sortSigBy(col)}
                          className={`px-3 py-2 ${align} ${w} font-semibold text-gray-700 cursor-pointer select-none hover:text-gray-900 group`}>
                          <span className={`inline-flex items-center gap-1 ${align === 'text-right' ? 'justify-end' : align === 'text-center' ? 'justify-center' : ''}`}>
                            {label}
                            {sigSortCol === col
                              ? <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sigSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                              : <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sigsLoading && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading signatures…</td></tr>
                    )}
                    {!sigsLoading && filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        {signatures.length === 0 ? 'No individual signature overrides in this policy.' : 'No signatures match your search.'}
                      </td></tr>
                    )}
                    {!sigsLoading && pageRows.map((sig, i) => {
                      const sid = String(sig.signatureId)
                      const polIdx = signatures.findIndex(s => String(s.signatureId) === sid)
                      const isExpanded = expandedSig === sid
                      const st = sigStatus(sig)
                      const systems = Array.isArray(sig.systems) ? sig.systems.join(', ') : (sig.systems || '—')
                      return [
                        <tr key={sid}
                          className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="rounded"
                              checked={selectedSigs.has(sid)}
                              onChange={e => setSelectedSigs(prev => {
                                const next = new Set(prev)
                                e.target.checked ? next.add(sid) : next.delete(sid)
                                return next
                              })}
                            />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => setExpandedSig(isExpanded ? null : sid)}
                              className="w-4 h-4 rounded-sm bg-blue-500 text-white flex items-center justify-center text-xs font-bold leading-none">
                              {isExpanded ? '▾' : '▸'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-gray-800 font-medium" onClick={() => setExpandedSig(isExpanded ? null : sid)}>
                            {sig.name || sid}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-600">{sig.signatureId}</td>
                          <td className="px-3 py-2"><Check on={sig.learn ?? true} /></td>
                          <td className="px-3 py-2"><Check on={sig.alarm ?? true} /></td>
                          <td className="px-3 py-2"><Check on={sig.block ?? true} /></td>
                          <td className={`px-3 py-2 text-right font-medium ${statusColor(st)}`}>{st}</td>
                        </tr>,
                        isExpanded && (
                          <tr key={sid + '-detail'} className="border-b border-gray-200 bg-blue-50">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1 text-xs text-gray-700">
                                  <div><strong>Signature ID:</strong> {sig.signatureId}</div>
                                  <div><strong>Systems:</strong> {systems}</div>
                                  <div><strong>Risk:</strong> <span className={sig.risk === 'high' ? 'text-red-600' : sig.risk === 'low' ? 'text-green-600' : 'text-yellow-600'}>{sig.risk ?? '—'}</span></div>
                                  <div><strong>Accuracy:</strong> {sig.accuracy ?? '—'}</div>
                                  <div><strong>CVE:</strong> {sig.hasCve ? 'Yes' : 'No'}</div>
                                  <div><strong>Status:</strong> <span className={statusColor(st)}>{st}</span></div>
                                  {sig.signatureType && (
                                    <div><strong>Scope:</strong> <span className="capitalize">{sig.signatureType}</span>
                                      {(() => {
                                        const mw = sig.matchesWithin || {}
                                        const parts = [
                                          [mw.matchesWithinUri, 'URI'],
                                          [mw.matchesWithinHeader, 'Header'],
                                          [mw.matchesWithinParameter, 'Parameter'],
                                          [mw.matchesWithinCookie, 'Cookie'],
                                          [mw.matchesWithinJson, 'JSON'],
                                          [mw.matchesWithinXml, 'XML'],
                                          [mw.matchesWithinGwt, 'GWT'],
                                          [mw.matchesWithinPlainText, 'Plain text'],
                                        ].filter(([v]) => v).map(([, n]) => n)
                                        return parts.length ? <span className="text-gray-500"> · matches within: {parts.join(', ')}</span> : null
                                      })()}
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1 text-xs text-gray-700">
                                  {sig.description && <div><strong>Description:</strong> {sig.description}</div>}
                                  <div className="pt-2 flex gap-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={sig.learn ?? true}
                                        onChange={() => {
                                          const arr = [...signatures]
                                          arr[polIdx] = { ...arr[polIdx], learn: !(sig.learn ?? true) }
                                          setTop('signatures', arr)
                                        }} /> Learn
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={sig.alarm ?? true}
                                        onChange={() => {
                                          const arr = [...signatures]
                                          arr[polIdx] = { ...arr[polIdx], alarm: !(sig.alarm ?? true) }
                                          setTop('signatures', arr)
                                        }} /> Alarm
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={sig.block ?? true}
                                        onChange={() => {
                                          const arr = [...signatures]
                                          arr[polIdx] = { ...arr[polIdx], block: !(sig.block ?? true) }
                                          setTop('signatures', arr)
                                        }} /> Block
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={sig.performStaging ?? false}
                                        onChange={() => {
                                          const arr = [...signatures]
                                          arr[polIdx] = { ...arr[polIdx], performStaging: !(sig.performStaging ?? false) }
                                          setTop('signatures', arr)
                                        }} /> Staged
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={sig.enabled === false}
                                        onChange={() => {
                                          const arr = [...signatures]
                                          arr[polIdx] = { ...arr[polIdx], enabled: sig.enabled === false }
                                          setTop('signatures', arr)
                                        }} /> Disabled
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      ]
                    })}
                  </tbody>
                </table>
                {/* Pagination — DeviceFleet style */}
                {!sigsLoading && filtered.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {[10, 20, 50].map((size, idx) => (
                        <span key={size} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <button onClick={() => { setSigPageSize(size); setSigPage(1) }}
                            className={`px-1 py-0.5 rounded transition-colors ${sigPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                            {size}
                          </button>
                        </span>
                      ))}
                      
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>Page {page} of {totalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setSigPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => setSigPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            })()}
          </Card>

        </div>
      )}

      {/* ── HEADERS ── */}
      {activeTab === 'headers' && (
        <div className="space-y-3">
              {/* Host Names */}
              <Card>
                <SectionHeader title="Host Names" sub={`${hostNames.length} entries`} onClick={() => toggleSection('header-general')} collapsed={collapsed['header-general']} />
                {!collapsed['header-general'] && (
                  <div className="px-4 py-3">
                    <div className="flex gap-2 mb-2">
                      <select value={hostnameSubdomain ? 'include' : 'exclude'}
                        onChange={e => setHostnameSubdomain(e.target.value === 'include')}
                        className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                        <option value="exclude">Exclude Sub-Domains</option>
                        <option value="include">Include Sub-Domains</option>
                      </select>
                      <input value={hostnameInput} onChange={e => setHostnameInput(e.target.value)}
                        placeholder="Host Name"
                        onKeyDown={e => { if (e.key === 'Enter' && hostnameInput.trim()) { setTop('host-names', [...hostNames, { name: hostnameInput.trim(), includeSubdomains: hostnameSubdomain }]); setHostnameInput(''); setUnsaved(true) } }}
                        className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-400 placeholder:italic" />
                      <button onClick={() => { if (!hostnameInput.trim()) return; setTop('host-names', [...hostNames, { name: hostnameInput.trim(), includeSubdomains: hostnameSubdomain }]); setHostnameInput(''); setUnsaved(true) }}
                        className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium">Add</button>
                    </div>
                    {hostNames.length > 0 && (
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-3 py-1.5 font-medium text-gray-500">Host Name</th>
                          <th className="text-left px-3 py-1.5 font-medium text-gray-500">Sub-Domains</th>
                          <th className="w-8"></th>
                        </tr></thead>
                        <tbody>
                          {hostNames.map((h, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-3 py-1.5 font-mono text-gray-800">{h.name}</td>
                              <td className="px-3 py-1.5 text-gray-500">{h.includeSubdomains ? 'Include' : 'Exclude'}</td>
                              <td className="px-3 py-1.5 text-center">
                                <button onClick={() => { setTop('host-names', hostNames.filter((_, j) => j !== i)); setUnsaved(true) }}
                                  className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>

              {/* Redirection Protection */}
              <Card>
                <SectionHeader title="Redirection Protection" onClick={() => toggleSection('header-redir')} collapsed={collapsed['header-redir']} />
                {!collapsed['header-redir'] && (
                  <div className="px-4 py-3">
                    <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs mb-3">
                      {[['true','Enabled'],['false','Disabled']].map(([val, label]) => {
                        const on = pol['redirection-protection']?.redirectionProtectionEnabled ?? false
                        const active = val === 'true' ? on : !on
                        return (
                          <button key={val} onClick={() => { setNested('redirection-protection', 'redirectionProtectionEnabled', val === 'true'); setUnsaved(true) }}
                            className={`px-5 py-1 transition-colors ${active ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {(pol['redirection-protection']?.redirectionProtectionEnabled ?? false) && (
                      <>
                        <div className="flex gap-2 mb-2">
                          <select value={redirType} onChange={e => setRedirType(e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                            <option value="explicit">Explicit</option>
                            <option value="wildcard">Wildcard</option>
                          </select>
                          <select value={redirSubdomain ? 'include' : 'exclude'}
                            onChange={e => setRedirSubdomain(e.target.value === 'include')}
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                            <option value="exclude">Exclude Sub-Domains</option>
                            <option value="include">Include Sub-Domains</option>
                          </select>
                          <input value={redirInput} onChange={e => setRedirInput(e.target.value)}
                            placeholder="Redirection domain"
                            onKeyDown={e => { if (e.key === 'Enter' && redirInput.trim()) { setEditedPol(p => { const rp = { ...(p['redirection-protection'] || {}) }; rp.redirectionDomains = [...(rp.redirectionDomains || []), { domainName: redirInput.trim(), includeSubdomains: redirSubdomain, type: redirType }]; return { ...p, 'redirection-protection': rp } }); setRedirInput(''); setUnsaved(true) } }}
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-400 placeholder:italic" />
                          <button onClick={() => { if (!redirInput.trim()) return; setEditedPol(p => { const rp = { ...(p['redirection-protection'] || {}) }; rp.redirectionDomains = [...(rp.redirectionDomains || []), { domainName: redirInput.trim(), includeSubdomains: redirSubdomain, type: redirType }]; return { ...p, 'redirection-protection': rp } }); setRedirInput(''); setUnsaved(true) }}
                            className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium">Add</button>
                        </div>
                        {redirDomains.length > 0 && (
                          <table className="w-full text-xs">
                            <thead><tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Domain</th>
                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Type</th>
                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Sub-Domains</th>
                              <th className="w-8"></th>
                            </tr></thead>
                            <tbody>
                              {redirDomains.map((d, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-3 py-1.5 font-mono text-gray-800">{d.domainName}</td>
                                  <td className="px-3 py-1.5 text-gray-500 capitalize">{d.type || 'explicit'}</td>
                                  <td className="px-3 py-1.5 text-gray-500">{d.includeSubdomains ? 'Include' : 'Exclude'}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    <button onClick={() => { setEditedPol(p => { const rp = { ...(p['redirection-protection'] || {}) }; rp.redirectionDomains = (rp.redirectionDomains || []).filter((_, j) => j !== i); return { ...p, 'redirection-protection': rp } }); setUnsaved(true) }}
                                      className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Headers <span className="text-xs font-normal text-gray-400 ml-1">{headers.length} entries</span></span>
              <div className="flex items-center gap-2">
                <input value={hdrSearch} onChange={e => { setHdrSearch(e.target.value); setHdrPageNum(1) }}
                  placeholder="Search…"
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                {hdrSelected.size > 0 && (
                  <div className="relative inline-flex">
                    <button onClick={bulkDeleteHeaders}
                      className="text-xs px-2.5 py-1.5 rounded-l bg-red-600 text-white hover:bg-red-700 border border-red-600 font-medium">
                      Delete ({hdrSelected.size})
                    </button>
                    <button onClick={() => setHdrDeleteMenuOpen(o => !o)} title="More delete options"
                      className="text-xs px-1.5 py-1.5 rounded-r bg-red-600 text-white hover:bg-red-700 border-y border-r border-red-600 border-l border-l-red-400">▾</button>
                    {hdrDeleteMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-0" onClick={() => setHdrDeleteMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
                          <button onClick={deleteAllHeaders}
                            className="block w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 whitespace-nowrap">
                            Delete All ({headers.filter(h => !isHeaderProtected(h)).length})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <button ref={hdrAddBtnRef} onClick={() => {
                    const r = hdrAddBtnRef.current?.getBoundingClientRect()
                    if (r) setHdrAddPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                    setHdrAddOpen(v => !v); setHdrAddName('')
                  }} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                    Add <span className="text-[10px]">▾</span>
                  </button>
                  {hdrAddOpen && hdrAddPos && createPortal(
                    <div style={{ position: 'fixed', top: hdrAddPos.top, right: hdrAddPos.right, zIndex: 9999 }}
                      className="bg-white border border-gray-200 rounded shadow-lg w-60 p-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">New Header</div>
                      {(() => {
                        const nextWildcardOrder = Math.max(0, ...headers.filter(h => h.type === 'wildcard').map(h => h.wildcardOrder || 0)) + 1
                        const isDup = !!hdrAddName.trim() && headers.some(h => h.name === hdrAddName.trim().toLowerCase())
                        return (
                          <form onSubmit={e => {
                            e.preventDefault()
                            const name = hdrAddName.trim().toLowerCase()
                            if (!name || isDup) return
                            const entry = { name, type: hdrAddType, mandatory: false, maskValueInLogs: false, checkSignatures: true, allowRepeatedOccurrences: false }
                            if (hdrAddType === 'wildcard') entry.wildcardOrder = nextWildcardOrder
                            setTop('headers', [...editedPol.headers, entry])
                            setUnsaved(true)
                            setHdrAddOpen(false)
                            setHdrAddName('')
                            setHdrAddType('explicit')
                          }} className="flex flex-col gap-2">
                            <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                              {['explicit', 'wildcard'].map(t => (
                                <button key={t} type="button" onClick={() => setHdrAddType(t)}
                                  className={`flex-1 px-2 py-1.5 capitalize transition-colors ${hdrAddType === t ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                  {t}
                                </button>
                              ))}
                            </div>
                            <input value={hdrAddName} onChange={e => setHdrAddName(e.target.value)}
                              placeholder={hdrAddType === 'wildcard' ? 'e.g. x-custom-*' : 'e.g. x-custom-header'}
                              autoFocus
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                            {isDup && <span className="text-xs text-red-500">Header already exists.</span>}
                            <button type="submit" disabled={!hdrAddName.trim() || isDup}
                              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                              Add Header
                            </button>
                          </form>
                        )
                      })()}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </div>
            {(() => {
              // 1. Filter by name
              const q = hdrSearch.trim().toLowerCase()
              let hdrList = headers.map((h, i) => ({ h, i }))
              if (q) hdrList = hdrList.filter(({ h }) => (h.name || '').toLowerCase().includes(q))
              // 2. Sort — explicit column or default (wildcards first by order, then name)
              const hdrSigKey = (h) => {
                if ((h.name || '').toLowerCase() === 'cookie') return -1   // sigs locked for the cookie header
                if (!(h.checkSignatures ?? true)) return 0
                return 1 + (h.signatureOverrides || []).length
              }
              const hdrKeyVal = ({ h }) => {
                switch (hdrSortCol) {
                  case 'name': return (h.name || '').toLowerCase()
                  case 'mandatory': return (h.mandatory ?? false) ? 1 : 0
                  case 'mask': return (h.maskValueInLogs ?? h.maskValue ?? false) ? 1 : 0
                  case 'checkSigs': return hdrSigKey(h)
                  case 'allowRepeats': return (h.allowRepeatedOccurrences ?? false) ? 1 : 0
                  default: return ''
                }
              }
              if (hdrSortCol) {
                const dir = hdrSortDir === 'desc' ? -1 : 1
                hdrList = [...hdrList].sort((a, b) => { const av = hdrKeyVal(a), bv = hdrKeyVal(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
              } else {
                hdrList = [...hdrList].sort((a, b) => {
                  const aw = a.h.type === 'wildcard', bw = b.h.type === 'wildcard'
                  if (aw && !bw) return -1
                  if (!aw && bw) return 1
                  if (aw && bw) return (a.h.wildcardOrder ?? 0) - (b.h.wildcardOrder ?? 0)
                  return (a.h.name || '').localeCompare(b.h.name || '')
                })
              }
              // 3. Paginate
              const hdrFiltered = hdrList
              const hdrTotalPages = Math.max(1, Math.ceil(hdrFiltered.length / hdrPageSize))
              const hdrSafePage = Math.min(hdrPageNum, hdrTotalPages)
              const hdrPageRows = hdrFiltered.slice((hdrSafePage - 1) * hdrPageSize, hdrSafePage * hdrPageSize)
              const hdrSelIdxs = hdrPageRows.filter(r => !isHeaderProtected(r.h)).map(r => r.i)  // protected headers not selectable
              const hdrAllSel = hdrSelIdxs.length > 0 && hdrSelIdxs.every(i => hdrSelected.has(i))
              const HDR_SORT_COLS = [['name', 'Name'], ['mandatory', 'Mandatory'], ['mask', 'Mask value'], ['checkSigs', 'Check sigs'], ['allowRepeats', 'Allow repeats']]
              return (<>
                {hdrPageRows.length === 0
                  ? <div className="p-4 text-xs text-gray-400">{hdrSearch ? 'No headers match your search.' : 'No headers configured.'}</div>
                  : (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-8 px-2 py-2 text-center">
                      {hdrSelIdxs.length > 0 && (
                        <input type="checkbox" checked={hdrAllSel}
                          onChange={() => setHdrSelected(s => { const n = new Set(s); if (hdrAllSel) hdrSelIdxs.forEach(i => n.delete(i)); else hdrSelIdxs.forEach(i => n.add(i)); return n })} />
                      )}
                    </th>
                    {HDR_SORT_COLS.map(([key, label]) => (
                      <th key={key} onClick={() => sortHeaderBy(key)}
                        className="text-left px-3 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 group">
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {hdrSortCol === key ? (
                            <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={hdrSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                          ) : (
                            <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="w-12 px-2 py-2 text-right font-medium text-gray-500">Edit</th>
                  </tr></thead>
                  <tbody>
                    {hdrPageRows.map(({ h, i }) => {
                      const hn = (h.name || '').toLowerCase()
                      const isCookie = hn === 'cookie'
                      const isAuth = hn === 'authorization'
                      const isWildcard = hn === '*'
                      const isDefault = ['transfer-encoding','authorization','cookie','*','referer'].includes(hn)
                      const locked = (field) => {
                        // The "*" wildcard header matches everything, so it can't be
                        // required to be present — Mandatory is disabled for it.
                        if ((field === 'allowRepeatedOccurrences' || field === 'mandatory') && isWildcard) return true
                        if (isCookie && field !== 'allowRepeatedOccurrences') return true
                        if (isAuth && (field === 'decodeValueAsBase64' || field === 'autoDetectBinaryValue')) return true
                        return false
                      }
                      const checkSigs = h.checkSignatures ?? true
                      const isExp = expandedHeader === i
                      const sigOverrides = h.signatureOverrides || []
                      const updateHeader = (patch) => {
                        const arr = [...editedPol.headers]
                        arr[i] = { ...arr[i], ...patch }
                        setTop('headers', arr); setUnsaved(true)
                      }
                      const LockToggle = ({ on, field, onClick }) => locked(field)
                        ? <span className="opacity-30 cursor-not-allowed"><Toggle on={false} onClick={() => {}} /></span>
                        : <Toggle on={on} onClick={onClick} />
                      return [
                        <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${hdrSelected.has(i) ? 'bg-blue-50' : ''} ${isExp ? 'bg-blue-100' : ''}`}>
                          <td className="px-2 py-2 text-center">
                            {!isDefault && <input type="checkbox" checked={hdrSelected.has(i)} onChange={() => toggleHeaderSelected(i)} />}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-gray-800">
                            {h.name}{isDefault && <span className="ml-1.5 text-[10px] text-gray-400 font-sans">(mandatory)</span>}
                          </td>
                          <td className="px-3 py-2">
                            <LockToggle on={h.mandatory ?? false} field="mandatory" onClick={() => toggleItem('headers', i, 'mandatory')} />
                          </td>
                          <td className="px-3 py-2">
                            <LockToggle on={h.maskValueInLogs ?? h.maskValue ?? false} field="maskValueInLogs" onClick={() => toggleItem('headers', i, 'maskValueInLogs')} />
                          </td>
                          <td className="px-3 py-2">{(() => {
                            if (isCookie) return <span className="text-gray-300">N/A</span>
                            if (!checkSigs) return <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            return (<span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{sigOverrides.length > 0 && <span className="text-amber-600">· {sigOverrides.length} ex.</span>}</span>)
                          })()}</td>
                          <td className="px-3 py-2">
                            <LockToggle on={h.allowRepeatedOccurrences ?? false} field="allowRepeatedOccurrences" onClick={() => toggleItem('headers', i, 'allowRepeatedOccurrences')} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button onClick={() => openHeaderModal(i)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit header">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                          </td>
                        </tr>,
                        isExp && createPortal(
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cancelHeaderModal}>
                            <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-[838px] max-h-[90vh] flex flex-col overflow-hidden border border-gray-300" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-between px-6 py-3 border-b border-blue-200 bg-blue-50 flex-shrink-0">
                                <h3 className="text-sm font-bold text-gray-900">Edit Header — <span className="font-mono text-blue-700">{h.name}</span></h3>
                                <div className="flex items-center gap-2">
                                  <Btn size="sm" onClick={cancelHeaderModal}>Cancel</Btn>
                                  <Btn size="sm" variant="primary" onClick={commitHeaderModal}>Update</Btn>
                                </div>
                              </div>
                              <div className="overflow-y-auto px-4 py-4">
                              {!isCookie && (
                                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mb-3 pb-3 border-b border-blue-100">
                                  <input type="checkbox" checked={checkSigs} onChange={e => updateHeader({ checkSignatures: e.target.checked })} />
                                  Check attack signatures on this header
                                </label>
                              )}
                              {h.type === 'wildcard' && (() => {
                                const orderDup = headers.some((other, j) => j !== i && other.type === 'wildcard' && (other.wildcardOrder ?? 0) === (h.wildcardOrder ?? 0))
                                return (
                                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-blue-100">
                                    <span className="text-xs font-medium text-gray-700">Wildcard Order</span>
                                    <input type="number" min={1} value={h.wildcardOrder ?? 1}
                                      onChange={e => updateHeader({ wildcardOrder: e.target.value === '' ? 1 : Number(e.target.value) })}
                                      className={`w-20 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 text-center ${orderDup ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-gray-200 focus:ring-blue-400'}`} />
                                    {orderDup
                                      ? <span className="text-xs text-red-500">Order already used by another wildcard header.</span>
                                      : <span className="text-xs text-gray-400">lower = higher priority</span>
                                    }
                                  </div>
                                )
                              })()}
                              <div className="grid gap-7" style={{gridTemplateColumns: '35% 65%'}}>
                                {/* Normalization */}
                                <div className="space-y-3">
                                  <div className="text-xs font-semibold text-gray-700">Normalization</div>
                                  <div className={isAuth ? 'opacity-30 pointer-events-none' : ''}>
                                    <div className="text-xs text-gray-700 mb-1.5">Base64 Decoding{isAuth && <span className="ml-1 text-orange-400">(locked)</span>}</div>
                                    <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
                                      {['disabled', 'enabled', 'required'].map(val => (
                                        <button key={val}
                                          onClick={() => {
                                            if (isAuth) return
                                            const patch = { decodeValueAsBase64: val }
                                            if (val === 'required') {
                                              patch.urlNormalization = false
                                              patch.percentDecoding = false
                                              patch.normalizationViolations = false
                                            }
                                            updateHeader(patch)
                                          }}
                                          className={`px-3 py-1 capitalize transition-colors ${(h.decodeValueAsBase64 ?? 'disabled') === val ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                          {val}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className={`flex items-center justify-between ${isAuth ? 'opacity-30 pointer-events-none' : ''}`}>
                                    <span className="text-xs text-gray-700">Auto Detect Binary Value{isAuth && <span className="ml-1 text-orange-400">(locked)</span>}</span>
                                    <Toggle on={h.autoDetectBinaryValue ?? false} onClick={() => updateHeader({ autoDetectBinaryValue: !(h.autoDetectBinaryValue ?? false) })} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-700">HTML Normalization</span>
                                    <Toggle on={h.htmlNormalization ?? false} onClick={() => updateHeader({ htmlNormalization: !(h.htmlNormalization ?? false) })} />
                                  </div>
                                  {(h.decodeValueAsBase64 ?? 'disabled') !== 'required' && (<>
                                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                    <input type="checkbox" checked={h.urlNormalization ?? false}
                                      onChange={e => {
                                        const checked = e.target.checked
                                        const eitherOn = checked || (h.percentDecoding ?? false)
                                        updateHeader({ urlNormalization: checked, percentDecoding: checked ? false : h.percentDecoding, ...(!eitherOn && { normalizationViolations: false }) })
                                      }} />
                                    URL Normalization
                                    {h.urlNormalization && <span className="text-[10px] text-blue-400">Included in URL Normalization</span>}
                                  </label>
                                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                    <input type="checkbox" checked={h.percentDecoding ?? false}
                                      onChange={e => {
                                        const checked = e.target.checked
                                        const eitherOn = checked || (h.urlNormalization ?? false)
                                        updateHeader({ percentDecoding: checked, urlNormalization: checked ? false : h.urlNormalization, ...(!eitherOn && { normalizationViolations: false }) })
                                      }} />
                                    Percent Decoding
                                  </label>
                                  {(h.urlNormalization || h.percentDecoding) && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-700">Evasion Techniques Violations</span>
                                      <Toggle on={h.normalizationViolations ?? false} onClick={() => updateHeader({ normalizationViolations: !(h.normalizationViolations ?? false) })} />
                                    </div>
                                  )}
                                  </>)}
                                </div>
                                {/* Signature exclusions */}
                                <div>
                                  <div className="text-xs font-semibold text-gray-700 mb-2">
                                    Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}
                                  </div>
                                  {sigOverrides.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {sigOverrides.map((sid, si) => {
                                        const sigId = typeof sid === 'object' ? String(sid.signatureId) : String(sid)
                                        const sigInfo = deviceSigs.find(s => String(s.signatureId) === sigId)
                                        return (
                                          <span key={si} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700" title={sigInfo?.name || ''}>
                                            <span className="font-mono">{sigId}</span>
                                            {sigInfo && <span className="text-gray-400 max-w-32 truncate">{sigInfo.name}</span>}
                                            <button onClick={() => updateHeader({ signatureOverrides: sigOverrides.filter((_, j) => j !== si) })}
                                              className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                  <div className="flex gap-1 items-center">
                                    {(() => {
                                      // Restrict to header-scope signatures (matchesWithinHeader === true, or unknown scope as safe fallback).
                                      const headerCandidates = deviceSigs.filter(s => {
                                        const mw = s.matchesWithin || {}
                                        return Object.keys(mw).length === 0 || mw.matchesWithinHeader === true
                                      })
                                      const existingIds = sigOverrides.map(s => typeof s === 'object' ? String(s.signatureId) : String(s))
                                      return (
                                        <SigIdAutocomplete
                                          candidates={headerCandidates}
                                          existingIds={existingIds}
                                          onAdd={sig => updateHeader({
                                            signatureOverrides: [
                                              ...sigOverrides,
                                              { signatureId: Number(sig.signatureId), enabled: false, name: sig.name || '', tag: sig.tag || '' },
                                            ],
                                          })}
                                          width={144}
                                        />
                                      )
                                    })()}
                                    <button type="button"
                                      onClick={() => { setHeaderSigModal(i); setHeaderSigSearch(''); setHeaderSigSelected(new Set(sigOverrides.map(s => typeof s === 'object' ? String(s.signatureId) : String(s)))) }}
                                      className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">
                                      Advanced
                                    </button>
                                  </div>
                                </div>
                              </div>
                              </div>
                            </div>
                          </div>, document.body, `hdr-modal-${i}`)
                      ]
                    })}
                  </tbody>
                </table>
                  )}
                {/* Pagination — DeviceFleet style */}
                {hdrFiltered.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {[10, 20, 50].map((size, idx) => (
                        <span key={size} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <button onClick={() => { setHdrPageSize(size); setHdrPageNum(1) }}
                            className={`px-1 py-0.5 rounded transition-colors ${hdrPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                            {size}
                          </button>
                        </span>
                      ))}
                      
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>Page {hdrSafePage} of {hdrTotalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setHdrPageNum(p => Math.max(1, p - 1))} disabled={hdrSafePage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => setHdrPageNum(p => Math.min(hdrTotalPages, p + 1))} disabled={hdrSafePage >= hdrTotalPages}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>)
            })()}
          </Card>
          <Card>
            <div className="px-4 py-3 text-xs text-gray-600 flex items-center gap-1.5">
              Header character set is managed on the
              <button onClick={() => setActiveTab('charsets')} className="text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5">
                Character Sets page
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </button>
              (Config group).
            </div>
          </Card>
          {/* Signature exclusion advanced modal */}
          {headerSigModal !== null && (() => {
            // Source: policy signatures enriched with device data, filtered to header scope
            const deviceSigMap = Object.fromEntries(deviceSigs.map(s => [String(s.signatureId), s]))
            const policySigIds = new Set(signatures.map(s => String(s.signatureId)))
            const headerScopeSigs = deviceSigs.filter(s => {
              const sid = String(s.signatureId)
              if (!policySigIds.has(sid)) return false
              const mw = s.matchesWithin || {}
              // Include if scope info is missing, or if the signature can match within headers.
              return Object.keys(mw).length === 0 || mw.matchesWithinHeader === true
            })
            const modalSigs = headerScopeSigs.filter(s => {
              const q = headerSigSearch.toLowerCase()
              if (q && !String(s.signatureId).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
              if (headerSigFilters.accuracy !== 'all' && s.accuracy !== headerSigFilters.accuracy) return false
              if (headerSigFilters.risk !== 'all' && s.risk !== headerSigFilters.risk) return false
              if (headerSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (headerSigFilters.cve === 'yes')) return false
              return true
            })
            const filtersActive = Object.values(headerSigFilters).some(v => v !== 'all')
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={headerSigFilters[k]} onChange={e => setHeaderSigFilters(p => ({ ...p, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${headerSigFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return createPortal(
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setHeaderSigModal(null)}>
                <div className="bg-white rounded-lg shadow-xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures — header scope</div>
                      <div className="text-xs text-gray-400 mt-0.5">Header: <span className="font-mono">{headers[headerSigModal]?.name}</span> · {headerScopeSigs.length} signatures in policy with header scope</div>
                    </div>
                    <button onClick={() => setHeaderSigModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  {/* Filters */}
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input
                      autoFocus
                      placeholder="Search by ID or name…"
                      value={headerSigSearch}
                      onChange={e => setHeaderSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {filtersActive && <button onClick={() => setHeaderSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                    <span className="ml-auto text-xs text-gray-400">{modalSigs.length} shown · {headerSigSelected.size} selected</span>
                    {headerSigSelected.size > 0 && (
                      <button onClick={() => setHeaderSigSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>
                    )}
                  </div>
                  {/* Table */}
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="p-8 text-center text-xs text-gray-400">No signatures synced yet — sync from the device page first.</div>
                      : modalSigs.length === 0
                      ? <div className="p-8 text-center text-xs text-gray-400">No signatures match the current filters.</div>
                      : (
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50 z-10">
                            <tr className="border-b border-gray-200">
                              <th className="w-8 px-3 py-2">
                                <input type="checkbox"
                                  checked={modalSigs.length > 0 && modalSigs.every(s => headerSigSelected.has(String(s.signatureId)))}
                                  onChange={e => setHeaderSigSelected(prev => {
                                    const next = new Set(prev)
                                    modalSigs.forEach(s => e.target.checked ? next.add(String(s.signatureId)) : next.delete(String(s.signatureId)))
                                    return next
                                  })} />
                              </th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">ID</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                              <th className="px-3 py-2 font-medium text-gray-500 text-center">Accuracy</th>
                              <th className="px-3 py-2 font-medium text-gray-500 text-center">Risk</th>
                              <th className="px-3 py-2 font-medium text-gray-500 text-center">CVE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalSigs.slice(0, 300).map(s => {
                              const sid = String(s.signatureId)
                              const sel = headerSigSelected.has(sid)
                              return (
                                <tr key={sid} className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50 ${sel ? 'bg-blue-50' : ''}`}
                                  onClick={() => setHeaderSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })}>
                                  <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={sel} onChange={() => setHeaderSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })} />
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-gray-600">{sid}</td>
                                  <td className="px-3 py-1.5 text-gray-800 max-w-xs truncate">{s.name || '—'}</td>
                                  <td className="px-3 py-1.5 text-center capitalize text-gray-500">{s.accuracy || '—'}</td>
                                  <td className={`px-3 py-1.5 text-center capitalize font-medium ${s.risk === 'high' ? 'text-red-600' : s.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{s.risk || '—'}</td>
                                  <td className="px-3 py-1.5 text-center">{s.hasCve ? <span className="text-orange-500 font-medium">CVE</span> : <span className="text-gray-300">—</span>}</td>
                                </tr>
                              )
                            })}
                            {modalSigs.length > 300 && (
                              <tr><td colSpan={6} className="px-3 py-2 text-center text-xs text-gray-400">Showing first 300 — refine filters to see more</td></tr>
                            )}
                          </tbody>
                        </table>
                      )
                    }
                  </div>
                  {/* Footer */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
                    <button onClick={() => setHeaderSigModal(null)} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
                    <button
                      onClick={() => {
                        const arr = [...editedPol.headers]
                        arr[headerSigModal] = { ...arr[headerSigModal], signatureOverrides: [...headerSigSelected] }
                        setTop('headers', arr); setUnsaved(true)
                        setHeaderSigModal(null)
                      }}
                      className="text-xs px-4 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 font-medium">
                      Apply ({headerSigSelected.size})
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          })()}

        </div>
      )}

      {activeTab === 'cookies' && (
        <div className="space-y-3">
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Cookies <span className="text-xs font-normal text-gray-400 ml-1">{cookies.length} entries</span></span>
              <div className="flex items-center gap-2">
                <input value={ckSearch} onChange={e => { setCkSearch(e.target.value); setCkPageNum(1) }}
                  placeholder="Search…"
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                {ckSelected.size > 0 && (
                  <div className="relative inline-flex">
                    <button onClick={bulkDeleteCookies}
                      className="text-xs px-2.5 py-1.5 rounded-l bg-red-600 text-white hover:bg-red-700 border border-red-600 font-medium">
                      Delete ({ckSelected.size})
                    </button>
                    <button onClick={() => setCkDeleteMenuOpen(o => !o)} title="More delete options"
                      className="text-xs px-1.5 py-1.5 rounded-r bg-red-600 text-white hover:bg-red-700 border-y border-r border-red-600 border-l border-l-red-400">▾</button>
                    {ckDeleteMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-0" onClick={() => setCkDeleteMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
                          <button onClick={deleteAllCookies}
                            className="block w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 whitespace-nowrap">
                            Delete All ({cookies.filter(c => c.name !== '*').length})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <button ref={ckAddBtnRef} onClick={() => {
                    const r = ckAddBtnRef.current?.getBoundingClientRect()
                    if (r) setCkAddPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                    setCkAddOpen(v => !v); setCkAddName('')
                  }} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                    Add <span className="text-[10px]">▾</span>
                  </button>
                  {ckAddOpen && ckAddPos && createPortal(
                    <div style={{ position: 'fixed', top: ckAddPos.top, right: ckAddPos.right, zIndex: 9999 }}
                      className="bg-white border border-gray-200 rounded shadow-lg w-60 p-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">New Cookie</div>
                      {(() => {
                        const nextWildcardOrder = Math.max(0, ...cookies.filter(c => c.type === 'wildcard').map(c => c.wildcardOrder || 0)) + 1
                        const isDup = !!ckAddName.trim() && cookies.some(c => c.name === ckAddName.trim())
                        return (
                          <form onSubmit={e => {
                            e.preventDefault()
                            const name = ckAddName.trim()
                            if (!name || isDup) return
                            const entry = { name, type: ckAddType, enforcementType: 'allow', attackSignaturesCheck: true, performStaging: false, maskValueInLogs: false, decodeValueAsBase64: 'disabled', accessibleOnlyThroughTheHttpProtocol: false, securedOverHttpsConnection: false, insertSameSiteAttribute: 'none' }
                            if (ckAddType === 'wildcard') entry.wildcardOrder = nextWildcardOrder
                            setTop('cookies', [...editedPol.cookies, entry])
                            setUnsaved(true)
                            setCkAddOpen(false)
                            setCkAddName('')
                            setCkAddType('explicit')
                          }} className="flex flex-col gap-2">
                            <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                              {['explicit', 'wildcard'].map(t => (
                                <button key={t} type="button" onClick={() => setCkAddType(t)}
                                  className={`flex-1 px-2 py-1.5 capitalize transition-colors ${ckAddType === t ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                  {t}
                                </button>
                              ))}
                            </div>
                            <input value={ckAddName} onChange={e => setCkAddName(e.target.value)}
                              placeholder={ckAddType === 'wildcard' ? 'e.g. session_*' : 'e.g. session_id'}
                              autoFocus
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                            {isDup && <span className="text-xs text-red-500">Cookie already exists.</span>}
                            <button type="submit" disabled={!ckAddName.trim() || isDup}
                              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                              Add Cookie
                            </button>
                          </form>
                        )
                      })()}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </div>
            {(() => {
              // 1. Filter across name / type / enforcement
              const q = ckSearch.trim().toLowerCase()
              let ckList = cookies.map((c, i) => ({ c, i }))
              if (q) ckList = ckList.filter(({ c }) =>
                (c.name || '').toLowerCase().includes(q)
                || (c.type || 'explicit').toLowerCase().includes(q)
                || (c.enforcementType || 'allow').toLowerCase().includes(q))
              // 2. Sort — explicit column or default (wildcards first by order, then name)
              const ckKeyVal = ({ c }) => {
                switch (ckSortCol) {
                  case 'name': return (c.name || '').toLowerCase()
                  case 'type': return c.type || 'explicit'
                  case 'enforcement': return c.enforcementType || 'allow'
                  case 'attackSigs':
                    if ((c.enforcementType ?? 'allow') === 'enforce') return -1
                    if (!(c.attackSignaturesCheck ?? true)) return 0
                    return 1 + (c.signatureOverrides || []).length
                  case 'staging': return (c.performStaging ?? false) ? 1 : 0
                  case 'mask': return (c.maskValueInLogs ?? false) ? 1 : 0
                  default: return ''
                }
              }
              if (ckSortCol) {
                const dir = ckSortDir === 'desc' ? -1 : 1
                ckList = [...ckList].sort((a, b) => { const av = ckKeyVal(a), bv = ckKeyVal(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
              } else {
                ckList = [...ckList].sort((a, b) => {
                  const aw = a.c.type === 'wildcard', bw = b.c.type === 'wildcard'
                  if (aw && !bw) return -1
                  if (!aw && bw) return 1
                  if (aw && bw) return (a.c.wildcardOrder ?? 0) - (b.c.wildcardOrder ?? 0)
                  return (a.c.name || '').localeCompare(b.c.name || '')
                })
              }
              // 3. Paginate
              const ckFiltered = ckList
              const ckTotalPages = Math.max(1, Math.ceil(ckFiltered.length / ckPageSize))
              const ckSafePage = Math.min(ckPageNum, ckTotalPages)
              const ckPageRows = ckFiltered.slice((ckSafePage - 1) * ckPageSize, ckSafePage * ckPageSize)
              const ckSelIdxs = ckPageRows.filter(r => r.c.name !== '*').map(r => r.i)  // '*' is not selectable
              const ckAllSel = ckSelIdxs.length > 0 && ckSelIdxs.every(i => ckSelected.has(i))
              const CK_SORT_COLS = [['name', 'Name'], ['type', 'Type'], ['enforcement', 'Enforcement'], ['attackSigs', 'Attack sigs'], ['staging', 'Staging'], ['mask', 'Mask']]
              return (<>
                {ckPageRows.length === 0
                  ? <div className="p-4 text-xs text-gray-400">{ckSearch ? 'No cookies match your search.' : 'No cookies configured.'}</div>
                  : (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        <th className="w-8 px-2 py-2 text-center">
                          {ckSelIdxs.length > 0 && (
                            <input type="checkbox" checked={ckAllSel}
                              onChange={() => setCkSelected(s => { const n = new Set(s); if (ckAllSel) ckSelIdxs.forEach(i => n.delete(i)); else ckSelIdxs.forEach(i => n.add(i)); return n })} />
                          )}
                        </th>
                        {CK_SORT_COLS.map(([key, label]) => (
                          <th key={key} onClick={() => sortCookieBy(key)}
                            className="text-left px-3 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 group">
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {ckSortCol === key ? (
                                <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ckSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                              ) : (
                                <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              )}
                            </span>
                          </th>
                        ))}
                        <th className="w-12 px-2 py-2 text-right font-medium text-gray-500">Edit</th>
                      </tr></thead>
                      <tbody>
                        {ckPageRows.map(({ c, i }) => {
                          const isExp = expandedCookie === i
                          const isDefault = c.name === '*'
                          const isEnforce = (c.enforcementType ?? 'allow') === 'enforce'
                          const sigOverrides = c.signatureOverrides || []
                          const updateCookie = (patch) => {
                            const arr = [...editedPol.cookies]
                            arr[i] = { ...arr[i], ...patch }
                            setTop('cookies', arr); setUnsaved(true)
                          }
                          const sameSiteVal = c.insertSameSiteAttribute ?? 'none'
                          const sameSiteIsNone = sameSiteVal === 'none-value'
                          const showSecureWarning = sameSiteIsNone && !(c.securedOverHttpsConnection ?? false)
                          return [
                            <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${ckSelected.has(i) ? 'bg-blue-50' : ''} ${isExp ? 'bg-blue-100' : ''}`}>
                              <td className="px-2 py-2 text-center">
                                {!isDefault && <input type="checkbox" checked={ckSelected.has(i)} onChange={() => toggleCookieSelected(i)} />}
                              </td>
                              <td className="px-3 py-2 font-mono font-medium text-gray-800">
                                {c.name}{isDefault && <span className="ml-1.5 text-[10px] text-gray-400 font-sans">(mandatory)</span>}
                              </td>
                              <td className="px-3 py-2"><Badge color={c.type === 'wildcard' ? 'blue' : 'gray'}>{c.type || 'explicit'}</Badge></td>
                              <td className="px-3 py-2">
                                <select value={c.enforcementType ?? 'allow'} onChange={e => updateCookie({ enforcementType: e.target.value })}
                                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                  <option value="allow">Allowed</option>
                                  <option value="enforce">Enforced</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">{(() => {
                                if (isEnforce) return <span className="text-gray-300">N/A</span>
                                if (!(c.attackSignaturesCheck ?? true)) return <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                return (<span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{sigOverrides.length > 0 && <span className="text-amber-600">· {sigOverrides.length} ex.</span>}</span>)
                              })()}</td>
                              <td className="px-3 py-2"><Toggle on={c.performStaging ?? false} onClick={() => toggleItem('cookies', i, 'performStaging')} /></td>
                              <td className="px-3 py-2"><Toggle on={c.maskValueInLogs ?? false} onClick={() => toggleItem('cookies', i, 'maskValueInLogs')} /></td>
                              <td className="px-2 py-2 text-right">
                                <button onClick={() => openCookieModal(i)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit cookie">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                              </td>
                            </tr>,
                            isExp && createPortal(
                              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cancelCookieModal}>
                                <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-[845px] max-h-[90vh] flex flex-col overflow-hidden border border-gray-300" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-between px-6 py-3 border-b border-blue-200 bg-blue-50 flex-shrink-0">
                                    <h3 className="text-sm font-bold text-gray-900">Edit Cookie — <span className="font-mono text-blue-700">{c.name}</span></h3>
                                    <div className="flex items-center gap-2">
                                      <Btn size="sm" onClick={cancelCookieModal}>Cancel</Btn>
                                      <Btn size="sm" variant="primary" onClick={commitCookieModal}>Update</Btn>
                                    </div>
                                  </div>
                                  <div className="overflow-y-auto px-6 py-4">
                                  {!isEnforce && (
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mb-3 pb-3 border-b border-blue-100">
                                      <input type="checkbox" checked={c.attackSignaturesCheck ?? true} onChange={e => updateCookie({ attackSignaturesCheck: e.target.checked })} />
                                      Check attack signatures on this cookie
                                    </label>
                                  )}
                                  {c.type === 'wildcard' && (() => {
                                    const orderDup = cookies.some((other, j) => j !== i && other.type === 'wildcard' && (other.wildcardOrder ?? 0) === (c.wildcardOrder ?? 0))
                                    return (
                                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-blue-100">
                                        <span className="text-xs font-medium text-gray-700">Wildcard Order</span>
                                        <input type="number" min={1} value={c.wildcardOrder ?? 1}
                                          onChange={e => updateCookie({ wildcardOrder: e.target.value === '' ? 1 : Number(e.target.value) })}
                                          className={`w-20 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 text-center ${orderDup ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-gray-200 focus:ring-blue-400'}`} />
                                        {orderDup
                                          ? <span className="text-xs text-red-500">Order already used by another wildcard cookie.</span>
                                          : <span className="text-xs text-gray-400">lower = higher priority</span>
                                        }
                                      </div>
                                    )
                                  })()}
                                  <div className={`grid gap-8 ${isEnforce ? '' : ''}`} style={{gridTemplateColumns: isEnforce ? '1fr' : '35% 65%'}}>
                                    <div className="space-y-3">
                                      {!isEnforce && (
                                        <>
                                          <div className="text-xs font-semibold text-gray-700">Properties</div>
                                          <div>
                                            <div className="text-xs text-gray-700 mb-1.5">Base64 Decoding</div>
                                            <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
                                              {['enabled', 'disabled', 'required'].map(val => (
                                                <button key={val} onClick={() => updateCookie({ decodeValueAsBase64: val })}
                                                  className={`px-3 py-1 capitalize transition-colors ${(c.decodeValueAsBase64 ?? 'disabled') === val ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                                  {val}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                      <div>
                                        <div className="text-xs font-medium text-gray-700 mb-2">Insert Attributes</div>
                                        <div className="space-y-2">
                                          {!isEnforce && (
                                            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                                              <input type="checkbox" className="mt-0.5"
                                                checked={c.accessibleOnlyThroughTheHttpProtocol ?? false}
                                                onChange={e => updateCookie({ accessibleOnlyThroughTheHttpProtocol: e.target.checked })} />
                                              <span>HttpOnly <span className="text-gray-400">(Attribute enforcement will not be checked)</span></span>
                                            </label>
                                          )}
                                          <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                                            <input type="checkbox" className="mt-0.5"
                                              checked={c.securedOverHttpsConnection ?? false}
                                              onChange={e => updateCookie({ securedOverHttpsConnection: e.target.checked })} />
                                            <span>Secure <span className="text-gray-400">(Attribute enforcement will not be checked)</span></span>
                                          </label>
                                          <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                              <input type="checkbox"
                                                checked={sameSiteVal !== 'none'}
                                                onChange={e => updateCookie({ insertSameSiteAttribute: e.target.checked ? 'strict' : 'none' })} />
                                              SameSite
                                            </label>
                                            {sameSiteVal !== 'none' && (
                                              <select value={sameSiteVal}
                                                onChange={e => updateCookie({ insertSameSiteAttribute: e.target.value })}
                                                className="text-xs border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300">
                                                <option value="strict">Strict</option>
                                                <option value="lax">Lax</option>
                                                <option value="none-value">None</option>
                                              </select>
                                            )}
                                          </div>
                                          {showSecureWarning && (
                                            <div className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-1">
                                              <span className="text-amber-500 flex-shrink-0">⚠</span>
                                              <span>Note: Insert Secure attribute should be enabled when Insert Same Site Attribute is set to None.</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {!isEnforce && (
                                      <div>
                                        <div className="text-xs font-semibold text-gray-700 mb-2">
                                          Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}
                                        </div>
                                        {sigOverrides.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {sigOverrides.map((sid, si) => {
                                              const sigId = typeof sid === 'object' ? String(sid.signatureId) : String(sid)
                                              const sigInfo = deviceSigs.find(s => String(s.signatureId) === sigId)
                                              return (
                                                <span key={si} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700" title={sigInfo?.name || ''}>
                                                  <span className="font-mono">{sigId}</span>
                                                  {sigInfo && <span className="text-gray-400 max-w-32 truncate">{sigInfo.name}</span>}
                                                  <button onClick={() => updateCookie({ signatureOverrides: sigOverrides.filter((_, j) => j !== si) })}
                                                    className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                                </span>
                                              )
                                            })}
                                          </div>
                                        )}
                                        <div className="flex gap-1 items-center">
                                          {(() => {
                                            // Restrict to cookie-scope signatures (matchesWithinCookie === true, or unknown scope as fallback).
                                            const cookieCandidates = deviceSigs.filter(s => {
                                              const mw = s.matchesWithin || {}
                                              return Object.keys(mw).length === 0 || mw.matchesWithinCookie === true
                                            })
                                            const existingIds = sigOverrides.map(s => typeof s === 'object' ? String(s.signatureId) : String(s))
                                            return (
                                              <SigIdAutocomplete
                                                candidates={cookieCandidates}
                                                existingIds={existingIds}
                                                onAdd={sig => updateCookie({
                                                  signatureOverrides: [
                                                    ...sigOverrides,
                                                    { signatureId: Number(sig.signatureId), enabled: false, name: sig.name || '', tag: sig.tag || '' },
                                                  ],
                                                })}
                                                width={144}
                                              />
                                            )
                                          })()}
                                          <button type="button"
                                            onClick={() => { setCookieSigModal(i); setCookieSigSearch(''); setCookieSigSelected(new Set(sigOverrides.map(s => typeof s === 'object' ? String(s.signatureId) : String(s)))) }}
                                            className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">
                                            Advanced
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  </div>
                                </div>
                              </div>, document.body, `ck-modal-${i}`)
                          ]
                        })}
                      </tbody>
                    </table>
                  )}
                {/* Pagination — DeviceFleet style */}
                {ckFiltered.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {[10, 20, 50].map((size, idx) => (
                        <span key={size} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <button onClick={() => { setCkPageSize(size); setCkPageNum(1) }}
                            className={`px-1 py-0.5 rounded transition-colors ${ckPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                            {size}
                          </button>
                        </span>
                      ))}
                      
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>Page {ckSafePage} of {ckTotalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setCkPageNum(p => Math.max(1, p - 1))} disabled={ckSafePage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => setCkPageNum(p => Math.min(ckTotalPages, p + 1))} disabled={ckSafePage >= ckTotalPages}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>)
            })()}
          </Card>

          {cookieSigModal !== null && (() => {
            const policySigIds = new Set(signatures.map(s => String(s.signatureId)))
            const cookieScopeSigs = deviceSigs.filter(s => {
              const sid = String(s.signatureId)
              if (!policySigIds.has(sid)) return false
              const mw = s.matchesWithin || {}
              return Object.keys(mw).length === 0 || mw.matchesWithinCookie === true
            })
            const modalSigs = cookieScopeSigs.filter(s => {
              const q = cookieSigSearch.toLowerCase()
              if (q && !String(s.signatureId).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
              if (cookieSigFilters.accuracy !== 'all' && s.accuracy !== cookieSigFilters.accuracy) return false
              if (cookieSigFilters.risk !== 'all' && s.risk !== cookieSigFilters.risk) return false
              if (cookieSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (cookieSigFilters.cve === 'yes')) return false
              return true
            })
            const filtersActive = Object.values(cookieSigFilters).some(v => v !== 'all')
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={cookieSigFilters[k]} onChange={e => setCookieSigFilters(p => ({ ...p, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${cookieSigFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return createPortal(
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setCookieSigModal(null)}>
                <div className="bg-white rounded-lg shadow-xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures — cookie scope</div>
                      <div className="text-xs text-gray-400 mt-0.5">Cookie: <span className="font-mono">{cookies[cookieSigModal]?.name}</span> · {cookieScopeSigs.length} signatures in policy with cookie scope</div>
                    </div>
                    <button onClick={() => setCookieSigModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input autoFocus placeholder="Search by ID or name…" value={cookieSigSearch} onChange={e => setCookieSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {filtersActive && <button onClick={() => setCookieSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                    <span className="ml-auto text-xs text-gray-400">{modalSigs.length} shown · {cookieSigSelected.size} selected</span>
                    {cookieSigSelected.size > 0 && <button onClick={() => setCookieSigSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="p-8 text-center text-xs text-gray-400">No signatures synced yet — sync from the device page first.</div>
                      : modalSigs.length === 0
                      ? <div className="p-8 text-center text-xs text-gray-400">No signatures match the current filters.</div>
                      : (
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50 z-10">
                            <tr className="border-b border-gray-200">
                              <th className="w-8 px-3 py-2">
                                <input type="checkbox"
                                  checked={modalSigs.length > 0 && modalSigs.every(s => cookieSigSelected.has(String(s.signatureId)))}
                                  onChange={e => setCookieSigSelected(prev => { const n = new Set(prev); modalSigs.forEach(s => e.target.checked ? n.add(String(s.signatureId)) : n.delete(String(s.signatureId))); return n })} />
                              </th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">ID</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                              <th className="px-3 py-2 font-medium text-gray-500 text-center">Accuracy</th>
                              <th className="px-3 py-2 font-medium text-gray-500 text-center">Risk</th>
                              <th className="px-3 py-2 font-medium text-gray-500 text-center">CVE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalSigs.slice(0, 300).map(s => {
                              const sid = String(s.signatureId)
                              const sel = cookieSigSelected.has(sid)
                              return (
                                <tr key={sid} className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50 ${sel ? 'bg-blue-50' : ''}`}
                                  onClick={() => setCookieSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })}>
                                  <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={sel} onChange={() => setCookieSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })} />
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-gray-600">{sid}</td>
                                  <td className="px-3 py-1.5 text-gray-800 max-w-xs truncate">{s.name || '—'}</td>
                                  <td className="px-3 py-1.5 text-center capitalize text-gray-500">{s.accuracy || '—'}</td>
                                  <td className={`px-3 py-1.5 text-center capitalize font-medium ${s.risk === 'high' ? 'text-red-600' : s.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{s.risk || '—'}</td>
                                  <td className="px-3 py-1.5 text-center">{s.hasCve ? <span className="text-orange-500 font-medium">CVE</span> : <span className="text-gray-300">—</span>}</td>
                                </tr>
                              )
                            })}
                            {modalSigs.length > 300 && <tr><td colSpan={6} className="px-3 py-2 text-center text-xs text-gray-400">Showing first 300 — refine filters to see more</td></tr>}
                          </tbody>
                        </table>
                      )
                    }
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
                    <button onClick={() => setCookieSigModal(null)} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
                    <button onClick={() => {
                      const arr = [...editedPol.cookies]
                      arr[cookieSigModal] = { ...arr[cookieSigModal], signatureOverrides: [...cookieSigSelected] }
                      setTop('cookies', arr); setUnsaved(true)
                      setCookieSigModal(null)
                    }} className="text-xs px-4 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 font-medium">
                      Apply ({cookieSigSelected.size})
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          })()}
        </div>
      )}

      {/* URL sig modal — outside all tab blocks so it renders regardless of active tab */}
      {urlSigModal !== null && (() => {
        const u = urls[urlSigModal]
        const policySigIds = new Set(signatures.map(s => String(s.signatureId)))
        const urlScopeSigs = deviceSigs.filter(s => {
          const sid = String(s.signatureId)
          if (!policySigIds.has(sid)) return false
          const mw = s.matchesWithin || {}
          // BIG-IP calls the URL/URI scope `matchesWithinUri`.
          return Object.keys(mw).length === 0 || mw.matchesWithinUri === true
        })
        const modalSigs = urlScopeSigs.filter(s => {
          const q = urlSigSearch.toLowerCase()
          if (q && !String(s.signatureId).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (urlSigFilters.accuracy !== 'all' && s.accuracy !== urlSigFilters.accuracy) return false
          if (urlSigFilters.risk !== 'all' && s.risk !== urlSigFilters.risk) return false
          if (urlSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (urlSigFilters.cve === 'yes')) return false
          return true
        })
        const filtersActive = Object.values(urlSigFilters).some(v => v !== 'all')
        const FSel = ({ label, k, opts }) => (
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">{label}</span>
            <select value={urlSigFilters[k]} onChange={e => setUrlSigFilters(p => ({ ...p, [k]: e.target.value }))}
              className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${urlSigFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
              <option value="all">All</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )
        return createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setUrlSigModal(null)}>
            <div className="bg-white rounded-lg shadow-xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Exclude signatures — URL scope</div>
                  <div className="text-xs text-gray-400 mt-0.5">URL: <span className="font-mono">{u?.name}</span> · {urlScopeSigs.length} signatures in policy with URL scope</div>
                </div>
                <button onClick={() => setUrlSigModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                <input autoFocus placeholder="Search by ID or name…" value={urlSigSearch} onChange={e => setUrlSigSearch(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                {filtersActive && <button onClick={() => setUrlSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                <span className="ml-auto text-xs text-gray-400">{modalSigs.length} shown · {urlSigSelected.size} selected</span>
                {urlSigSelected.size > 0 && <button onClick={() => setUrlSigSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
              </div>
              <div className="overflow-y-auto flex-1">
                {deviceSigs.length === 0
                  ? <div className="p-8 text-center text-xs text-gray-400">No signatures synced yet — sync from the device page first.</div>
                  : modalSigs.length === 0
                  ? <div className="p-8 text-center text-xs text-gray-400">No signatures match the current filters.</div>
                  : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-200">
                          <th className="w-8 px-3 py-2">
                            <input type="checkbox"
                              checked={modalSigs.length > 0 && modalSigs.every(s => urlSigSelected.has(String(s.signatureId)))}
                              onChange={e => setUrlSigSelected(prev => { const n = new Set(prev); modalSigs.forEach(s => e.target.checked ? n.add(String(s.signatureId)) : n.delete(String(s.signatureId))); return n })} />
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">ID</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-center">Accuracy</th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-center">Risk</th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-center">CVE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalSigs.slice(0, 300).map(s => {
                          const sid = String(s.signatureId)
                          const sel = urlSigSelected.has(sid)
                          return (
                            <tr key={sid} className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50 ${sel ? 'bg-blue-50' : ''}`}
                              onClick={() => setUrlSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })}>
                              <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={sel} onChange={() => setUrlSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })} />
                              </td>
                              <td className="px-3 py-1.5 font-mono text-gray-600">{sid}</td>
                              <td className="px-3 py-1.5 text-gray-800 max-w-xs truncate">{s.name || '—'}</td>
                              <td className="px-3 py-1.5 text-center capitalize text-gray-500">{s.accuracy || '—'}</td>
                              <td className={`px-3 py-1.5 text-center capitalize font-medium ${s.risk === 'high' ? 'text-red-600' : s.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{s.risk || '—'}</td>
                              <td className="px-3 py-1.5 text-center">{s.hasCve ? <span className="text-orange-500 font-medium">CVE</span> : <span className="text-gray-300">—</span>}</td>
                            </tr>
                          )
                        })}
                        {modalSigs.length > 300 && <tr><td colSpan={6} className="px-3 py-2 text-center text-xs text-gray-400">Showing first 300 — refine filters to see more</td></tr>}
                      </tbody>
                    </table>
                  )
                }
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
                <button onClick={() => setUrlSigModal(null)} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
                <button onClick={() => {
                  const arr = [...editedPol.urls]
                  arr[urlSigModal] = { ...arr[urlSigModal], signatureOverrides: [...urlSigSelected] }
                  setTop('urls', arr); setUnsaved(true)
                  setUrlSigModal(null)
                }} className="text-xs px-4 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 font-medium">
                  Apply ({urlSigSelected.size})
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      })()}

      {/* Param sig modal — outside all tab blocks */}
      {paramSigModal !== null && (() => {
        const p = parameters[paramSigModal]
        const policySigIds = new Set(signatures.map(s => String(s.signatureId)))
        const paramScopeSigs = deviceSigs.filter(s => {
          const sid = String(s.signatureId)
          if (!policySigIds.has(sid)) return false
          const mw = s.matchesWithin || {}
          return Object.keys(mw).length === 0 || mw.matchesWithinParameter === true
        })
        const modalSigs = paramScopeSigs.filter(s => {
          const q = paramSigSearch.toLowerCase()
          if (q && !String(s.signatureId).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (paramSigFilters.accuracy !== 'all' && s.accuracy !== paramSigFilters.accuracy) return false
          if (paramSigFilters.risk !== 'all' && s.risk !== paramSigFilters.risk) return false
          if (paramSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (paramSigFilters.cve === 'yes')) return false
          return true
        })
        const filtersActive = Object.values(paramSigFilters).some(v => v !== 'all')
        const FSel = ({ label, k, opts }) => (
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">{label}</span>
            <select value={paramSigFilters[k]} onChange={e => setParamSigFilters(pf => ({ ...pf, [k]: e.target.value }))}
              className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${paramSigFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
              <option value="all">All</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )
        return createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setParamSigModal(null)}>
            <div className="bg-white rounded-lg shadow-xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Exclude signatures — parameter scope</div>
                  <div className="text-xs text-gray-400 mt-0.5">Parameter: <span className="font-mono">{p?.name}</span> · {paramScopeSigs.length} signatures in policy with parameter scope</div>
                </div>
                <button onClick={() => setParamSigModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                <input autoFocus placeholder="Search by ID or name…" value={paramSigSearch} onChange={e => setParamSigSearch(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                {filtersActive && <button onClick={() => setParamSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                <span className="ml-auto text-xs text-gray-400">{modalSigs.length} shown · {paramSigSelected.size} selected</span>
                {paramSigSelected.size > 0 && <button onClick={() => setParamSigSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
              </div>
              <div className="overflow-y-auto flex-1">
                {deviceSigs.length === 0
                  ? <div className="p-8 text-center text-xs text-gray-400">No signatures synced yet.</div>
                  : modalSigs.length === 0
                  ? <div className="p-8 text-center text-xs text-gray-400">No signatures match the current filters.</div>
                  : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-200">
                          <th className="w-8 px-3 py-2">
                            <input type="checkbox"
                              checked={modalSigs.length > 0 && modalSigs.every(s => paramSigSelected.has(String(s.signatureId)))}
                              onChange={e => setParamSigSelected(prev => { const n = new Set(prev); modalSigs.forEach(s => e.target.checked ? n.add(String(s.signatureId)) : n.delete(String(s.signatureId))); return n })} />
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">ID</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-center">Accuracy</th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-center">Risk</th>
                          <th className="px-3 py-2 font-medium text-gray-500 text-center">CVE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalSigs.slice(0, 300).map(s => {
                          const sid = String(s.signatureId)
                          const sel = paramSigSelected.has(sid)
                          return (
                            <tr key={sid} className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50 ${sel ? 'bg-blue-50' : ''}`}
                              onClick={() => setParamSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })}>
                              <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={sel} onChange={() => setParamSigSelected(prev => { const n = new Set(prev); sel ? n.delete(sid) : n.add(sid); return n })} />
                              </td>
                              <td className="px-3 py-1.5 font-mono text-gray-600">{sid}</td>
                              <td className="px-3 py-1.5 text-gray-800 max-w-xs truncate">{s.name || '—'}</td>
                              <td className="px-3 py-1.5 text-center capitalize text-gray-500">{s.accuracy || '—'}</td>
                              <td className={`px-3 py-1.5 text-center capitalize font-medium ${s.risk === 'high' ? 'text-red-600' : s.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{s.risk || '—'}</td>
                              <td className="px-3 py-1.5 text-center">{s.hasCve ? <span className="text-orange-500 font-medium">CVE</span> : <span className="text-gray-300">—</span>}</td>
                            </tr>
                          )
                        })}
                        {modalSigs.length > 300 && <tr><td colSpan={6} className="px-3 py-2 text-center text-xs text-gray-400">Showing first 300 — refine filters to see more</td></tr>}
                      </tbody>
                    </table>
                  )
                }
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
                <button onClick={() => setParamSigModal(null)} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
                <button onClick={() => {
                  const arr = [...editedPol.parameters]
                  const prev = arr[paramSigModal]?.signatureOverrides || []
                  // Preserve per-signature metadata (enabled, name, tag) from any previously-stored
                  // override for this ID, then default the rest from the device catalog.
                  const prevById = new Map(prev.map(e => {
                    const sid = typeof e === 'object' ? String(e.signatureId ?? e.id) : String(e)
                    return [sid, typeof e === 'object' ? e : { signatureId: Number(sid), enabled: false, name: '', tag: '' }]
                  }))
                  const overrides = [...paramSigSelected].map(sid => {
                    if (prevById.has(sid)) return prevById.get(sid)
                    const dsig = deviceSigs.find(s => String(s.signatureId) === sid)
                    return { signatureId: Number(sid), enabled: false, name: dsig?.name || '', tag: dsig?.tag || '' }
                  })
                  arr[paramSigModal] = { ...arr[paramSigModal], signatureOverrides: overrides }
                  setTop('parameters', arr); setUnsaved(true)
                  setParamSigModal(null)
                }} className="text-xs px-4 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 font-medium">
                  Apply ({paramSigSelected.size})
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      })()}

      {/* ── PARAMETERS ── */}
      {activeTab === 'parameters' && (
        <Card>
          <SectionHeader title="Parameters" sub={`${parameters.length} entries`}
            onClick={() => toggleSection('parameters')} collapsed={collapsed.parameters}
            action={
              <div className="relative">
                <button ref={pmAddBtnRef} onClick={() => {
                  const r = pmAddBtnRef.current?.getBoundingClientRect()
                  if (r) setPmAddPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                  setPmAddOpen(v => !v); setPmAddName('')
                }} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                  Add <span className="text-[10px]">▾</span>
                </button>
                {pmAddOpen && pmAddPos && createPortal(
                  <div style={{ position: 'fixed', top: pmAddPos.top, right: pmAddPos.right, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded shadow-lg w-60 p-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">New Parameter</div>
                    {(() => {
                      const nextWildcardOrder = Math.max(0, ...parameters.filter(p => p.type === 'wildcard').map(p => p.wildcardOrder || 0)) + 1
                      const isDup = !!pmAddName.trim() && parameters.some(p => p.name === pmAddName.trim() && p.type === pmAddType)
                      return (
                        <form onSubmit={e => {
                          e.preventDefault()
                          const name = pmAddName.trim()
                          if (!name || isDup) return
                          const entry = { name, type: pmAddType, level: 'global', parameterLocation: 'any', valueType: 'auto-detect', attackSignaturesCheck: true, performStaging: false }
                          if (pmAddType === 'wildcard') entry.wildcardOrder = nextWildcardOrder
                          setTop('parameters', [...editedPol.parameters, entry])
                          setUnsaved(true)
                          setPmAddOpen(false)
                          setPmAddName('')
                          setPmAddType('explicit')
                        }} className="flex flex-col gap-2">
                          <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                            {['explicit', 'wildcard'].map(t => (
                              <button key={t} type="button" onClick={() => setPmAddType(t)}
                                className={`flex-1 px-2 py-1.5 capitalize transition-colors ${pmAddType === t ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                          <input value={pmAddName} onChange={e => setPmAddName(e.target.value)}
                            placeholder={pmAddType === 'wildcard' ? 'e.g. search_*' : 'e.g. username'}
                            autoFocus
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                          {isDup && <span className="text-xs text-red-500">Parameter already exists.</span>}
                          <button type="submit" disabled={!pmAddName.trim() || isDup}
                            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                            Add Parameter
                          </button>
                        </form>
                      )
                    })()}
                  </div>,
                  document.body
                )}
              </div>
            }
          />
          {!collapsed.parameters && (parameters.length === 0
            ? <div className="p-4 text-xs text-gray-400">No parameters configured.</div>
            : (() => {
              const vtLabelOf = (p) => PARAM_VALUE_TYPES.find(t => t.value === (p.valueType || 'auto-detect'))?.label || (p.valueType || 'auto-detect')
              // Whether a parameter's value type/data type exposes attack signatures (mirrors the row's SUBTABS logic)
              const paramHasSigs = (p) => {
                const vt = p.valueType || 'auto-detect'
                const subs = paramSubTabsFor(vt)
                if (!subs.some(([id]) => id === 'attack-sigs')) return false
                const showsDataTypePicker = subs.some(([id]) => id === 'data-type') && vt !== 'auto-detect'
                const dt = showsDataTypePicker ? (p.dataType || 'alpha-numeric') : 'alpha-numeric'
                return !['email', 'phone', 'boolean', 'integer', 'decimal'].includes(dt)
              }
              // 1. Filter by search across name/type/level/location/value-type
              const q = paramSearch.trim().toLowerCase()
              let pmList = parameters.map((p, i) => ({ p, i }))
              if (q) pmList = pmList.filter(({ p }) =>
                (p.name || '').toLowerCase().includes(q)
                || (p.type || 'explicit').toLowerCase().includes(q)
                || (p.level || 'global').toLowerCase().includes(q)
                || (p.parameterLocation || 'any').toLowerCase().includes(q)
                || vtLabelOf(p).toLowerCase().includes(q))
              // 2. Sort — explicit column sort if chosen, else default (wildcards first by order, then name)
              const keyVal = ({ p }) => {
                switch (paramSortKey) {
                  case 'name': return (p.name || '').toLowerCase()
                  case 'type': return p.type || 'explicit'
                  case 'level': return p.level || 'global'
                  case 'location': return p.parameterLocation || 'any'
                  case 'valueType': return vtLabelOf(p).toLowerCase()
                  case 'attackSigs': {
                    // N/A (-1) < Disabled (0) < Enabled (1+, ordered by number excluded)
                    if (!paramHasSigs(p)) return -1
                    if (!(p.attackSignaturesCheck ?? true)) return 0
                    return 1 + (p.signatureOverrides || []).length
                  }
                  case 'staging': return (p.performStaging ?? false) ? 1 : 0
                  default: return ''
                }
              }
              if (paramSortKey) {
                const dir = paramSortDir === 'desc' ? -1 : 1
                pmList = [...pmList].sort((a, b) => { const av = keyVal(a), bv = keyVal(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
              } else {
                pmList = [...pmList].sort((a, b) => {
                  const aw = a.p.type === 'wildcard', bw = b.p.type === 'wildcard'
                  if (aw && !bw) return -1
                  if (!aw && bw) return 1
                  if (aw && bw) return (a.p.wildcardOrder ?? 0) - (b.p.wildcardOrder ?? 0)
                  return (a.p.name || '').localeCompare(b.p.name || '')
                })
              }
              // 3. Paginate
              const total = pmList.length
              const pageCount = Math.max(1, Math.ceil(total / paramPageSize))
              const safePage = Math.min(paramPage, pageCount)
              const pageRows = pmList.slice((safePage - 1) * paramPageSize, safePage * paramPageSize)
              const pageIdxs = pageRows.map(r => r.i)
              const allOnPageSelected = pageIdxs.length > 0 && pageIdxs.every(i => paramSelected.has(i))
              const SORT_COLS = [['name', 'Name', 'w-56'], ['type', 'Type', ''], ['level', 'Level', ''], ['location', 'Location', ''], ['valueType', 'Value Type', ''], ['attackSigs', 'Attack sigs', ''], ['staging', 'Staging', '']]
              return (
              <div>
                {/* Toolbar: search + bulk delete */}
                <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100">
                  <div className="relative">
                    <input value={paramSearch} onChange={e => { setParamSearch(e.target.value); setParamPage(1) }}
                      placeholder="Search parameters…"
                      className="text-xs border border-gray-200 rounded pl-7 pr-2 py-1 w-64 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <svg className="w-3.5 h-3.5 absolute left-2 top-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                  {paramSelected.size > 0 && (
                    <div className="relative inline-flex">
                      <button onClick={bulkDeleteParams}
                        className="text-xs px-2.5 py-1 rounded-l bg-red-600 text-white hover:bg-red-700 border border-red-600 font-medium">
                        Delete ({paramSelected.size})
                      </button>
                      <button onClick={() => setPmDeleteMenuOpen(o => !o)} title="More delete options"
                        className="text-xs px-1.5 py-1 rounded-r bg-red-600 text-white hover:bg-red-700 border-y border-r border-red-600 border-l border-l-red-400">
                        ▾
                      </button>
                      {pmDeleteMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-0" onClick={() => setPmDeleteMenuOpen(false)} />
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
                            <button onClick={deleteAllParams}
                              className="block w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 whitespace-nowrap">
                              Delete All ({parameters.length})
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-8 px-2 py-2 text-center">
                    <input type="checkbox" checked={allOnPageSelected}
                      onChange={() => setParamSelected(s => { const n = new Set(s); if (allOnPageSelected) pageIdxs.forEach(i => n.delete(i)); else pageIdxs.forEach(i => n.add(i)); return n })} />
                  </th>
                  {SORT_COLS.map(([key, label, w]) => (
                    <th key={key} onClick={() => sortParamBy(key)}
                      className={`text-left px-3 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 group ${w}`}>
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {paramSortKey === key ? (
                          <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d={paramSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="w-12 px-2 py-2 text-right font-medium text-gray-500">Edit</th>
                </tr></thead>
                <tbody>
                  {pageRows.map(({ p, i }) => {
                    const isExp = expandedParam === i
                    const updateParam = (patch) => {
                      const arr = [...editedPol.parameters]
                      arr[i] = { ...arr[i], ...patch }
                      setTop('parameters', arr); setUnsaved(true)
                    }
                    const vt = p.valueType || 'auto-detect'
                    const showsDataTypePicker = paramSubTabsFor(vt).some(([id]) => id === 'data-type') && vt !== 'auto-detect'
                    const dt = showsDataTypePicker ? (p.dataType || 'alpha-numeric') : 'alpha-numeric'
                    const DT_ONLY_TAB = ['email', 'phone', 'boolean', 'integer', 'decimal']
                    const DT_HIDE_LENGTHS = ['boolean']
                    const DT_HIDE_REGEX = ['email', 'phone', 'uri', 'boolean', 'integer', 'decimal', 'binary']
                    const DT_HIDE_BASE64 = ['email', 'phone', 'uri', 'boolean', 'integer', 'decimal']
                    const DT_SHOW_ENUM = !['email', 'phone', 'uri', 'binary'].includes(dt)
                    const SUBTABS = paramSubTabsFor(vt).filter(([id]) => {
                      if (DT_ONLY_TAB.includes(dt)) return id === 'data-type'
                      if (dt === 'binary') return id !== 'value-meta'
                      return true
                    })

                    const paramCharDefault = (hex) => PT_ALL_CHARS.find(c => c.hex === hex)?.defaultAllowed ?? true
                    const getParamCharAllowed = (csType, hex) => {
                      const entry = (pol['character-sets'] || []).find(e => e.characterSetType === csType)?.characterSet?.find(c => c.metachar === hex)
                      if (entry) return entry.isAllowed
                      return paramCharDefault(hex)
                    }
                    const setParamChar = (csType, hex, allowed) => {
                      const cs = pol['character-sets'] || []
                      const idx = cs.findIndex(e => e.characterSetType === csType)
                      const baseSet = idx === -1
                        ? PT_META_DEFAULTS.map(m => ({ ...m }))
                        : [...(cs[idx].characterSet || PT_META_DEFAULTS.map(m => ({ ...m })))]
                      const charIdx = baseSet.findIndex(c => c.metachar === hex)
                      const newSet = charIdx === -1
                        ? [...baseSet, { metachar: hex, isAllowed: allowed }]
                        : baseSet.map((c, j) => j === charIdx ? { ...c, isAllowed: allowed } : c)
                      const newCs = idx === -1
                        ? [...cs, { characterSetType: csType, characterSet: newSet }]
                        : cs.map((e, j) => j === idx ? { ...e, characterSet: newSet } : e)
                      setTop('character-sets', newCs); setUnsaved(true)
                    }
                    const restoreParamChars = (csType) => {
                      setTop('character-sets', (pol['character-sets'] || []).filter(e => e.characterSetType !== csType)); setUnsaved(true)
                    }
                    const MetaCharPanel = ({ csType, enabledField, label }) => {
                      const enabled = p[enabledField] ?? false
                      const view = paramMetaView
                      const allDisplay = view==='meta-only' ? PT_ALL_CHARS.filter(c=>c.isMeta)
                        : view==='allowed' ? PT_ALL_CHARS.filter(c=>!c.disabled && getParamCharAllowed(csType, c.hex))
                        : view==='disallowed' ? PT_ALL_CHARS.filter(c=>!c.disabled && !getParamCharAllowed(csType, c.hex))
                        : PT_ALL_CHARS
                      const colSize = Math.ceil(allDisplay.length / 4)
                      const cols = [0,1,2,3].map(ci => allDisplay.slice(ci*colSize, (ci+1)*colSize))
                      return (
                        <div>
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mb-3">
                            <input type="checkbox" checked={enabled} onChange={e => updateParam({ [enabledField]: e.target.checked })} />
                            {label}
                          </label>
                          {enabled && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">View</span>
                                  <select value={view} onChange={e => setParamMetaView(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                    <option value="all">All characters</option>
                                    <option value="allowed">Allowed characters</option>
                                    <option value="disallowed">Disallowed characters</option>
                                    <option value="meta-only">Meta characters only</option>
                                  </select>
                                </div>
                                <button className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
                                  onClick={() => restoreParamChars(csType)}>Restore Defaults</button>
                              </div>
                              <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
                                {cols.map((col, ci) => (
                                  <div key={ci} className={`flex-1 ${ci<3?'border-r border-gray-200':''}`}>
                                    <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                                      {['Hex','Char','State'].map(h => <div key={h} className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">{h}</div>)}
                                    </div>
                                    {col.map(ch => {
                                      const allowed = getParamCharAllowed(csType, ch.hex)
                                      // Orange-highlight any entry whose state differs from its default.
                                      const modified = !ch.disabled && allowed !== ch.defaultAllowed
                                      return (
                                        <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified?'bg-orange-50':'hover:bg-gray-50'}`}>
                                          <div className={`px-2 py-1 text-[10px] font-mono text-center ${modified?'text-orange-600':'text-blue-600'}`}>{ch.hex}</div>
                                          <div className={`px-2 py-1 text-[10px] text-center font-medium ${modified?'text-orange-700':'text-gray-700'}`}>{ch.name}</div>
                                          <div className="px-1 py-0.5 text-center">
                                            {ch.disabled
                                              ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full"><option>Disallow</option></select>
                                              : <select value={allowed?'allow':'disallow'} onChange={e => setParamChar(csType, ch.hex, e.target.value==='allow')}
                                                  className={`text-[10px] border rounded px-1 py-0 w-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${modified?'border-orange-300 bg-orange-50':'border-gray-300 bg-white'}`}>
                                                  <option value="allow">Allow</option>
                                                  <option value="disallow">Disallow</option>
                                                </select>
                                            }
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }

                    return [
                      <tr key={i}
                        className={`border-b border-gray-100 hover:bg-blue-50 ${paramSelected.has(i)?'bg-blue-50':''} ${isExp?'bg-blue-100':''}`}>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={paramSelected.has(i)} onChange={() => toggleParamSelected(i)} />
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-800 w-56">{p.name}</td>
                        <td className="px-3 py-2"><Badge color={p.type==='wildcard'?'blue':'gray'}>{p.type||'explicit'}</Badge></td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{p.level||'global'}</td>
                        <td className="px-3 py-2 text-gray-500">{p.parameterLocation||'any'}</td>
                        <td className="px-3 py-2 text-gray-500">{PARAM_VALUE_TYPES.find(t=>t.value===vt)?.label||vt}</td>
                        <td className="px-3 py-2">{(() => {
                          const hasSigs = SUBTABS.some(([id]) => id === 'attack-sigs')
                          if (!hasSigs) return <span className="text-gray-300">N/A</span>
                          if (!(p.attackSignaturesCheck ?? true)) return (
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          )
                          const excluded = (p.signatureOverrides || []).length
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              {excluded > 0 && <span className="text-amber-600">· {excluded} ex.</span>}
                            </span>
                          )
                        })()}</td>
                        <td className="px-3 py-2"><Toggle on={p.performStaging??false} onClick={()=>toggleItem('parameters',i,'performStaging')} /></td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => openParamModal(i, SUBTABS[0] && SUBTABS[0][0])}
                            className="text-gray-400 hover:text-blue-600 p-1" title="Edit parameter">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                        </td>
                      </tr>,
                      isExp && createPortal(
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cancelParamModal}>
                          <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-300" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-6 py-3 border-b border-blue-200 bg-blue-50 flex-shrink-0">
                              <h3 className="text-sm font-bold text-gray-900">Edit Parameter — <span className="font-mono text-blue-700">{p.name}</span></h3>
                              <div className="flex items-center gap-2">
                                <Btn size="sm" onClick={cancelParamModal}>Cancel</Btn>
                                <Btn size="sm" variant="primary" onClick={commitParamModal}>Update</Btn>
                              </div>
                            </div>
                            <div className="overflow-y-auto bg-gray-50">
                            {/* Properties */}
                            <div className="px-6 py-4 border-b border-gray-200">
                              <table className="w-full text-xs">
                                <tbody>
                                  {p.type === 'wildcard' && (() => {
                                    const orderDup = parameters.some((other, j) => j !== i && other.type === 'wildcard' && (other.wildcardOrder ?? 0) === (p.wildcardOrder ?? 0))
                                    return (
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-52">Wildcard Order</td>
                                        <td className="py-2 flex items-center gap-2">
                                          <input type="number" min={1} value={p.wildcardOrder ?? 1}
                                            onChange={e => updateParam({ wildcardOrder: e.target.value === '' ? 1 : Number(e.target.value) })}
                                            className={`w-20 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 text-center ${orderDup ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-gray-200 focus:ring-blue-400'}`} />
                                          {orderDup
                                            ? <span className="text-xs text-red-500">Order already used by another wildcard parameter.</span>
                                            : <span className="text-xs text-gray-400">lower = higher priority</span>
                                          }
                                        </td>
                                      </tr>
                                    )
                                  })()}
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium w-52">Level</td>
                                    <td className="py-2 flex items-center gap-2">
                                      <select value={p.level||'global'} onChange={e=>{const lv=e.target.value;updateParam({level:lv,url:lv==='global'?undefined:p.url});if(lv==='url'){setParamUrlSearch(p.url?.name||'');setParamUrlOpen(false)}}}
                                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                        <option value="global">Global</option>
                                        <option value="url">URL</option>
                                      </select>
                                      {(p.level||'global')==='url' && (
                                        <div className="relative">
                                          <input
                                            value={paramUrlOpen ? paramUrlSearch : (p.url?.name||'')}
                                            onChange={e=>{setParamUrlSearch(e.target.value);setParamUrlOpen(true)}}
                                            onFocus={()=>{setParamUrlSearch(p.url?.name||'');setParamUrlOpen(true)}}
                                            onBlur={()=>setTimeout(()=>setParamUrlOpen(false),150)}
                                            placeholder="Type to search URLs…"
                                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 w-56"
                                          />
                                          {paramUrlOpen && (() => {
                                            const q = paramUrlSearch.toLowerCase()
                                            const filtered = urls.filter(u=>!q||u.name.toLowerCase().includes(q))
                                            return filtered.length > 0 ? (
                                              <div className="absolute left-0 top-full mt-0.5 z-10 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto w-64">
                                                {filtered.map((u,ui)=>(
                                                  <button key={ui} type="button"
                                                    onMouseDown={()=>{updateParam({url:{name:u.name,type:u.type||'explicit',protocol:u.protocol||'http',method:u.method||'*'}});setParamUrlSearch(u.name);setParamUrlOpen(false)}}
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2">
                                                    <span className="text-gray-400 font-mono flex-shrink-0">[{(u.protocol||'http').toUpperCase()}]</span>
                                                    <span className="text-gray-800 font-mono">{u.name}</span>
                                                  </button>
                                                ))}
                                              </div>
                                            ) : null
                                          })()}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium w-52">Location</td>
                                    <td className="py-2">
                                      <select value={p.parameterLocation||'any'} onChange={e=>updateParam({parameterLocation:e.target.value})}
                                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                        <option value="any">Any</option>
                                        <option value="query">Query String</option>
                                        <option value="form-data">Form Data</option>
                                        <option value="path" disabled>Path</option>
                                        <option value="header">Header</option>
                                        <option value="cookie">Cookie</option>
                                      </select>
                                    </td>
                                  </tr>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium w-52">Is Mandatory</td>
                                    <td className="py-2"><label className="flex items-center gap-2 cursor-pointer text-gray-700"><input type="checkbox" checked={p.mandatory??false} onChange={e=>updateParam({mandatory:e.target.checked})} />Enabled</label></td>
                                  </tr>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium w-52">Allow Empty Value</td>
                                    <td className="py-2"><label className="flex items-center gap-2 cursor-pointer text-gray-700"><input type="checkbox" checked={p.allowEmptyValue??false} onChange={e=>updateParam({allowEmptyValue:e.target.checked})} />Enabled</label></td>
                                  </tr>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium">Allow Repeated Occurrences</td>
                                    <td className="py-2"><label className="flex items-center gap-2 cursor-pointer text-gray-700"><input type="checkbox" checked={p.allowRepeatedParameterName??false} onChange={e=>updateParam({allowRepeatedParameterName:e.target.checked})} />Enabled</label></td>
                                  </tr>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium">Mask Value in Logs</td>
                                    <td className="py-2"><label className="flex items-center gap-2 cursor-pointer text-gray-700"><input type="checkbox" checked={p.sensitiveParameter??false} onChange={e=>updateParam({sensitiveParameter:e.target.checked})} />Enabled</label></td>
                                  </tr>
                                  <tr>
                                    <td className="py-2 pr-4 text-gray-500 font-medium">Parameter Value Type</td>
                                    <td className="py-2">
                                      <select value={vt} onChange={e=>{
                                        const nv=e.target.value
                                        // Changing the value type resets value-type-specific config back to
                                        // defaults so stale values (max length, array limits, etc.) don't bleed
                                        // across from the previous type. Meta characters
                                        // (metacharsOnParameterValueCheck) and attack signatures
                                        // (attackSignaturesCheck / signatureOverrides) are intentionally KEPT.
                                        updateParam({
                                          valueType: nv,
                                          dataType: undefined,
                                          checkMaxValueLength: undefined, maximumLength: undefined,
                                          checkMinValueLength: undefined, minimumLength: undefined,
                                          enableRegularExpression: undefined, regularExpression: undefined,
                                          isBase64: undefined,
                                          disallowFileUploadOfExecutables: undefined,
                                          hostNameRepresentation: undefined,
                                          parameterEnumValues: undefined,
                                          checkMinValue: undefined, exclusiveMin: undefined, minimumValue: undefined,
                                          checkMaxValue: undefined, exclusiveMax: undefined, maximumValue: undefined,
                                          checkMultipleOfValue: undefined, multipleOf: undefined,
                                          staticValues: undefined,
                                          arraySerializationFormat: undefined,
                                          checkMinItemsInArray: undefined, minItemsInArray: undefined,
                                          checkMaxItemsInArray: undefined, maxItemsInArray: undefined,
                                          arrayUniqueItemsCheck: undefined,
                                        })
                                        setParamSubTab(paramSubTabsFor(nv)[0][0])
                                      }}
                                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                        {PARAM_VALUE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                                      </select>
                                    </td>
                                  </tr>
                                  {vt==='array' && (
                                    <tr>
                                      <td className="py-2 pr-4 text-gray-500 font-medium">Serialization Format</td>
                                      <td className="py-2">
                                        <select value={p.arraySerializationFormat||'csv'} onChange={e=>updateParam({arraySerializationFormat:e.target.value})}
                                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                          {!ARRAY_SERIALIZATION_FORMATS.some(f => f.value === (p.arraySerializationFormat||'csv')) && (
                                            // Keep whatever the device sent so saving can't silently rewrite it.
                                            <option value={p.arraySerializationFormat}>{p.arraySerializationFormat}</option>
                                          )}
                                          {ARRAY_SERIALIZATION_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            {/* Sub-tab bar */}
                            {SUBTABS.length > 0 && (
                              <div className="flex border-b border-gray-200 bg-white px-4">
                                {SUBTABS.map(([id,label])=>(
                                  <button key={id} onClick={()=>setParamSubTab(id)}
                                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${paramSubTab===id?'border-blue-500 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Sub-tab content */}
                            {SUBTABS.length > 0 && <div className="px-6 py-6 bg-white min-h-32 border-b border-gray-200">

                              {paramSubTab==='data-type' && (
                                <table className="w-full text-xs">
                                  <tbody>
                                    {vt==='array' && (<>
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Minimum Number of Items</td>
                                        <td className="py-2 flex items-center gap-3">
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`minnoi-${i}`} checked={!p.checkMinItemsInArray} onChange={()=>updateParam({checkMinItemsInArray:false})} />Any</label>
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`minnoi-${i}`} checked={!!p.checkMinItemsInArray} onChange={()=>updateParam({checkMinItemsInArray:true})} />Value:</label>
                                          <input type="number" value={p.minItemsInArray??1} disabled={!p.checkMinItemsInArray} onChange={e=>updateParam({minItemsInArray:parseInt(e.target.value)||1})}
                                            className="w-16 text-xs border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                        </td>
                                      </tr>
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Maximum Number of Items</td>
                                        <td className="py-2 flex items-center gap-3">
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`maxnoi-${i}`} checked={!p.checkMaxItemsInArray} onChange={()=>updateParam({checkMaxItemsInArray:false})} />Any</label>
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`maxnoi-${i}`} checked={!!p.checkMaxItemsInArray} onChange={()=>updateParam({checkMaxItemsInArray:true})} />Value:</label>
                                          <input type="number" value={p.maxItemsInArray??100} disabled={!p.checkMaxItemsInArray} onChange={e=>updateParam({maxItemsInArray:parseInt(e.target.value)||1})}
                                            className="w-16 text-xs border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                        </td>
                                      </tr>
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Unique Items</td>
                                        <td className="py-2">
                                          <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="checkbox" checked={p.arrayUniqueItemsCheck??false} onChange={e=>updateParam({arrayUniqueItemsCheck:e.target.checked})} />
                                            Enable
                                          </label>
                                        </td>
                                      </tr>
                                    </>)}
                                    {vt!=='auto-detect' && (
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Data Type</td>
                                        <td className="py-2">
                                          <select value={p.dataType||'alpha-numeric'} onChange={e=>updateParam({
                                            // Reset data-type-specific config so values don't bleed across
                                            // data types (e.g. a length set for alpha-numeric carrying into
                                            // integer's min/max value). valueType, attack signatures and array
                                            // limits are value-type-level, so they intentionally persist here.
                                            dataType: e.target.value,
                                            checkMaxValueLength: undefined, maximumLength: undefined,
                                            checkMinValueLength: undefined, minimumLength: undefined,
                                            enableRegularExpression: undefined, regularExpression: undefined,
                                            isBase64: undefined,
                                            disallowFileUploadOfExecutables: undefined,
                                            hostNameRepresentation: undefined,
                                            parameterEnumValues: undefined,
                                            checkMinValue: undefined, exclusiveMin: undefined, minimumValue: undefined,
                                            checkMaxValue: undefined, exclusiveMax: undefined, maximumValue: undefined,
                                            checkMultipleOfValue: undefined, multipleOf: undefined,
                                          })}
                                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                            {(vt==='array'
                                              ? PARAM_DATA_TYPES.filter(t=>['alpha-numeric','decimal','integer','boolean'].includes(t.value))
                                              : PARAM_DATA_TYPES
                                            ).map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                                          </select>
                                        </td>
                                      </tr>
                                    )}
                                    {(dt==='integer'||dt==='decimal') && (<>
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Minimum Value</td>
                                        <td className="py-2 flex items-center gap-2">
                                          <select value={!p.checkMinValue?'any':p.exclusiveMin?'gt':'gte'}
                                            onChange={e=>{const v=e.target.value;updateParam(v==='any'?{checkMinValue:false,exclusiveMin:false}:v==='gte'?{checkMinValue:true,exclusiveMin:false}:{checkMinValue:true,exclusiveMin:true})}}
                                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                            <option value="any">Any</option>
                                            <option value="gte">Greater Than or Equal (≥)</option>
                                            <option value="gt">Greater Than (&gt;)</option>
                                          </select>
                                          {p.checkMinValue && (
                                            <input type="number" value={p.minimumValue??0} onChange={e=>updateParam({minimumValue:parseFloat(e.target.value)||0})}
                                              className="w-20 text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                          )}
                                        </td>
                                      </tr>
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Maximum Value</td>
                                        <td className="py-2 flex items-center gap-2">
                                          <select value={!p.checkMaxValue?'any':p.exclusiveMax?'lt':'lte'}
                                            onChange={e=>{const v=e.target.value;updateParam(v==='any'?{checkMaxValue:false,exclusiveMax:false}:v==='lte'?{checkMaxValue:true,exclusiveMax:false}:{checkMaxValue:true,exclusiveMax:true})}}
                                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                            <option value="any">Any</option>
                                            <option value="lte">Less Than or Equal (≤)</option>
                                            <option value="lt">Less Than (&lt;)</option>
                                          </select>
                                          {p.checkMaxValue && (
                                            <input type="number" value={p.maximumValue??0} onChange={e=>updateParam({maximumValue:parseFloat(e.target.value)||0})}
                                              className="w-20 text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                          )}
                                        </td>
                                      </tr>
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Multiple of</td>
                                        <td className="py-2 flex items-center gap-3">
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`mulof-${i}`} checked={!p.checkMultipleOfValue} onChange={()=>updateParam({checkMultipleOfValue:false})} />Any</label>
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`mulof-${i}`} checked={!!p.checkMultipleOfValue} onChange={()=>updateParam({checkMultipleOfValue:true})} />Value:</label>
                                          <input type="number" value={p.multipleOf??5} disabled={!p.checkMultipleOfValue} onChange={e=>updateParam({multipleOf:parseFloat(e.target.value)||1})}
                                            className="w-16 text-xs border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                        </td>
                                      </tr>
                                    </>)}
                                    {vt!=='auto-detect' && !DT_HIDE_LENGTHS.includes(dt) && (
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Minimum Length</td>
                                        <td className="py-2 w-fit flex items-center gap-3">
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`minlen-${i}`} checked={!p.checkMinValueLength} onChange={()=>updateParam({checkMinValueLength:false})} />Any</label>
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`minlen-${i}`} checked={!!p.checkMinValueLength} onChange={()=>updateParam({checkMinValueLength:true})} />Value:</label>
                                          <input type="number" value={p.minimumLength??0} disabled={!p.checkMinValueLength} onChange={e=>updateParam({minimumLength:parseInt(e.target.value)||0})}
                                            className="w-16 text-xs border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                        </td>
                                      </tr>
                                    )}
                                    {!DT_HIDE_LENGTHS.includes(dt) && <tr className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-500 font-medium w-36">Maximum Length</td>
                                      <td className="py-2 w-fit flex items-center gap-3">
                                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`maxlen-${i}`} checked={!p.checkMaxValueLength} onChange={()=>updateParam({checkMaxValueLength:false})} />Any</label>
                                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`maxlen-${i}`} checked={!!p.checkMaxValueLength} onChange={()=>updateParam({checkMaxValueLength:true})} />Value:</label>
                                        <input type="number" value={p.maximumLength??10} disabled={!p.checkMaxValueLength} onChange={e=>updateParam({maximumLength:parseInt(e.target.value)||0})}
                                          className="w-16 text-xs border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                      </td>
                                    </tr>}
                                    {vt!=='auto-detect' && !DT_HIDE_REGEX.includes(dt) && (
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Regular Expression</td>
                                        <td className="py-2 flex items-center gap-2">
                                          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={p.enableRegularExpression??false} onChange={e=>updateParam({enableRegularExpression:e.target.checked})} />Enable</label>
                                          <input value={p.regularExpression??''} disabled={!p.enableRegularExpression} onChange={e=>updateParam({regularExpression:e.target.value})} placeholder="e.g. (^[A-Za-z0-9,]+$)"
                                            className="w-1/2 text-xs border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                        </td>
                                      </tr>
                                    )}
                                    {dt==='binary' && (
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Disallow File Upload of Executables</td>
                                        <td className="py-2">
                                          <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="checkbox" checked={p.disallowFileUploadOfExecutables??true} onChange={e=>updateParam({disallowFileUploadOfExecutables:e.target.checked})} />
                                            Disallow
                                          </label>
                                        </td>
                                      </tr>
                                    )}
                                    {!DT_HIDE_BASE64.includes(dt) && <tr className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-500 font-medium w-36">Base64 Decoding</td>
                                      <td className="py-2">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input type="checkbox" checked={p.isBase64??false} onChange={e=>updateParam({isBase64:e.target.checked})} />
                                          Enable
                                        </label>
                                      </td>
                                    </tr>}
                                    {p.dataType==='uri' && (
                                      <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36">Host Name Representation</td>
                                        <td className="py-2">
                                          <select value={p.hostNameRepresentation||'domain-name'} onChange={e=>updateParam({hostNameRepresentation:e.target.value})}
                                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                            <option value="ip-address">IP Address</option>
                                            <option value="domain-name">Domain Name</option>
                                            <option value="any">Any</option>
                                          </select>
                                        </td>
                                      </tr>
                                    )}
                                    {vt!=='auto-detect' && DT_SHOW_ENUM && (
                                      <tr>
                                        <td className="py-2 pr-4 text-gray-500 font-medium w-36 align-top pt-3">Enum</td>
                                        <td className="py-2">
                                          <div className="w-1/2">
                                          <form onSubmit={e=>{e.preventDefault();const v=e.target.ev.value.trim();if(!v)return;const cur=p.parameterEnumValues||[];if(!cur.includes(v))updateParam({parameterEnumValues:[...cur,v]});e.target.reset()}} className="flex gap-1 mb-1">
                                            <input name="ev" placeholder="Add value…" className="text-xs border border-gray-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                            <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                          </form>
                                          <div className="border border-gray-200 rounded bg-white overflow-y-auto" style={{maxHeight:'15rem'}}>
                                            {(p.parameterEnumValues||[]).map((val,vi)=>(
                                              <div key={vi} className="flex items-center justify-between px-2 py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                                                <span className="text-xs text-gray-700 font-mono">{val}</span>
                                                <button onClick={()=>updateParam({parameterEnumValues:(p.parameterEnumValues||[]).filter((_,j)=>j!==vi)})}
                                                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" title="Remove">
                                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                </button>
                                              </div>
                                            ))}
                                            {(p.parameterEnumValues||[]).length===0 && (
                                              <div className="px-2 py-3 text-xs text-gray-400 text-center">No enum values defined.</div>
                                            )}
                                          </div>
                                          {(p.parameterEnumValues||[]).length>0 && (
                                            <button onClick={()=>updateParam({parameterEnumValues:[]})} className="mt-1 text-xs px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Remove All</button>
                                          )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              )}

                              {paramSubTab==='value-meta' && <MetaCharPanel csType="parameter-value" enabledField="metacharsOnParameterValueCheck" label="Check metacharacters on parameter value" />}

                              {paramSubTab==='attack-sigs' && (() => {
                                const sigOverrides = p.signatureOverrides||[]
                                return (
                                  <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                      <input type="checkbox" checked={p.attackSignaturesCheck??true} onChange={e=>updateParam({attackSignaturesCheck:e.target.checked})} />
                                      Check attack signatures on this parameter
                                    </label>
                                    {(p.attackSignaturesCheck??true) && (
                                      <div>
                                        <div className="text-xs font-semibold text-gray-700 mb-2">Excluded signatures {sigOverrides.length>0&&<span className="text-gray-400 font-normal">({sigOverrides.length})</span>}</div>
                                        {sigOverrides.length>0 && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {sigOverrides.map((entry,si)=>{
                                              // Entry may be an object {signatureId,...} or (legacy) a bare string.
                                              const sid = typeof entry === 'object' ? String(entry.signatureId ?? entry.id) : String(entry)
                                              const info = deviceSigs.find(s => String(s.signatureId) === sid)
                                              const name = (typeof entry === 'object' && entry.name) || info?.name || ''
                                              return (
                                                <span key={si} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700" title={name}>
                                                  <span className="font-mono">{sid}</span>
                                                  {name && <span className="text-gray-400 max-w-32 truncate">{name}</span>}
                                                  <button onClick={()=>updateParam({signatureOverrides:sigOverrides.filter((_,j)=>j!==si)})} className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                                </span>
                                              )
                                            })}
                                          </div>
                                        )}
                                        <div className="flex gap-1 items-center">
                                          {(() => {
                                            // Restrict to parameter-scope signatures (matchesWithinParameter === true, or unknown scope as fallback).
                                            const paramCandidates = deviceSigs.filter(s => {
                                              const mw = s.matchesWithin || {}
                                              return Object.keys(mw).length === 0 || mw.matchesWithinParameter === true
                                            })
                                            // Extract IDs regardless of legacy-string vs new-object shape so duplicates are detected.
                                            const existingIds = sigOverrides.map(e => typeof e === 'object' ? String(e.signatureId ?? e.id) : String(e))
                                            return (
                                              <SigIdAutocomplete
                                                candidates={paramCandidates}
                                                existingIds={existingIds}
                                                onAdd={sig => updateParam({
                                                  // Must be an object with numeric signatureId — BIG-IP's importer rejects bare-string entries
                                                  // (Perl error: `Can't use string ("<sigId>") as a HASH ref`).
                                                  signatureOverrides: [
                                                    ...sigOverrides,
                                                    { signatureId: Number(sig.signatureId), enabled: false, name: sig.name || '', tag: sig.tag || '' },
                                                  ],
                                                })}
                                                width={144}
                                              />
                                            )
                                          })()}
                                          <button type="button" onClick={()=>{
                                            setParamSigModal(i); setParamSigSearch('');
                                            setParamSigSelected(new Set(sigOverrides.map(e => typeof e === 'object' ? String(e.signatureId ?? e.id) : String(e))))
                                          }}
                                            className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">Advanced</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}

                              {paramSubTab==='static-values' && (
                                <div>
                                  <form onSubmit={e=>{e.preventDefault();const v=e.target.sv.value.trim();if(!v)return;const cur=p.staticValues||[];if(!cur.includes(v))updateParam({staticValues:[...cur,v]});e.target.reset()}} className="flex gap-2 items-center mb-3">
                                    <span className="text-xs text-gray-500 w-36">New Static Value</span>
                                    <input name="sv" className="text-xs border border-gray-200 rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                    <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                  </form>
                                  <div className="flex gap-2 items-start">
                                    <span className="text-xs text-gray-500 w-36 pt-1">Parameter Static Values</span>
                                    <div className="w-1/2">
                                      <div className="border border-gray-200 rounded bg-white mb-1 overflow-y-auto" style={{maxHeight: '15rem'}}>
                                        {(p.staticValues||[]).map((v,vi)=>(
                                          <div key={vi} className="flex items-center justify-between px-2 py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                                            <span className="text-xs text-gray-700 font-mono">{v}</span>
                                            <button onClick={()=>updateParam({staticValues:(p.staticValues||[]).filter((_,j)=>j!==vi)})}
                                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" title="Remove">
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>
                                        ))}
                                        {(p.staticValues||[]).length===0 && (
                                          <div className="px-2 py-3 text-xs text-gray-400 text-center">No static values defined.</div>
                                        )}
                                      </div>
                                      {(p.staticValues||[]).length>0 && (
                                        <button onClick={()=>updateParam({staticValues:[]})} className="text-xs px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Remove All</button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {paramSubTab==='json-profile' && (
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-gray-500 w-32">JSON Profile</span>
                                  <select value={p.jsonProfile||'Default'} onChange={e=>updateParam({jsonProfile:e.target.value})}
                                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white w-64">
                                    <option value="Default">Default</option>
                                    {jsonProfs.filter(jp=>jp.name!=='Default').map(jp=><option key={jp.name} value={jp.name}>{jp.name}</option>)}
                                  </select>
                                  <button type="button" onClick={() => setActiveTab('json')}
                                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs">
                                    + Create JSON Profile
                                  </button>
                                </div>
                              )}

                              {paramSubTab==='xml-profile' && (
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-gray-500 w-32">XML Profile</span>
                                  <select value={p.xmlProfile||'Default'} onChange={e=>updateParam({xmlProfile:e.target.value})}
                                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white w-64">
                                    <option value="Default">Default</option>
                                    {xmlProfs.filter(xp=>xp.name!=='Default').map(xp=><option key={xp.name} value={xp.name}>{xp.name}</option>)}
                                  </select>
                                  <button type="button" onClick={() => setActiveTab('xml')}
                                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs">
                                    + Create XML Profile
                                  </button>
                                </div>
                              )}

                            </div>}
                            </div>
                          </div>
                        </div>, document.body, `pm-modal-${i}`)
                    ]
                  })}
                </tbody>
              </table>
                {/* Pagination — DeviceFleet style */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {[10, 20, 50].map((size, i) => (
                      <span key={size} className="flex items-center gap-2">
                        {i > 0 && <span className="text-gray-300">|</span>}
                        <button onClick={() => { setParamPageSize(size); setParamPage(1) }}
                          className={`px-1 py-0.5 rounded transition-colors ${paramPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                          {size}
                        </button>
                      </span>
                    ))}
                    
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>Page {safePage} of {pageCount}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setParamPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button onClick={() => setParamPage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount}
                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )
            })()
          )}
        </Card>
      )}

      {/* ── URLS ── */}
      {activeTab === 'urls' && (
        <Card>
          <SectionHeader title="URLs" sub={`${urls.length} entries`}
            onClick={() => toggleSection('urls')} collapsed={collapsed.urls}
            action={
              <div className="relative">
                <button ref={urlAddBtnRef} onClick={() => {
                  const r = urlAddBtnRef.current?.getBoundingClientRect()
                  if (r) setUrlAddPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                  setUrlAddOpen(v => !v); setUrlAddName('')
                }} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                  Add <span className="text-[10px]">▾</span>
                </button>
                {urlAddOpen && urlAddPos && createPortal(
                  <div style={{ position: 'fixed', top: urlAddPos.top, right: urlAddPos.right, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded shadow-lg w-60 p-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">New URL</div>
                    {(() => {
                      const name = urlAddName.trim()
                      const isDup = !!name && urls.some(u => u.name === name && (u.protocol || 'http') === 'http' && (u.method || '*') === '*')
                      return (
                        <form onSubmit={e => {
                          e.preventDefault()
                          if (!name || isDup) return
                          const entry = urlAddIsAllowed
                            ? { name, type: urlAddType, protocol: 'http', method: '*', attackSignaturesCheck: true, performStaging: false }
                            : { name, type: urlAddType, protocol: 'http', method: '*', isAllowed: false }
                          setTop('urls', [...editedPol.urls, entry])
                          setUnsaved(true)
                          setUrlAddOpen(false); setUrlAddName(''); setUrlAddType('explicit'); setUrlAddIsAllowed(true)
                        }} className="flex flex-col gap-2">
                          <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                            {[[true, 'Allowed'], [false, 'Disallowed']].map(([v, l]) => (
                              <button key={String(v)} type="button" onClick={() => setUrlAddIsAllowed(v)}
                                className={`flex-1 px-2 py-1.5 transition-colors ${urlAddIsAllowed === v ? (v ? 'bg-emerald-600 text-white font-medium' : 'bg-red-600 text-white font-medium') : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                          <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                            {['explicit', 'wildcard'].map(t => (
                              <button key={t} type="button" onClick={() => setUrlAddType(t)}
                                className={`flex-1 px-2 py-1.5 capitalize transition-colors ${urlAddType === t ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                          <input value={urlAddName} onChange={e => setUrlAddName(e.target.value)}
                            placeholder={urlAddType === 'wildcard' ? 'e.g. /api/*' : 'e.g. /login'}
                            autoFocus
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                          {isDup && <span className="text-xs text-red-500">URL already exists.</span>}
                          <button type="submit" disabled={!urlAddName.trim() || isDup}
                            className={`text-xs px-3 py-1.5 rounded text-white disabled:opacity-40 disabled:cursor-not-allowed ${urlAddIsAllowed ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            Add {urlAddIsAllowed ? 'Allowed' : 'Disallowed'} URL
                          </button>
                        </form>
                      )
                    })()}
                  </div>,
                  document.body
                )}
              </div>
            } />
          {!collapsed.urls && (() => {
              // Schema: `isAllowed` may be missing → treated as Allowed (true).
              const urlIsAllowed = (u) => u.isAllowed !== false
              const allowedCount = urls.reduce((n, u) => n + (urlIsAllowed(u) ? 1 : 0), 0)
              const disallowedCount = urls.length - allowedCount
              // 1. Filter across name / protocol / method / type + access filter chip
              const q = urlSearch.trim().toLowerCase()
              let urlList = urls.map((u, i) => ({ u, i }))
              if (urlAccessFilter === 'allowed')    urlList = urlList.filter(({ u }) =>  urlIsAllowed(u))
              if (urlAccessFilter === 'disallowed') urlList = urlList.filter(({ u }) => !urlIsAllowed(u))
              if (q) urlList = urlList.filter(({ u }) =>
                (u.name || '').toLowerCase().includes(q)
                || (u.protocol || 'http').toLowerCase().includes(q)
                || (u.method || '*').toLowerCase().includes(q)
                || (u.type || 'wildcard').toLowerCase().includes(q))
              // 2. Sort
              const urlKeyVal = ({ u }) => {
                switch (urlSortCol) {
                  case 'name': return (u.name || '').toLowerCase()
                  case 'access': return urlIsAllowed(u) ? 1 : 0
                  case 'protocol': return u.protocol || 'http'
                  case 'method': return u.method || '*'
                  case 'type': return u.type || 'wildcard'
                  case 'attackSigs': return !(u.attackSignaturesCheck ?? true) ? 0 : 1 + (u.signatureOverrides || []).length
                  case 'staging': return (u.performStaging ?? false) ? 1 : 0
                  default: return ''
                }
              }
              if (urlSortCol) {
                const dir = urlSortDir === 'desc' ? -1 : 1
                urlList = [...urlList].sort((a, b) => { const av = urlKeyVal(a), bv = urlKeyVal(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
              } else {
                urlList = [...urlList].sort((a, b) => (a.u.name || '').localeCompare(b.u.name || ''))
              }
              // 3. Paginate
              const urlFiltered = urlList
              const urlTotalPages = Math.max(1, Math.ceil(urlFiltered.length / urlPageSize))
              const urlSafePage = Math.min(urlPageNum, urlTotalPages)
              const urlPageRows = urlFiltered.slice((urlSafePage - 1) * urlPageSize, urlSafePage * urlPageSize)
              const urlSelIdxs = urlPageRows.map(r => r.i)
              const urlAllSel = urlSelIdxs.length > 0 && urlSelIdxs.every(i => urlSelected.has(i))
              const URL_SORT_COLS = [['name', 'URL', 'w-64'], ['access', 'Access', 'w-24'], ['protocol', 'Protocol', ''], ['method', 'Method', ''], ['type', 'Type', ''], ['attackSigs', 'Attack sigs', ''], ['staging', 'Staging', '']]
              return (<>
                {/* Toolbar: search + access filter + bulk delete */}
                <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input value={urlSearch} onChange={e => { setUrlSearch(e.target.value); setUrlPageNum(1) }}
                        placeholder="Search URLs…"
                        className="text-xs border border-gray-200 rounded pl-7 pr-2 py-1 w-64 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      <svg className="w-3.5 h-3.5 absolute left-2 top-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                      {[
                        ['all', `All (${urls.length})`, 'bg-blue-600'],
                        ['allowed', `Allowed (${allowedCount})`, 'bg-emerald-600'],
                        ['disallowed', `Disallowed (${disallowedCount})`, 'bg-red-600'],
                      ].map(([v, l, activeBg]) => (
                        <button key={v} type="button"
                          onClick={() => { setUrlAccessFilter(v); setUrlPageNum(1) }}
                          className={`px-2.5 py-1 transition-colors ${urlAccessFilter === v ? `${activeBg} text-white font-medium` : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {urlSelected.size > 0 && (
                    <div className="relative inline-flex">
                      <button onClick={bulkDeleteUrls}
                        className="text-xs px-2.5 py-1 rounded-l bg-red-600 text-white hover:bg-red-700 border border-red-600 font-medium">Delete ({urlSelected.size})</button>
                      <button onClick={() => setUrlDeleteMenuOpen(o => !o)} title="More delete options"
                        className="text-xs px-1.5 py-1 rounded-r bg-red-600 text-white hover:bg-red-700 border-y border-r border-red-600 border-l border-l-red-400">▾</button>
                      {urlDeleteMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-0" onClick={() => setUrlDeleteMenuOpen(false)} />
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
                            <button onClick={deleteAllUrls} className="block w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 whitespace-nowrap">Delete All ({urls.length})</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {urlPageRows.length === 0
                  ? <div className="p-4 text-xs text-gray-400">{urlSearch ? 'No URLs match your search.' : 'No URLs configured.'}</div>
                  : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-8 px-2 py-2 text-center">
                    <input type="checkbox" checked={urlAllSel}
                      onChange={() => setUrlSelected(s => { const n = new Set(s); if (urlAllSel) urlSelIdxs.forEach(i => n.delete(i)); else urlSelIdxs.forEach(i => n.add(i)); return n })} />
                  </th>
                  {URL_SORT_COLS.map(([key, label, w]) => (
                    <th key={key} onClick={() => sortUrlBy(key)}
                      className={`text-left px-3 py-2 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 group ${w}`}>
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {urlSortCol === key ? (
                          <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={urlSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                        ) : (
                          <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="w-12 px-2 py-2 text-right font-medium text-gray-500">Edit</th>
                </tr></thead>
                <tbody>
                  {urlPageRows.map(({ u, i }) => {
                    const isExp = expandedUrl === i
                    const updateUrl = (patch) => {
                      const arr = [...editedPol.urls]
                      arr[i] = { ...arr[i], ...patch }
                      setTop('urls', arr); setUnsaved(true)
                    }
                    const profiles = u.urlContentProfiles || []
                    const BODY_TYPES = [
                      { value: 'apply-value-and-content-signatures', label: 'Apply value and content signatures and detect threat campaigns' },
                      { value: 'disallow', label: 'Disallow' },
                      { value: 'apply-content-signatures', label: 'Apply content signatures and detect threat campaigns' },
                      { value: 'gwt', label: 'GWT' },
                      { value: 'form-data', label: 'Form Data' },
                      { value: 'json', label: 'JSON' },
                      { value: 'xml', label: 'XML' },
                      { value: 'do-nothing', label: 'Do nothing' },
                      { value: 'graphql', label: 'GraphQL' },
                      { value: 'plain-text', label: 'Plain Text' },
                    ]
                    const bodyTypeLabel = (v) => BODY_TYPES.find(t => t.value === v)?.label || v
                    return [
                      <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50 ${urlSelected.has(i) ? 'bg-blue-50' : ''} ${isExp ? 'bg-blue-100' : ''}`}>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={urlSelected.has(i)} onChange={() => toggleUrlSelected(i)} />
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-800 w-64">{u.name}</td>
                        <td className="px-3 py-2 w-24">
                          <Badge color={u.isAllowed === false ? 'red' : 'green'}>{u.isAllowed === false ? 'Disallowed' : 'Allowed'}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge color={u.protocol === 'https' ? 'green' : 'blue'}>{(u.protocol || 'http').toUpperCase()}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">{u.method || '*'}</td>
                        <td className="px-3 py-2"><Badge color="gray">{u.type || 'wildcard'}</Badge></td>
                        <td className="px-3 py-2">{(() => {
                          if (u.isAllowed === false) return <span className="text-gray-300 text-xs">N/A</span>
                          if (!(u.attackSignaturesCheck ?? true)) return <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          const ex = (u.signatureOverrides || []).length
                          return (<span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{ex > 0 && <span className="text-amber-600">· {ex} ex.</span>}</span>)
                        })()}</td>
                        <td className="px-3 py-2">
                          {u.isAllowed === false
                            ? <span className="text-gray-300 text-xs">N/A</span>
                            : <Toggle on={u.performStaging ?? false} onClick={() => toggleItem('urls', i, 'performStaging')} />}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => openUrlModal(i)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit URL">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                        </td>
                      </tr>,
                      isExp && (() => {
                        const isDisallowed = u.isAllowed === false
                        return createPortal(
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cancelUrlModal}>
                          <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-[986px] max-h-[90vh] flex flex-col overflow-hidden border border-gray-300" onClick={e => e.stopPropagation()}>
                            <div className={`flex items-center justify-between px-6 py-3 border-b flex-shrink-0 ${isDisallowed ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
                              <div className="flex items-center gap-3">
                                <h3 className="text-sm font-bold text-gray-900">Edit URL — <span className={`font-mono ${isDisallowed ? 'text-red-700' : 'text-blue-700'}`}>{u.name}</span></h3>
                                <button type="button"
                                  onClick={() => updateUrl(isDisallowed
                                    ? { isAllowed: undefined, attackSignaturesCheck: true, performStaging: false }
                                    : { isAllowed: false, attackSignaturesCheck: undefined, signatureOverrides: undefined, metacharsOnUrlCheck: undefined, metacharOverrides: undefined, methodsOverrideOnUrlCheck: undefined, methodOverrides: undefined, urlContentProfiles: undefined, mandatoryBody: undefined, clickjackingProtection: undefined, allowRenderingInFrames: undefined, allowRenderingInFramesOnlyFrom: undefined, disallowFileUploadOfExecutables: undefined, performStaging: undefined })}
                                  className={`text-[11px] px-2 py-0.5 rounded font-medium border transition-colors ${isDisallowed ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'}`}
                                  title="Click to toggle Allowed/Disallowed">
                                  {isDisallowed ? 'Disallowed' : 'Allowed'}
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Btn size="sm" onClick={cancelUrlModal}>Cancel</Btn>
                                <Btn size="sm" variant="primary" onClick={commitUrlModal}>Update</Btn>
                              </div>
                            </div>
                            <div className="overflow-y-auto">
                            {isDisallowed && (
                              <div className="px-6 py-2 bg-red-50/60 border-b border-red-100 text-[11px] text-red-800">
                                Requests matching this URL are always blocked. Attack signatures, meta-characters, methods enforcement, and content profiles do not apply to disallowed URLs.
                              </div>
                            )}
                            {/* Properties grid */}
                            <div className="px-6 py-4 border-b border-gray-200">
                              <table className="w-full text-xs">
                                <tbody>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium align-top pt-3 w-52">URL Description</td>
                                    <td className="py-2">
                                      <textarea value={u.description ?? ''} onChange={e => updateUrl({ description: e.target.value })}
                                        rows={3} className="text-xs border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y" />
                                    </td>
                                  </tr>
                                  {!isDisallowed && (<>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium">Clickjacking Protection</td>
                                    <td className="py-2">
                                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                        <input type="checkbox" checked={u.clickjackingProtection ?? false} onChange={e => updateUrl({ clickjackingProtection: e.target.checked })} />
                                        Enabled
                                      </label>
                                    </td>
                                  </tr>
                                  {(u.clickjackingProtection ?? false) && (
                                    <tr className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-500 font-medium">Allow Rendering in Frames</td>
                                      <td className="py-2 flex items-center gap-2">
                                        <select value={u.allowRenderingInFrames ?? 'never'}
                                          onChange={e => updateUrl({ allowRenderingInFrames: e.target.value })}
                                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                          <option value="never">Never</option>
                                          <option value="only-same">Same Origin Only</option>
                                          <option value="only-from">Only From URL</option>
                                        </select>
                                        {u.allowRenderingInFrames === 'only-from' && (
                                          <>
                                            <span className="text-gray-500">URL:</span>
                                            <input value={u.allowRenderingInFramesOnlyFrom ?? ''}
                                              onChange={e => updateUrl({ allowRenderingInFramesOnlyFrom: e.target.value })}
                                              placeholder="http://domain.com"
                                              className="text-xs border border-gray-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                            <span className="text-gray-400">Example: http://domain.com</span>
                                          </>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium">Disallow File Upload of Executables</td>
                                    <td className="py-2">
                                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                        <input type="checkbox" checked={u.disallowFileUploadOfExecutables ?? false} onChange={e => updateUrl({ disallowFileUploadOfExecutables: e.target.checked })} />
                                        Enabled
                                      </label>
                                    </td>
                                  </tr>
                                  <tr className="border-b border-gray-100">
                                    <td className="py-2 pr-4 text-gray-500 font-medium">Body is Mandatory</td>
                                    <td className="py-2">
                                      <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                        <input type="checkbox" checked={u.mandatoryBody ?? false} onChange={e => updateUrl({ mandatoryBody: e.target.checked })} />
                                        Enabled
                                      </label>
                                    </td>
                                  </tr>
                                  </>)}
                                  {u.type === 'wildcard' && (
                                    <tr className="border-b border-gray-100">
                                      <td className="py-2 pr-4 text-gray-500 font-medium">Wildcard Match Includes Slashes</td>
                                      <td className="py-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                          <input type="checkbox" checked={u.wildcardIncludesSlash ?? true} onChange={e => updateUrl({ wildcardIncludesSlash: e.target.checked })} />
                                          Enabled
                                        </label>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {!isDisallowed && (<>
                            {/* Sub-tab bar */}
                            <div className="flex gap-0 border-b border-gray-200 bg-white px-4">
                              {[
                                ['attack-sigs', 'Attack Signatures'],
                                ['content-profiles', 'Header-Based Content Profiles'],
                                ['meta-chars', 'Meta Characters'],
                                ['methods', 'Methods Enforcement'],
                              ].map(([id, label]) => (
                                <button key={id} onClick={() => setUrlSubTab(id)}
                                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${urlSubTab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                  {label}
                                </button>
                              ))}
                            </div>

                            {/* Sub-tab content */}
                            <div className="px-6 py-6 bg-white min-h-32 border-b border-gray-200">
                              {urlSubTab === 'attack-sigs' && (
                                <div className="space-y-3">
                                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                    <input type="checkbox" checked={u.attackSignaturesCheck ?? true} onChange={e => updateUrl({ attackSignaturesCheck: e.target.checked })} />
                                    Check attack signatures and threat campaigns on this URL
                                  </label>
                                  {(u.attackSignaturesCheck ?? true) && (() => {
                                    const sigOverrides = u.signatureOverrides || []
                                    return (
                                      <div>
                                        <div className="text-xs font-semibold text-gray-700 mb-2">
                                          Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}
                                        </div>
                                        {sigOverrides.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {sigOverrides.map((sid, si) => {
                                              const sigId = typeof sid === 'object' ? String(sid.signatureId ?? sid.id) : String(sid)
                                              const sigInfo = deviceSigs.find(s => String(s.signatureId) === sigId)
                                              const sigName = sigInfo?.name || (typeof sid === 'object' ? sid.name : '')
                                              return (
                                                <span key={si} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700" title={sigName || ''}>
                                                  <span className="font-mono">{sigId}</span>
                                                  {sigName && <span className="text-gray-400 max-w-32 truncate">{sigName}</span>}
                                                  <button onClick={() => updateUrl({ signatureOverrides: sigOverrides.filter((_, j) => j !== si) })}
                                                    className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                                </span>
                                              )
                                            })}
                                          </div>
                                        )}
                                        <div className="flex gap-1 items-center">
                                          {(() => {
                                            // Restrict to URL/URI-scope signatures (matchesWithinUri === true, or unknown scope as fallback).
                                            const urlCandidates = deviceSigs.filter(s => {
                                              const mw = s.matchesWithin || {}
                                              return Object.keys(mw).length === 0 || mw.matchesWithinUri === true
                                            })
                                            const existingIds = sigOverrides.map(s => typeof s === 'object' ? String(s.signatureId ?? s.id) : String(s))
                                            return (
                                              <SigIdAutocomplete
                                                candidates={urlCandidates}
                                                existingIds={existingIds}
                                                onAdd={sig => updateUrl({
                                                  signatureOverrides: [
                                                    ...sigOverrides,
                                                    { signatureId: Number(sig.signatureId), enabled: false, name: sig.name || '' },
                                                  ],
                                                })}
                                                width={144}
                                              />
                                            )
                                          })()}
                                          <button type="button"
                                            onClick={() => { setUrlSigModal(i); setUrlSigSearch(''); setUrlSigSelected(new Set(sigOverrides.map(s => typeof s === 'object' ? String(s.signatureId ?? s.id) : String(s)))) }}
                                            className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">
                                            Advanced
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}

                              {urlSubTab === 'content-profiles' && (
                                <div>
                                  {/* Add form */}
                                  <div className="grid gap-2 mb-4 text-xs" style={{gridTemplateColumns: '1fr 1fr auto auto auto auto'}}>
                                    <div>
                                      <div className="text-gray-500 mb-1">Request Header Name</div>
                                      <input id={`cp-hname-${i}`} placeholder="(explicit, case insensitive)"
                                        className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 italic placeholder:text-orange-400 placeholder:not-italic" />
                                    </div>
                                    <div>
                                      <div className="text-gray-500 mb-1">Request Header Value</div>
                                      <input id={`cp-hval-${i}`} placeholder="(wildcard, case sensitive)"
                                        className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 italic placeholder:text-orange-400 placeholder:not-italic" />
                                    </div>
                                    <div>
                                      <div className="text-gray-500 mb-1">Base64 Decoding</div>
                                      <select id={`cp-b64-${i}`} className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                        <option value="disabled">Disabled</option>
                                        <option value="enabled">Enabled</option>
                                        <option value="required">Required</option>
                                      </select>
                                    </div>
                                    <div>
                                      <div className="text-gray-500 mb-1">Request Body Handling</div>
                                      <select id={`cp-type-${i}`}
                                        onChange={e => { const el = document.getElementById(`cp-prof-${i}`); if (el) el.style.display = ['json','xml','gwt','graphql','plain-text'].includes(e.target.value) ? '' : 'none' }}
                                        className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">
                                        {BODY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                      </select>
                                    </div>
                                    <div id={`cp-prof-${i}`} style={{display:'none'}}>
                                      <div className="text-gray-500 mb-1">Profile</div>
                                      <select id={`cp-profname-${i}`} className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white min-w-28">
                                        {(() => {
                                          const type = document.getElementById(`cp-type-${i}`)?.value
                                          const list = type === 'json' ? jsonProfs : type === 'xml' ? xmlProfs : type === 'gwt' ? gwtProfs : type === 'graphql' ? graphqlProfs : type === 'plain-text' ? plainProfs : []
                                          return list.length > 0 ? list.map(p => <option key={p.name} value={p.name}>{p.name}</option>) : <option value="Default">Default</option>
                                        })()}
                                      </select>
                                    </div>
                                    <div className="flex items-end">
                                      <button onClick={() => {
                                        const hn = document.getElementById(`cp-hname-${i}`).value.trim() || '*'
                                        const hv = document.getElementById(`cp-hval-${i}`).value.trim() || '*'
                                        const b64 = document.getElementById(`cp-b64-${i}`).value
                                        const type = document.getElementById(`cp-type-${i}`).value
                                        const profName = ['json','xml','gwt','graphql','plain-text'].includes(type) ? (document.getElementById(`cp-profname-${i}`)?.value || 'Default') : undefined
                                        const newOrder = String(profiles.filter(p => p.headerOrder !== 'default').length + 1)
                                        const entry = { headerName: hn, headerValue: hv, decodeValueAsBase64: b64, type, headerOrder: newOrder }
                                        if (profName) entry.profileName = profName
                                        updateUrl({ urlContentProfiles: [...profiles, entry] })
                                        document.getElementById(`cp-hname-${i}`).value = ''
                                        document.getElementById(`cp-hval-${i}`).value = ''
                                      }} className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium">Add</button>
                                    </div>
                                  </div>
                                  {profiles.length > 0 && (
                                    <table className="w-full text-xs">
                                      <thead><tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="w-6 px-2 py-1.5"></th>
                                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Order</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Request Header Name</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Request Header Value</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Base64 Decoding</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Request Body Handling</th>
                                        <th className="w-8"></th>
                                      </tr></thead>
                                      <tbody>
                                        {[...profiles].sort((a,b) => a.headerOrder === 'default' ? 1 : b.headerOrder === 'default' ? -1 : Number(a.headerOrder) - Number(b.headerOrder)).map((p, pi) => (
                                          <tr key={pi} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="px-2 py-1.5">
                                              <input type="checkbox" className="cursor-pointer" />
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-500">{p.headerOrder === 'default' ? 'default' : p.headerOrder}</td>
                                            <td className="px-3 py-1.5 font-mono text-gray-700">{p.headerName}</td>
                                            <td className="px-3 py-1.5 font-mono text-gray-700">{p.headerValue}</td>
                                            <td className="px-3 py-1.5 text-gray-600 capitalize">{p.decodeValueAsBase64 || 'disabled'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">
                                              {bodyTypeLabel(p.type)}
                                              {p.profileName && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{p.profileName}</span>}
                                            </td>
                                            <td className="px-3 py-1.5 text-center">
                                              {p.headerOrder !== 'default' && (
                                                <button onClick={() => updateUrl({ urlContentProfiles: profiles.filter((_, j) => profiles.indexOf(p) !== j) })}
                                                  className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}

{urlSubTab === 'meta-chars' && (() => {
                                const urlCharSet = (pol['character-sets'] || []).find(e => e.characterSetType === 'url')?.characterSet || []
                                const getIsAllowed = (hex) => {
                                  const entry = urlCharSet.find(c => c.metachar === hex)
                                  if (entry) return entry.isAllowed
                                  return URL_METACHARS.find(m => m.hex === hex)?.defaultAllowed ?? true
                                }
                                const toggleChar = (hex) => {
                                  const cs = pol['character-sets'] || []
                                  const urlIdx = cs.findIndex(e => e.characterSetType === 'url')
                                  const baseSet = urlIdx === -1
                                    ? URL_METACHARS.map(m => ({ metachar: m.hex, isAllowed: m.defaultAllowed }))
                                    : [...(cs[urlIdx].characterSet || URL_METACHARS.map(m => ({ metachar: m.hex, isAllowed: m.defaultAllowed })))]
                                  const charIdx = baseSet.findIndex(c => c.metachar === hex)
                                  const cur = getIsAllowed(hex)
                                  const newSet = charIdx === -1
                                    ? [...baseSet, { metachar: hex, isAllowed: !cur }]
                                    : baseSet.map((c, j) => j === charIdx ? { ...c, isAllowed: !cur } : c)
                                  const newCs = urlIdx === -1
                                    ? [...cs, { characterSetType: 'url', characterSet: newSet }]
                                    : cs.map((e, j) => j === urlIdx ? { ...e, characterSet: newSet } : e)
                                  setTop('character-sets', newCs); setUnsaved(true)
                                }
                                const searchLower = urlMetaSearch.toLowerCase()
                                const visibleChars = urlMetaView === 'meta-only'
                                  ? URL_METACHARS.filter(m => !searchLower || m.name.toLowerCase().includes(searchLower) || m.hex.includes(searchLower))
                                  : (() => {
                                      const allChars = []
                                      for (let code = 0; code <= 127; code++) {
                                        const hex = '0x' + code.toString(16)
                                        const meta = URL_METACHARS.find(m => m.hex === hex)
                                        let name = meta ? meta.name : (code >= 32 && code < 127 ? String.fromCharCode(code) : `0x${code.toString(16)}`)
                                        allChars.push({ hex, name, isMeta: !!meta })
                                      }
                                      return allChars.filter(m => !searchLower || m.name.toLowerCase().includes(searchLower) || m.hex.includes(searchLower))
                                    })()
                                return (
                                  <div>
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mb-3">
                                      <input type="checkbox" checked={u.metacharsOnUrlCheck ?? false} onChange={e => updateUrl({ metacharsOnUrlCheck: e.target.checked })} />
                                      Check characters on this URL
                                    </label>
                                    {(u.metacharsOnUrlCheck ?? false) && (
                                      <div>
                                        <div className="text-sm font-medium text-gray-700 mb-2">Character Set</div>
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex border-b border-gray-200">
                                            {[['meta-only','Meta Characters Only'],['all','All Characters']].map(([v, label]) => (
                                              <button key={v} onClick={() => setUrlMetaView(v)}
                                                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${urlMetaView === v ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                                {label}
                                              </button>
                                            ))}
                                          </div>
                                          <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            <input value={urlMetaSearch} onChange={e => setUrlMetaSearch(e.target.value)}
                                              placeholder="Search character or hexadecimal value"
                                              className="border border-gray-200 rounded px-2 py-0.5 w-56 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                          </div>
                                        </div>
                                        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                                          {visibleChars.map(m => {
                                            const allowed = getIsAllowed(m.hex)
                                            const isMeta = m.isMeta ?? true
                                            return (
                                              <div key={m.hex}
                                                onClick={() => isMeta && toggleChar(m.hex)}
                                                className={`relative border rounded p-2 text-center transition-colors ${isMeta ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default bg-gray-50 opacity-60'} ${allowed ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200'}`}>
                                                {isMeta && (
                                                  <span className={`absolute top-1 right-1 text-xs ${allowed ? 'text-blue-500' : 'text-red-400'}`}>
                                                    {allowed ? '✓' : '⊘'}
                                                  </span>
                                                )}
                                                <div className="text-xs font-medium text-gray-700">{m.name}</div>
                                                <div className="text-xs text-gray-400">{m.hex}</div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}

                              {urlSubTab === 'methods' && (() => {
                                const globalAllowed = new Set((pol.methods || []).map(m => m.name))
                                const overrides = u.methodOverrides || []
                                const overrideNames = new Set(overrides.map(o => o.name))
                                const rightMethods = STANDARD_METHODS.filter(m => !overrideNames.has(m))
                                const updateOverrides = (newOverrides) => { updateUrl({ methodOverrides: newOverrides }) }
                                return (
                                  <div>
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mb-3">
                                      <input type="checkbox" checked={u.methodsOverrideOnUrlCheck ?? false}
                                        onChange={e => { updateUrl({ methodsOverrideOnUrlCheck: e.target.checked }); setUrlMethodLeftSel(null); setUrlMethodRightSel(null) }} />
                                      Override policy allowed methods
                                    </label>
                                    {(u.methodsOverrideOnUrlCheck ?? false) && (
                                      <div className="flex gap-2 items-start">
                                        {/* Left panel — overridden */}
                                        <div className="flex-1 border border-gray-200 rounded overflow-hidden">
                                          <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 border-b border-gray-200">Overridden Security Policy Settings:</div>
                                          <table className="w-full text-xs">
                                            <thead><tr className="border-b border-gray-100 bg-gray-50">
                                              <th className="w-6 px-2 py-1.5"></th>
                                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">Method (Global State)</th>
                                              <th className="text-left px-3 py-1.5 font-medium text-gray-500">State</th>
                                            </tr></thead>
                                            <tbody>
                                              {overrides.length === 0
                                                ? <tr><td colSpan={3} className="px-3 py-2 text-gray-400 text-center">No overrides. Select methods from the right panel.</td></tr>
                                                : overrides.map((o, oi) => (
                                                  <tr key={o.name}
                                                    onClick={() => setUrlMethodLeftSel(urlMethodLeftSel === o.name ? null : o.name)}
                                                    className={`border-b border-gray-50 cursor-pointer ${urlMethodLeftSel === o.name ? 'bg-blue-100' : 'hover:bg-gray-50'}`}>
                                                    <td className="px-2 py-1.5 text-center">
                                                      <input type="checkbox" readOnly checked={urlMethodLeftSel === o.name} />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-gray-700">
                                                      {o.name} <span className={globalAllowed.has(o.name) ? 'text-green-600' : 'text-orange-500'}>({globalAllowed.has(o.name) ? 'Allowed' : 'Disallowed'})</span>
                                                    </td>
                                                    <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                                      <select value={o.allowed ? 'allow' : 'disallow'}
                                                        onChange={e => updateOverrides(overrides.map((x, j) => j === oi ? { ...x, allowed: e.target.value === 'allow' } : x))}
                                                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none">
                                                        <option value="allow">Allow</option>
                                                        <option value="disallow">Disallow</option>
                                                      </select>
                                                    </td>
                                                  </tr>
                                                ))
                                              }
                                            </tbody>
                                          </table>
                                        </div>
                                        {/* Move buttons */}
                                        <div className="flex flex-col gap-1 mt-8">
                                          <button
                                            onClick={() => {
                                              if (!urlMethodRightSel) return
                                              updateOverrides([...overrides, { name: urlMethodRightSel, allowed: globalAllowed.has(urlMethodRightSel) }])
                                              setUrlMethodRightSel(null)
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-xs font-mono">{'<<'}</button>
                                          <button
                                            onClick={() => {
                                              if (!urlMethodLeftSel) return
                                              updateOverrides(overrides.filter(o => o.name !== urlMethodLeftSel))
                                              setUrlMethodLeftSel(null)
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-xs font-mono">{'>>'}</button>
                                        </div>
                                        {/* Right panel — global */}
                                        <div className="w-56 border border-gray-200 rounded overflow-hidden">
                                          <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 border-b border-gray-200">Global Security Policy Settings:</div>
                                          <div className="max-h-48 overflow-y-auto">
                                            {rightMethods.map(m => (
                                              <div key={m}
                                                onClick={() => setUrlMethodRightSel(urlMethodRightSel === m ? null : m)}
                                                className={`px-3 py-1 text-xs cursor-pointer ${urlMethodRightSel === m ? 'bg-blue-500 text-white' : globalAllowed.has(m) ? 'text-green-700 hover:bg-gray-50' : 'text-orange-600 hover:bg-gray-50'}`}>
                                                {m} ({globalAllowed.has(m) ? 'Allowed' : 'Disallowed'})
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                            </>)}
                            </div>
                          </div>
                        </div>, document.body, `url-modal-${i}`)
                      })()
                    ]
                  })}
                </tbody>
              </table>
                  )}
                {/* Pagination — DeviceFleet style */}
                {urlFiltered.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {[10, 20, 50].map((size, idx) => (
                        <span key={size} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <button onClick={() => { setUrlPageSize(size); setUrlPageNum(1) }}
                            className={`px-1 py-0.5 rounded transition-colors ${urlPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                            {size}
                          </button>
                        </span>
                      ))}
                      
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>Page {urlSafePage} of {urlTotalPages}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setUrlPageNum(p => Math.max(1, p - 1))} disabled={urlSafePage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => setUrlPageNum(p => Math.min(urlTotalPages, p + 1))} disabled={urlSafePage >= urlTotalPages}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>)
          })()}
        </Card>
      )}

      {/* ── METHODS ── */}
      {activeTab === 'methods' && (() => {
        const PROTECTED = ['GET', 'POST']
        const ALL_METHODS = [
          'ACL','BCOPY','BDELETE','BMOVE','BPROPFIND','BPROPPATCH','CHECKIN','CHECKOUT',
          'CONNECT','COPY','DELETE','HEAD','LABEL','LOCK','MERGE','MKCOL','MKWORKSPACE',
          'MOVE','NOTIFY','OPTIONS','ORDERPATCH','PATCH','POLL','PROPFIND','PROPPATCH',
          'PUT','REPORT','SEARCH','SUBSCRIBE','TRACE','UNCHECKOUT','UNLOCK','UNSUBSCRIBE',
          'UPDATE','VERSION-CONTROL',
        ]
        const existing = new Set(methods.map(m => m.name.toUpperCase()))
        const available = ALL_METHODS.filter(m => !existing.has(m))

        const suggestions = newMethodName.trim()
          ? available.filter(m => m.startsWith(newMethodName.toUpperCase()))
          : available

        function addMethod() {
          const name = newMethodName.trim().toUpperCase()
          if (!name) return
          if (existing.has(name)) return
          setEditedPol(p => ({
            ...p,
            methods: [...(p.methods || []), { name, actAsMethod: newMethodActAs }],
          }))
          setUnsaved(true)
          setNewMethodName('')
          setShowMethodSuggestions(false)
        }

        return (
          <Card>
            <SectionHeader title="Allowed HTTP methods" sub={`${methods.length} methods`}
              onClick={() => toggleSection('methods')} collapsed={collapsed.methods} />
            {!collapsed.methods && (
              <div>
                {/* Add method row */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-gray-100">
                  <select
                    value={newMethodActAs}
                    onChange={e => setNewMethodActAs(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300">
                    <option value="GET">act as GET</option>
                    <option value="POST">act as POST</option>
                  </select>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newMethodName}
                      onChange={e => { setNewMethodName(e.target.value); setShowMethodSuggestions(true) }}
                      onFocus={() => setShowMethodSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowMethodSuggestions(false), 150)}
                      onKeyDown={e => e.key === 'Enter' && addMethod()}
                      placeholder="Specify or create method"
                      className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                    {showMethodSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-20 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {suggestions.map(m => (
                          <button key={m} onMouseDown={() => { setNewMethodName(m); setShowMethodSuggestions(false) }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 font-mono text-gray-700">
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Btn size="sm" onClick={addMethod} disabled={!newMethodName.trim()}>Add</Btn>
                </div>

                {methods.length === 0
                  ? <div className="p-4 text-xs text-gray-400">No methods configured.</div>
                  : (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2 font-medium text-gray-500">Method name</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">Acts as</th>
                        <th className="px-4 py-2" />
                      </tr></thead>
                      <tbody>
                        {methods.map((m, i) => {
                          const isProtected = PROTECTED.includes(m.name.toUpperCase())
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-2 font-mono font-medium text-gray-800">{m.name}</td>
                              <td className="px-4 py-2 font-mono text-gray-400">{m.actAsMethod || 'GET'}</td>
                              <td className="px-4 py-2 text-right">
                                {isProtected
                                  ? null
                                  : (
                                    <button
                                      onClick={() => removeItem('methods', i)}
                                      className="text-gray-300 hover:text-red-500 transition-colors"
                                      title="Remove">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                }
              </div>
            )}
          </Card>
        )
      })()}

      {/* ── FILE TYPES ── */}
      {activeTab === 'filetypes' && (() => {
        const fileTypes = pol.filetypes || []
        function openFtModal(idx, allowed) {
          let base
          if (idx === -1) {
            const nextWildcardOrder = Math.max(0, ...fileTypes.filter(f => f.type === 'wildcard').map(f => f.wildcardOrder || 0)) + 1
            base = allowed
              ? { allowed: true, fileTypeCategory: 'explicit', name: '', performStaging: true, responseCheck: false, urlLength: null, requestLength: null, queryStringLength: null, postDataLength: null, wildcardOrder: nextWildcardOrder }
              : { allowed: false, fileTypeCategory: 'explicit', name: '' }
          } else {
            const ft = JSON.parse(JSON.stringify(fileTypes[idx]))
            // Derive fileTypeCategory from schema fields
            const cat = ft.type === 'wildcard' ? 'wildcard' : ft.name === 'no_ext' ? 'no-extension' : 'explicit'
            // Convert checkXxxLength booleans to null (Any) or value
            base = {
              ...ft,
              fileTypeCategory: cat,
              responseCheck: ft.responseCheck ?? false,
              urlLength:         ft.checkUrlLength        ? (ft.urlLength         ?? null) : null,
              requestLength:     ft.checkRequestLength    ? (ft.requestLength     ?? null) : null,
              queryStringLength: ft.checkQueryStringLength? (ft.queryStringLength ?? null) : null,
              postDataLength:    ft.checkPostDataLength   ? (ft.postDataLength    ?? null) : null,
            }
          }
          setFtModalDraft(base)
          setFtModalIdx(idx)
          setFtCreateOpen(false)
        }
        function saveFtModal() {
          setEditedPol(p => {
            const arr = [...(p.filetypes || [])]
            const { fileTypeCategory, ...rest } = ftModalDraft
            const entry = { ...rest }
            // Set schema type field
            entry.type = fileTypeCategory === 'wildcard' ? 'wildcard' : 'explicit'
            if (fileTypeCategory === 'no-extension') entry.name = 'no_ext'
            if (fileTypeCategory !== 'wildcard') delete entry.wildcardOrder
            delete entry.fileTypeCategory
            // Convert null lengths to checkXxx: false, value lengths to checkXxx: true
            if (entry.allowed) {
              entry.checkUrlLength         = entry.urlLength         != null; if (entry.urlLength         == null) delete entry.urlLength
              entry.checkRequestLength     = entry.requestLength     != null; if (entry.requestLength     == null) delete entry.requestLength
              entry.checkQueryStringLength = entry.queryStringLength != null; if (entry.queryStringLength == null) delete entry.queryStringLength
              entry.checkPostDataLength    = entry.postDataLength    != null; if (entry.postDataLength    == null) delete entry.postDataLength
            }
            if (ftModalIdx === -1) arr.push(entry)
            else arr[ftModalIdx] = entry
            return { ...p, filetypes: arr }
          })
          setUnsaved(true)
          setFtModalIdx(null)
          setFtModalDraft(null)
        }
        function patchFt(patch) { setFtModalDraft(d => ({ ...d, ...patch })) }
        const d = ftModalDraft || {}
        const lenRow = (label, field) => {
          const val = d[field] ?? null
          return (
            <div className="flex items-center gap-4">
              <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">{label}</label>
              <div className="flex items-center gap-2">
                <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                  <button onClick={() => patchFt({ [field]: null })}
                    className={`px-3 py-1.5 ${val === null ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>Any</button>
                  <button onClick={() => patchFt({ [field]: val === null ? '' : val })}
                    className={`px-3 py-1.5 ${val !== null ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>Length</button>
                </div>
                {val !== null && (
                  <>
                    <input type="number" min={0} value={val}
                      onChange={e => patchFt({ [field]: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <span className="text-xs text-gray-400">bytes</span>
                  </>
                )}
              </div>
            </div>
          )
        }
        function ftDisplayName(ft) {
          if (ft.type === 'wildcard') return `${ft.name} (Wildcard)`
          if (ft.name === 'no_ext') return 'no_ext'
          return ft.name
        }
        const hasNoExt = fileTypes.some((ft, i) => ft.name === 'no_ext' && i !== ftModalIdx)
        const draftName = d ? (d.fileTypeCategory === 'no-extension' ? 'no_ext' : (d.name || '').trim()) : ''
        const isDuplicate = !!draftName && fileTypes.some((ft, i) => i !== ftModalIdx && ft.name === draftName)
        // Filter — keep real index for edit/delete
        let ftList = fileTypes.map((ft, i) => ({ ft, i }))
        if (ftSearch) ftList = ftList.filter(({ ft }) => ftDisplayName(ft).toLowerCase().includes(ftSearch.toLowerCase()))
        // Sort
        const ftKeyVal = ({ ft }) => {
          switch (ftSortCol) {
            case 'name': return ftDisplayName(ft).toLowerCase()
            case 'allowed': return ft.allowed ? 1 : 0
            case 'urlLength': return ft.urlLength ?? -1
            case 'requestLength': return ft.requestLength ?? -1
            case 'queryStringLength': return ft.queryStringLength ?? -1
            case 'postDataLength': return ft.postDataLength ?? -1
            case 'status': return ft.allowed ? (ft.performStaging !== false ? 'Staging' : 'Enforced') : ''
            default: return ''
          }
        }
        if (ftSortCol) {
          const dir = ftSortDir === 'desc' ? -1 : 1
          ftList = [...ftList].sort((a, b) => { const av = ftKeyVal(a), bv = ftKeyVal(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0 })
        }
        const ftFiltered = ftList
        const ftTotalPages = Math.max(1, Math.ceil(ftFiltered.length / ftPageSize))
        const ftSafePage = Math.min(ftPageNum, ftTotalPages)
        const ftPageRows = ftFiltered.slice((ftSafePage - 1) * ftPageSize, ftSafePage * ftPageSize)
        const ftSelIdxs = ftPageRows.map(r => r.i)
        const ftAllSel = ftSelIdxs.length > 0 && ftSelIdxs.every(i => ftSelected.has(i))
        const FT_SORT_COLS = [['name', 'File Type', 'text-left'], ['allowed', 'Allowed', 'text-center'], ['urlLength', 'URL Length', 'text-left'], ['requestLength', 'Request Length', 'text-left'], ['queryStringLength', 'Query String Length', 'text-left'], ['postDataLength', 'POST Data Length', 'text-left'], ['status', 'Status', 'text-left']]
        return (
          <div>
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">File Types</span>
              <div className="flex items-center gap-2">
                <input value={ftSearch} onChange={e => { setFtSearch(e.target.value); setFtPageNum(1) }}
                  placeholder="Search…"
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                {ftSelected.size > 0 && (
                  <div className="relative inline-flex">
                    <button onClick={bulkDeleteFts}
                      className="text-xs px-2.5 py-1.5 rounded-l bg-red-600 text-white hover:bg-red-700 border border-red-600 font-medium">
                      Delete ({ftSelected.size})
                    </button>
                    <button onClick={() => setFtDeleteMenuOpen(o => !o)} title="More delete options"
                      className="text-xs px-1.5 py-1.5 rounded-r bg-red-600 text-white hover:bg-red-700 border-y border-r border-red-600 border-l border-l-red-400">▾</button>
                    {ftDeleteMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-0" onClick={() => setFtDeleteMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
                          <button onClick={deleteAllFts}
                            className="block w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 whitespace-nowrap">
                            Delete All ({fileTypes.length})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="relative">
                  <button onClick={() => setFtCreateOpen(v => !v)}
                    className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                    Create <span className="text-[10px]">▾</span>
                  </button>
                  {ftCreateOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 w-44 py-1">
                      <button onClick={() => openFtModal(-1, true)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                        <span className="text-blue-500">✓</span> Allowed File Type
                      </button>
                      <button onClick={() => openFtModal(-1, false)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                        <span className="text-gray-400">✕</span> Disallowed File Type
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="w-8 px-2 py-2 text-center">
                      <input type="checkbox" checked={ftAllSel}
                        onChange={() => setFtSelected(s => { const n = new Set(s); if (ftAllSel) ftSelIdxs.forEach(i => n.delete(i)); else ftSelIdxs.forEach(i => n.add(i)); return n })} />
                    </th>
                    {FT_SORT_COLS.map(([key, label, align]) => (
                      <th key={key} onClick={() => sortFtBy(key)}
                        className={`px-4 py-2 ${align} font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-800 group`}>
                        <span className={`inline-flex items-center gap-1 ${align === 'text-center' ? 'justify-center' : ''}`}>
                          {label}
                          {ftSortCol === key ? (
                            <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ftSortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>
                          ) : (
                            <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {ftPageRows.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                      {ftSearch ? 'No file types match your search.' : 'No file types configured.'}
                    </td></tr>
                  )}
                  {ftPageRows.map(({ ft, i }) => (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${ftSelected.has(i) ? 'bg-blue-50' : ''}`}>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={ftSelected.has(i)} onChange={() => toggleFtSelected(i)} />
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-800">
                        {ftDisplayName(ft)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {ft.allowed ? <span className="text-blue-500 text-sm">✓</span> : <span className="text-gray-400 text-sm">✕</span>}
                      </td>
                      {['urlLength', 'requestLength', 'queryStringLength', 'postDataLength'].map(f => (
                        <td key={f} className="px-4 py-2 text-gray-700">
                          {!ft.allowed ? <span className="text-gray-300">N/A</span> : ft[f] != null ? ft[f] : <span className="text-gray-400">Any</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-gray-700">{ft.allowed ? (ft.performStaging !== false ? 'Staging' : 'Enforced') : ''}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => openFtModal(i)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit file type">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination — DeviceFleet style */}
            {ftFiltered.length > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {[10, 20, 50].map((size, idx) => (
                    <span key={size} className="flex items-center gap-2">
                      {idx > 0 && <span className="text-gray-300">|</span>}
                      <button onClick={() => { setFtPageSize(size); setFtPageNum(1) }}
                        className={`px-1 py-0.5 rounded transition-colors ${ftPageSize === size ? 'text-teal-700 font-semibold border border-teal-500 px-2' : 'hover:text-gray-700'}`}>
                        {size}
                      </button>
                    </span>
                  ))}
                  
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>Page {ftSafePage} of {ftTotalPages}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setFtPageNum(p => Math.max(1, p - 1))} disabled={ftSafePage <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => setFtPageNum(p => Math.min(ftTotalPages, p + 1))} disabled={ftSafePage >= ftTotalPages}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ── File Type Modal ── */}
          {ftModalIdx !== null && ftModalDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setFtModalIdx(null); setFtModalDraft(null) }}>
              <div className="bg-white rounded-xl shadow-2xl w-[667px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">File Type Properties</h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {d.allowed ? (
                    <>
                      {/* File Type */}
                      <div className="flex items-center gap-4">
                        <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">File Type <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-2 flex-1">
                          <select value={d.fileTypeCategory || 'explicit'} onChange={e => patchFt({ fileTypeCategory: e.target.value, name: e.target.value === 'no-extension' ? 'no_ext' : d.name })}
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="wildcard">Wildcard</option>
                            <option value="explicit">Explicit</option>
                            <option value="no-extension" disabled={hasNoExt}>No Extension{hasNoExt ? ' (already exists)' : ''}</option>
                          </select>
                          {d.fileTypeCategory !== 'no-extension' && (
                            <input value={d.name || ''} onChange={e => patchFt({ name: e.target.value })}
                              placeholder={d.fileTypeCategory === 'wildcard' ? 'e.g. *.php, image*' : 'e.g. php, jpg'}
                              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          )}
                        </div>
                      </div>
                      {/* Wildcard Order */}
                      {d.fileTypeCategory === 'wildcard' && (
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Wildcard Order</label>
                          <input type="number" min={1} value={d.wildcardOrder ?? 1}
                            onChange={e => patchFt({ wildcardOrder: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-24 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                          <span className="text-xs text-gray-400">lower = higher priority</span>
                        </div>
                      )}
                      {/* Perform Staging */}
                      <div className="flex items-center gap-4">
                        <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Perform Staging</label>
                        <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                          <button onClick={() => patchFt({ performStaging: true })}
                            className={`px-4 py-1.5 ${d.performStaging !== false ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>Enabled</button>
                          <button onClick={() => patchFt({ performStaging: false })}
                            className={`px-4 py-1.5 ${d.performStaging === false ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>Disabled</button>
                        </div>
                      </div>
                      {/* Response Signatures */}
                      <div className="flex items-center gap-4">
                        <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Response Signatures</label>
                        <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                          <button onClick={() => patchFt({ responseCheck: true })}
                            className={`px-4 py-1.5 ${d.responseCheck ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>Enforce</button>
                          <button onClick={() => patchFt({ responseCheck: false })}
                            className={`px-4 py-1.5 ${!d.responseCheck ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>Ignore</button>
                        </div>
                      </div>
                      {/* Length fields */}
                      {lenRow('URL Length', 'urlLength')}
                      {lenRow('Request Length', 'requestLength')}
                      {lenRow('Query String Length', 'queryStringLength')}
                      {lenRow('POST Data Length', 'postDataLength')}
                    </>
                  ) : (
                    /* Disallowed — explicit name only */
                    <div className="flex items-center gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">File Type (Explicit Only) <span className="text-red-500">*</span></label>
                      <input value={d.name || ''} onChange={e => patchFt({ name: e.target.value })}
                        placeholder="e.g. exe, bat"
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  )}
                </div>
                {isDuplicate && (
                  <div className="px-6 pb-3">
                    <div className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                      <span>File type <span className="font-medium">"{draftName}"</span> already exists.</span>
                    </div>
                  </div>
                )}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button onClick={() => { setFtModalIdx(null); setFtModalDraft(null) }}
                    className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveFtModal}
                    disabled={isDuplicate || (d.allowed ? (d.fileTypeCategory !== 'no-extension' && !d.name?.trim()) : !d.name?.trim())}
                    className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {ftModalIdx === -1 ? 'Add' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )
      })()}

      {/* ── VIOLATIONS ── */}
      {activeTab === 'violations' && (() => {
        const VIOL_GROUPS = [
          { label: 'Policy Building Settings',      prefixes: ['VIOL_POLICY_ENFORCEMENT'] },
          { label: 'Antivirus',                     prefixes: ['VIOL_VIRUS'] },
          { label: 'Attack Signatures',             prefixes: ['VIOL_ATTACK_SIGNATURE','VIOL_MALICIOUS_','VIOL_THREAT_CAMPAIGN'] },
          { label: 'CSRF Protection',               prefixes: ['VIOL_CSRF'] },
          { label: 'Content Profiles',              prefixes: ['VIOL_JSON_','VIOL_XML_','VIOL_GRAPHQL_','VIOL_GWT_','VIOL_PLAINTEXT_'] },
          { label: 'Cookies',                       prefixes: ['VIOL_COOKIE_','VIOL_ASM_COOKIE_MODIFIED'] },
          { label: 'Data Guard',                    prefixes: ['VIOL_DATA_'] },
          { label: 'Evasion technique detected',    prefixes: ['VIOL_EVASION'] },
          { label: 'File Types',                    prefixes: ['VIOL_FILETYPE','VIOL_FILE_UPLOAD'], names: ['VIOL_URL_LENGTH','VIOL_POST_DATA_LENGTH','VIOL_QUERY_STRING_LENGTH','VIOL_REQUEST_LENGTH'] },
          { label: 'General Settings',              prefixes: [], names: ['VIOL_ENCODING','VIOL_PARAMETER_VALUE_BASE64','VIOL_HTTP_RESPONSE_STATUS','VIOL_DYNAMIC_SESSION','VIOL_REQUEST_MAX_LENGTH','VIOL_RATING_NEED_EXAMINATION','VIOL_RATING_THREAT','VIOL_CONVICTION','VIOL_BLOCKING_CONDITION','VIOL_THREAT_ANALYSIS'] },
          { label: 'Headers',                       prefixes: ['VIOL_HEADER_','VIOL_MANDATORY_HEADER'], names: ['VIOL_METHOD','VIOL_HOSTNAME','VIOL_HOSTNAME_MISMATCH'] },
          { label: 'HTTP protocol compliance failed', prefixes: ['VIOL_HTTP_PROTOCOL'] },
          { label: 'IP Addresses and Geolocations', names: ['VIOL_GEOLOCATION','VIOL_MALICIOUS_IP','VIOL_MALICIOUS_DEVICE','VIOL_BLACKLISTED_IP'] },
          { label: 'Parameters',                    prefixes: ['VIOL_PARAMETER','VIOL_MANDATORY_PARAMETER'], names: ['VIOL_DATA_INTEGRITY','VIOL_FILE_UPLOAD','VIOL_SERVER_SIDE_HOST'] },
          { label: 'Redirection Domains',           prefixes: ['VIOL_REDIRECT','VIOL_CROSS_ORIGIN_REQUEST'] },
          { label: 'Server Technologies',           prefixes: ['VIOL_SERVER_SIDE_HOST'] },
          { label: 'Sessions and Logins',           prefixes: ['VIOL_ACCESS_','VIOL_SESSION_','VIOL_LOGIN','VIOL_DYNAMIC_SESSION','VIOL_ASM_COOKIE_HIJACKING'], names: ['VIOL_LEAKED_CREDENTIALS','VIOL_BRUTE_FORCE'] },
          { label: 'URLs',                          names: ['VIOL_URL','VIOL_URL_METACHAR','VIOL_URL_CONTENT_TYPE','VIOL_FILE_UPLOAD_IN_BODY','VIOL_CROSS_ORIGIN_REQUEST','VIOL_FLOW','VIOL_FLOW_ENTRY_POINT','VIOL_FLOW_MANDATORY_PARAMS','VIOL_FLOW_DISALLOWED_INPUT','VIOL_MANDATORY_REQUEST_BODY','VIOL_WEBSOCKET_BINARY_MESSAGE_NOT_ALLOWED','VIOL_WEBSOCKET_TEXT_MESSAGE_NOT_ALLOWED','VIOL_WEBSOCKET_BINARY_MESSAGE_LENGTH','VIOL_WEBSOCKET_FRAME_LENGTH','VIOL_WEBSOCKET_EXTENSION','VIOL_WEBSOCKET_FRAMES_PER_MESSAGE_COUNT'] },
          { label: 'WebSocket Protocol Compliance', names: ['VIOL_WEBSOCKET_BAD_REQUEST','VIOL_WEBSOCKET_FRAMING_PROTOCOL','VIOL_WEBSOCKET_FRAME_MASKING','VIOL_WEBSOCKET_TEXT_NULL_VALUE'] },
        ]
        // Human-friendly title from the device's violation catalog; fall back to the VIOL_ name.
        const titleByName = Object.fromEntries(deviceViolations.map(d => [d.name, d.title]).filter(([, t]) => t))
        const violTitle = (v) => titleByName[v.name] || v.name

        // The policy only stores a subset of violations; merge in the device's full catalog so every
        // section shows its complete set (like BIG-IP). Catalog-only rows default to off and get
        // written into the policy on first toggle.
        const polNames = new Set(violations.map(v => v.name))
        const allViolations = [...violations]
        for (const dv of deviceViolations) {
          if (!polNames.has(dv.name)) allViolations.push({ name: dv.name, alarm: false, block: false, learn: false })
        }
        // VIOL_XML_WEB_SERVICES_SECURITY has its own dedicated panel — keep it out of the grouped list.
        const WSS_PARENT_NAME = 'VIOL_XML_WEB_SERVICES_SECURITY'
        const groupingViolations = allViolations.filter(v => v.name !== WSS_PARENT_NAME)

        // Upsert a violation flag by name (handles catalog-only rows not yet in the policy).
        const toggleViolation = (name, field) => {
          setEditedPol(p => {
            const bs = { ...(p['blocking-settings'] || {}) }
            const arr = [...(bs.violations || [])]
            const i = arr.findIndex(v => v.name === name)
            if (i === -1) arr.push({ name, alarm: false, block: false, learn: false, [field]: true })
            else arr[i] = { ...arr[i], [field]: !(arr[i][field] ?? false) }
            bs.violations = arr
            return { ...p, 'blocking-settings': bs }
          })
          setUnsaved(true)
        }

        // Exact-name matches take precedence over prefix matches (pass 1 = names, pass 2 = prefixes),
        // so e.g. VIOL_FILE_UPLOAD_IN_BODY lands in URLs rather than File Types' VIOL_FILE_UPLOAD prefix.
        const assigned = new Set()
        const memberMap = new Map(VIOL_GROUPS.map(g => [g.label, []]))
        for (const v of groupingViolations) {
          const g = VIOL_GROUPS.find(g => (g.names || []).includes(v.name))
          if (g) { memberMap.get(g.label).push(v); assigned.add(v.name) }
        }
        for (const v of groupingViolations) {
          if (assigned.has(v.name)) continue
          const g = VIOL_GROUPS.find(g => (g.prefixes || []).some(p => v.name.startsWith(p)))
          if (g) { memberMap.get(g.label).push(v); assigned.add(v.name) }
        }
        const byTitle = (a, b) => violTitle(a).localeCompare(violTitle(b))
        const groups = VIOL_GROUPS
          .map(g => ({ ...g, members: [...memberMap.get(g.label)].sort(byTitle) }))
          .filter(g => g.members.length > 0)
          .sort((a, b) => a.label.localeCompare(b.label))   // panels alphabetical
        const uncategorized = groupingViolations.filter(v => !assigned.has(v.name)).sort(byTitle)
        if (uncategorized.length > 0) groups.push({ label: 'Other', members: uncategorized })

        // Evasion-techniques sub-table, shown under the "Evasion technique detected" group.
        const evasionNormalizationOn = headers.some(h => h.urlNormalization || h.htmlNormalization || h.percentDecoding)
        const evasionsPanel = (
          <div className="border-t border-gray-100 w-[78%] pl-[10px] border-l-2 border-blue-300 bg-blue-50/50">
            {!evasionNormalizationOn && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                Evasion technique violations are <strong className="mx-1">disabled</strong> — enable at least one Normalization option in the Headers tab to activate them.
              </div>
            )}
            {evasions.length === 0
              ? <div className="p-4 text-xs text-gray-400">No evasion settings.</div>
              : (
                <table className={`w-full text-xs ${!evasionNormalizationOn ? 'opacity-40 pointer-events-none' : ''}`}>
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Technique</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Enable</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                  </tr></thead>
                  <tbody>
                    {evasions.map((e, i) => {
                      const isMultiDecode = (e.description || e.name || '').toLowerCase().includes('multiple decoding')
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-800">
                            <span>{e.description || e.name}</span>
                            {isMultiDecode && (
                              <span className="ml-2 text-gray-500 font-normal">
                                (considered an evasion after{' '}
                                <select
                                  value={e.maxDecodingPasses ?? 3}
                                  onChange={ev => setBlockingItemField('evasions', i, 'maxDecodingPasses', Number(ev.target.value))}
                                  onClick={ev => ev.stopPropagation()}
                                  className="mx-1 border border-gray-300 rounded px-1 py-0.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                decoding passes)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center"><Toggle on={e.enabled ?? false} onClick={() => toggleBlockingItem('evasions', i, 'enabled')} /></td>
                          <td className="px-4 py-2 text-center"><Toggle on={e.learn ?? false}   onClick={() => toggleBlockingItem('evasions', i, 'learn')} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            }
          </div>
        )

        // HTTP-protocol-compliance sub-table, shown under the "HTTP protocol compliance failed" group.
        const httpProtoPanel = (
          <div className="border-t border-gray-100 w-[78%] pl-[10px] border-l-2 border-blue-300 bg-blue-50/50">
            {httpProtos.length === 0
              ? <div className="p-4 text-xs text-gray-400">No HTTP protocol settings.</div>
              : (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Check</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Enable</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                  </tr></thead>
                  <tbody>
                    {httpProtos.map((h, i) => {
                      const desc = (h.description || h.name || '').toLowerCase()
                      // Keys must match what BIG-IP emits on blocking-settings.http-protocols:
                      // maxCookies / maxParams / maxHeaders — NOT the maximum* spelling the
                      // policy-builder-* sections use.
                      const maxCountCfg =
                        /maximum number of cookies/.test(desc)
                          ? { prop: 'maxCookies',        label: 'cookies',    default: 50 }
                          : /maximum number of parameters/.test(desc)
                            ? { prop: 'maxParams',         label: 'parameters', default: 500 }
                            : /maximum number of headers/.test(desc)
                              ? { prop: 'maxHeaders',        label: 'headers',    default: 20 }
                              : null
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-800">
                            <span>{h.description || h.name}</span>
                            {maxCountCfg && (
                              <span className="ml-2 text-gray-500 font-normal">
                                (maximum{' '}
                                <input
                                  type="number"
                                  min={1}
                                  value={h[maxCountCfg.prop] ?? maxCountCfg.default}
                                  onChange={ev => setBlockingItemField('http-protocols', i, maxCountCfg.prop, Number(ev.target.value))}
                                  onClick={ev => ev.stopPropagation()}
                                  className="mx-1 w-16 border border-gray-300 rounded px-1 py-0.5 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                                {maxCountCfg.label})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center"><Toggle on={h.enabled ?? false} onClick={() => toggleBlockingItem('http-protocols', i, 'enabled')} /></td>
                          <td className="px-4 py-2 text-center">
                            {h.learn === undefined
                              ? <span className="text-gray-300">—</span>
                              : <Toggle on={h.learn} onClick={() => toggleBlockingItem('http-protocols', i, 'learn')} />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            }
          </div>
        )

        // Web Services Security failure sub-violations, shown under the "Content Profiles" group.
        const wssList = pol['blocking-settings']?.['web-services-securities'] || []
        const wssRows = wssList.length ? wssList : WSS_SUBVIOLATIONS.map(d => ({ description: d, enabled: true, learn: true }))
        const toggleWss = (i, field) => {
          setEditedPol(p => {
            const bs = { ...(p['blocking-settings'] || {}) }
            let arr = [...(bs['web-services-securities'] || [])]
            if (arr.length === 0) arr = WSS_SUBVIOLATIONS.map(d => ({ description: d, enabled: true, learn: true }))
            arr[i] = { ...arr[i], [field]: !(arr[i][field] ?? false) }
            bs['web-services-securities'] = arr
            return { ...p, 'blocking-settings': bs }
          })
          setUnsaved(true)
        }
        const wssCollapsed = collapsed['wss-panel'] ?? true
        const wssParent = allViolations.find(v => v.name === 'VIOL_XML_WEB_SERVICES_SECURITY') || { name: 'VIOL_XML_WEB_SERVICES_SECURITY' }
        const wssPanel = (
          <Card>
            <SectionHeader
              title="Web Services Security failure"
              sub={`${wssRows.length} sub-violations`}
              onClick={() => setCollapsed(p => ({ ...p, 'wss-panel': !wssCollapsed }))}
              collapsed={wssCollapsed}
              action={
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5">Learn <Toggle on={wssParent.learn ?? false} onClick={() => toggleViolation('VIOL_XML_WEB_SERVICES_SECURITY', 'learn')} /></span>
                  <span className="flex items-center gap-1.5">Alarm <Toggle on={wssParent.alarm ?? false} onClick={() => toggleViolation('VIOL_XML_WEB_SERVICES_SECURITY', 'alarm')} /></span>
                  <span className="flex items-center gap-1.5">Block <Toggle on={wssParent.block ?? false} onClick={() => toggleViolation('VIOL_XML_WEB_SERVICES_SECURITY', 'block')} /></span>
                </div>
              }
            />
            {!wssCollapsed && (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Sub-Violation</th>
                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Enable</th>
                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                </tr></thead>
                <tbody>
                  {wssRows.map((w, i) => (
                    <tr key={w.description} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{w.description}</td>
                      <td className="px-4 py-2 text-center"><Toggle on={w.enabled ?? false} onClick={() => toggleWss(i, 'enabled')} /></td>
                      <td className="px-4 py-2 text-center"><Toggle on={w.learn ?? false} onClick={() => toggleWss(i, 'learn')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )

        // Violations whose alarm/block/learn are fixed by BIG-IP and can't be edited.
        const READONLY_VIOLATIONS = new Set(['VIOL_CONVICTION', 'VIOL_BLOCKING_CONDITION', 'VIOL_THREAT_ANALYSIS'])

        const violRow = (v) => {
          const visible = !violFilter || violTitle(v).toLowerCase().includes(violFilter.toLowerCase()) || v.name.toLowerCase().includes(violFilter.toLowerCase())
          if (!visible) return null
          const ro = READONLY_VIOLATIONS.has(v.name)
          return (
            <tr key={v.name} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-800" title={v.name}>{violTitle(v)}</td>
              <td className="px-4 py-2 text-center">
                {v.learn === undefined
                  ? <span className="text-gray-300">—</span>
                  : <Toggle on={v.learn} disabled={ro} onClick={() => toggleViolation(v.name, 'learn')} />}
              </td>
              <td className="px-4 py-2 text-center"><Toggle on={v.alarm ?? false} disabled={ro} onClick={() => toggleViolation(v.name, 'alarm')} /></td>
              <td className="px-4 py-2 text-center"><Toggle on={v.block ?? false} disabled={ro} onClick={() => toggleViolation(v.name, 'block')} /></td>
            </tr>
          )
        }

        return (
          <div className="space-y-2">
            {/* Filter bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-400">{groupingViolations.length} violations in {groups.length} categories</span>
              <input value={violFilter} onChange={e => setViolFilter(e.target.value)}
                placeholder="Filter violations…"
                className="text-xs border border-gray-200 rounded px-2 py-1 w-44 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            {groups.map(g => {
              const rows = g.members.map(v => violRow(v)).filter(Boolean)
              if (rows.length === 0) return null
              const key = `viol-group-${g.label}`
              const isCollapsed = collapsed[key] ?? true
              return (
                <Card key={g.label}>
                  <SectionHeader
                    title={g.label}
                    sub={`${rows.length} violation${rows.length !== 1 ? 's' : ''}`}
                    onClick={() => setCollapsed(p => ({ ...p, [key]: !isCollapsed }))}
                    collapsed={isCollapsed}
                  />
                  {!isCollapsed && (
                    <>
                      {g.label === 'URLs' && (
                        <UrlLearningSettings
                          pbu={editedPol['policy-builder-url'] || {}}
                          onChange={patch => {
                            setEditedPol(p => {
                              const merged = { ...(p['policy-builder-url'] || {}), ...patch }
                              Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k])
                              return { ...p, 'policy-builder-url': merged }
                            })
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'Cookies' && (
                        <CookieLearningSettings
                          pbc={editedPol['policy-builder-cookie'] || {}}
                          onChange={patch => {
                            setEditedPol(p => {
                              const merged = { ...(p['policy-builder-cookie'] || {}), ...patch }
                              Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k])
                              return { ...p, 'policy-builder-cookie': merged }
                            })
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'File Types' && (
                        <FiletypeLearningSettings
                          pbf={editedPol['policy-builder-filetype'] || {}}
                          onChange={patch => {
                            setEditedPol(p => {
                              const merged = { ...(p['policy-builder-filetype'] || {}), ...patch }
                              Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k])
                              return { ...p, 'policy-builder-filetype': merged }
                            })
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'Parameters' && (
                        <ParameterLearningSettings
                          pbp={editedPol['policy-builder-parameter'] || {}}
                          onChange={patch => {
                            setEditedPol(p => {
                              const merged = { ...(p['policy-builder-parameter'] || {}), ...patch }
                              Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k])
                              return { ...p, 'policy-builder-parameter': merged }
                            })
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'Redirection Domains' && (
                        <RedirectionLearningSettings
                          pbr={editedPol['policy-builder-redirection-protection'] || {}}
                          onChange={patch => {
                            setEditedPol(p => {
                              const merged = { ...(p['policy-builder-redirection-protection'] || {}), ...patch }
                              Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k])
                              return { ...p, 'policy-builder-redirection-protection': merged }
                            })
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'Sessions and Logins' && (
                        <SessionsLoginsSettings
                          pbs={editedPol['policy-builder-sessions-and-logins'] || {}}
                          onChange={patch => {
                            setEditedPol(p => ({ ...p, 'policy-builder-sessions-and-logins': { ...(p['policy-builder-sessions-and-logins'] || {}), ...patch } }))
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'Headers' && (
                        <HeaderLearningSettings
                          pbh={editedPol['policy-builder-header'] || {}}
                          onChange={patch => {
                            setEditedPol(p => {
                              const merged = { ...(p['policy-builder-header'] || {}), ...patch }
                              Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k])
                              return { ...p, 'policy-builder-header': merged }
                            })
                            setUnsaved(true)
                          }}
                        />
                      )}
                      {g.label === 'Attack Signatures' ? (
                        <div className="px-4 py-4 space-y-3">
                          <div className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50/60 border border-blue-100 rounded p-3">
                            <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>
                              Attack signatures are not configured here — manage them on the{' '}
                              <button type="button" onClick={() => setActiveTab('signatures')} className="text-blue-600 font-medium underline hover:text-blue-800">Signatures page</button>.
                            </span>
                          </div>
                          {(() => {
                            const tcRows = g.members.filter(v => v.name !== 'VIOL_ATTACK_SIGNATURE' && !v.name.startsWith('VIOL_MALICIOUS_')).map(v => violRow(v)).filter(Boolean)
                            return tcRows.length > 0 ? (
                              <table className="w-full text-xs border border-gray-100 rounded">
                                <thead><tr className="border-b border-gray-100 bg-gray-50">
                                  <th className="text-left px-4 py-2 font-medium text-gray-500">Violation</th>
                                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Alarm</th>
                                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Block</th>
                                </tr></thead>
                                <tbody>{tcRows}</tbody>
                              </table>
                            ) : null
                          })()}
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                            <Toggle
                              on={editedPol['policy-builder-server-technologies']?.enableServerTechnologiesDetection ?? false}
                              onClick={() => {
                                setEditedPol(p => {
                                  const cur = p['policy-builder-server-technologies'] || {}
                                  return { ...p, 'policy-builder-server-technologies': { ...cur, enableServerTechnologiesDetection: !(cur.enableServerTechnologiesDetection ?? false) } }
                                })
                                setUnsaved(true)
                              }}
                            />
                            Enable Server Technology Detection
                          </label>
                        </div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Violation</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Alarm</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Block</th>
                          </tr></thead>
                          <tbody>{rows}</tbody>
                        </table>
                      )}
                      {g.label === 'Evasion technique detected' && evasionsPanel}
                      {g.label === 'HTTP protocol compliance failed' && httpProtoPanel}
                    </>
                  )}
                </Card>
              )
            })}
            {wssPanel}
          </div>
        )
      })()}

      {/* ── EVASIONS (legacy standalone tab, kept for reference; now under Blocking Settings) ── */}
      {false && activeTab === 'evasions' && (() => {
        const normalizationOn = headers.some(h => h.urlNormalization || h.htmlNormalization || h.percentDecoding)
        return (
          <Card>
            <SectionHeader title="Evasion techniques" sub={`${evasions.length} checks`}
              onClick={() => toggleSection('evasions')} collapsed={collapsed.evasions} />
            {!collapsed.evasions && (
              <>
                {!normalizationOn && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                    Evasion technique violations are <strong className="mx-1">disabled</strong> — enable at least one Normalization option in the Headers tab to activate them.
                  </div>
                )}
                {evasions.length === 0
                  ? <div className="p-4 text-xs text-gray-400">No evasion settings.</div>
                  : (
                    <table className={`w-full text-xs ${!normalizationOn ? 'opacity-40 pointer-events-none' : ''}`}>
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2 font-medium text-gray-500">Technique</th>
                        <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Enable</th>
                        <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                      </tr></thead>
                      <tbody>
                        {evasions.map((e, i) => {
                          const isMultiDecode = (e.description || e.name || '').toLowerCase().includes('multiple decoding')
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-800">
                                <span>{e.description || e.name}</span>
                                {isMultiDecode && (
                                  <span className="ml-2 text-gray-500 font-normal">
                                    (considered an evasion after{' '}
                                    <select
                                      value={e.maxDecodingPasses ?? 3}
                                      onChange={ev => setBlockingItemField('evasions', i, 'maxDecodingPasses', Number(ev.target.value))}
                                      onClick={ev => ev.stopPropagation()}
                                      className="mx-1 border border-gray-300 rounded px-1 py-0.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    decoding passes)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center"><Toggle on={e.enabled ?? false} onClick={() => toggleBlockingItem('evasions', i, 'enabled')} /></td>
                              <td className="px-4 py-2 text-center"><Toggle on={e.learn ?? false}   onClick={() => toggleBlockingItem('evasions', i, 'learn')} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                }
              </>
            )}
          </Card>
        )
      })()}

      {/* ── BLOCKING PAGES ── */}
      {activeTab === 'blocking-pages' && (() => {
        // Per-page action options differ by page type (matches BIG-IP UI)
        const PAGE_CONFIG = [
          { type: 'default',               label: 'Blocking Page Default',              actions: ['default','custom','redirect','soap-fault','erase-cookies'] },
          { type: 'persistent-flow',       label: 'Login Page',                         actions: ['default','custom','redirect','soap-fault','erase-cookies'] },
          { type: 'xml',                   label: 'XML',                                actions: ['soap-fault','custom'] },
          { type: 'hijack',                label: 'Cookie Hijacking',                   actions: ['default','custom','soap-fault','erase-cookies'] },
          { type: 'captcha',               label: 'CAPTCHA',                            actions: ['default','custom'] },
          { type: 'captcha-fail',          label: 'CAPTCHA Fail',                       actions: ['default','custom'] },
          { type: 'failed-login-honeypot', label: 'Failed Login Honeypot',              actions: ['default','custom'] },
          { type: 'leaked-credentials',    label: 'Leaked Credentials',                 actions: ['default','custom'] },
          { type: 'mobile',                label: 'Mobile Application',                 actions: ['default','custom'] },
          { type: 'graphql',               label: 'GraphQL',                            actions: ['default','custom','redirect'] },
        ]
        const AJAX_CONFIG = [
          { type: 'ajax',                      label: 'Default Response Page Action',                actions: ['alert-popup','custom','redirect'], defaultPopup: 'The requested URL was rejected. Please consult with your administrator. Your support ID is: <%TS.request.ID()%>' },
          { type: 'ajax-login',                label: 'Login Page Response Action',                  actions: ['alert-popup','custom','redirect'], defaultPopup: 'The requested URL was rejected. Please consult with your administrator. Your support ID is: <%TS.request.ID()%>' },
          { type: 'failed-login-honeypot-ajax',label: 'Failed Login Honeypot Page Response Action',  actions: ['alert-popup','custom','redirect'], defaultPopup: 'Login Failed. Username or password is incorrect. Please try to log in again.' },
          { type: 'leaked-credentials-ajax',   label: 'Leaked Credentials Response Action',          actions: ['alert-popup','custom','redirect'], defaultPopup: 'These username and password were found in the Leaked Credentials Data Base. They maybe used by attackers to compromise your account. Please change password.' },
        ]
        const ACTION_LABELS = {
          'default':      'Default Response',
          'custom':       'Custom Response',
          'redirect':     'Redirect URL',
          'soap-fault':   'SOAP Fault',
          'erase-cookies':'Erase Cookies',
          'alert-popup':  'Popup Message',
        }
        const responsePages = pol['response-pages'] || []
        const getPage = (type) => responsePages.find(p => p.responsePageType === type) || { responsePageType: type }
        const updatePage = (type, patch) => {
          const arr = [...responsePages]
          const idx = arr.findIndex(p => p.responsePageType === type)
          if (idx === -1) arr.push({ responsePageType: type, ...patch })
          else arr[idx] = { ...arr[idx], ...patch }
          setEditedPol(p => ({ ...p, 'response-pages': arr }))
          setUnsaved(true)
        }
        const DEFAULT_RESPONSE_HEADERS = 'HTTP/1.1 200 OK\nCache-Control: no-cache\nPragma: no-cache\nConnection: close'
        const DEFAULT_RESPONSE_BODY = "<html><head><title>Request Rejected</title></head><body>The requested URL was rejected. Please consult with your administrator.<br><br>Your support ID is: <%TS.request.ID()%><br><br><a href='javascript:history.back();'>[Go Back]</a><%TS.script.erase_cookies%></body></html>"
        const SOAP_FAULT_HEADERS = 'HTTP/1.1 200 OK\nCache-Control: no-cache\nPragma: no-cache\nContent-type: text/xml\nConnection: close'
        const SOAP_FAULT_BODY = "<?xml version='1.0' encoding='utf-8'?><soap:Envelope xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body><soap:Fault><faultcode>soap:Client</faultcode><faultstring>The requested operation was rejected. Please consult with your administrator.Your support ID is: <%TS.request.ID()%></faultstring><detail/></soap:Fault></soap:Body></soap:Envelope>"

        // Per-page-type override for the default response body
        const PAGE_DEFAULT_BODIES = {
          'captcha':               'This question is for testing whether you are a human visitor and to prevent automated spam submission.<br>%ASM.captcha.image% %ASM.captcha.audio% %ASM.captcha.change%<br><b>What code is in the image?</b>%ASM.captcha.solution%<br>%ASM.captcha.submit%<br><br>Your support ID is: %ASM.captcha.support_id%.',
          'captcha-fail':          'You have entered an invalid answer for the question. Please try again.<br>%ASM.captcha.image% %ASM.captcha.audio% %ASM.captcha.change%<br><b>What code is in the image?</b>%ASM.captcha.solution%<br>%ASM.captcha.submit%<br><br>Your support ID is: %ASM.captcha.support_id%.',
          'failed-login-honeypot': "<html><head><title>Login Failed</title></head><body>Username or password is incorrect. Please try to log in again.<br><br><a href=\"javascript:history.back();\">[Go Back]</a></body></html>",
          'leaked-credentials':    "<html><head><title>Leaked Credentials Detected</title></head><body>These username and password were found in the Leaked Credentials Data Base. These credentials may be used by attackers to compromise your account. Please change the password.<br><br><a href=\"javascript:history.back();\">[Go Back]</a></body></html>",
          'mobile':                '{\n    "supportID": "<%TS.request.ID()%>",\n    "response_type": "<%TS.response_type()%>"\n}',
          'graphql':               '{\n  "errors": [\n    {\n      "message": "The requested query was rejected. Please consult with your administrator. Your support ID is: <%TS.request.ID()%>"\n    }\n  ]\n}',
        }

        const READONLY_CONTENT = {
          'erase-cookies':{ headers: DEFAULT_RESPONSE_HEADERS, body: DEFAULT_RESPONSE_BODY },
          'soap-fault':   { headers: SOAP_FAULT_HEADERS,       body: SOAP_FAULT_BODY       },
        }


        const rpEntry = (cfg) => {
          const page = getPage(cfg.type)
          const action = page.responseActionType || cfg.actions[0]
          const tab = rpTabState[cfg.type] || 'headers'
          const isCustom = action === 'custom'
          const readonlyContent = action === 'default'
            ? { headers: DEFAULT_RESPONSE_HEADERS, body: PAGE_DEFAULT_BODIES[cfg.type] ?? DEFAULT_RESPONSE_BODY }
            : READONLY_CONTENT[action]
          const showTabs = action !== 'redirect'

          const tabContent = readonlyContent
            ? (tab === 'headers' ? readonlyContent.headers : readonlyContent.body)
            : (tab === 'headers' ? (page.responseHeader || '') : (page.responseContent || ''))

          return (
            <div key={cfg.type} className="flex gap-6 px-6 py-4 border-b border-gray-100 last:border-0">
              <div className="w-44 flex-shrink-0 pt-0.5">
                <span className="text-xs font-semibold text-gray-800">{cfg.label}</span>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Response Type</span>
                  <select value={action} onChange={e => updatePage(cfg.type, { responseActionType: e.target.value })}
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                    {cfg.actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                  </select>
                </div>
                {action === 'redirect' ? (
                  <input value={page.responseRedirectUrl || ''} onChange={e => updatePage(cfg.type, { responseRedirectUrl: e.target.value })}
                    placeholder="Add URL"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-500" />
                ) : showTabs && (
                  <div>
                    <div className="flex gap-4 border-b border-gray-200 w-full mb-1">
                      <button onClick={() => setRpTabState(s => ({...s, [cfg.type]: 'headers'}))}
                        className={`text-xs pb-1 border-b-2 -mb-px transition-colors ${tab === 'headers' ? 'border-gray-700 text-gray-800 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        Response Headers
                      </button>
                      <button onClick={() => setRpTabState(s => ({...s, [cfg.type]: 'body'}))}
                        className={`text-xs pb-1 border-b-2 -mb-px transition-colors ${tab === 'body' ? 'border-gray-700 text-gray-800 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        Response Body
                      </button>
                    </div>
                    <textarea rows={5}
                      readOnly={!isCustom}
                      value={tabContent}
                      onChange={isCustom ? (e => updatePage(cfg.type, { [tab === 'headers' ? 'responseHeader' : 'responseContent']: e.target.value })) : undefined}
                      className={`w-full text-xs border border-gray-300 rounded px-2 py-1.5 font-mono resize-y ${isCustom ? 'focus:outline-none focus:ring-1 focus:ring-blue-400' : 'bg-gray-50 text-gray-400 cursor-default select-none'}`} />
                  </div>
                )}
              </div>
            </div>
          )
        }

        const ajaxEntry = (cfg) => {
          const page = getPage(cfg.type)
          const action = page.ajaxActionType || cfg.actions[0]
          const isPopup = action === 'alert-popup'
          const isCustom = action === 'custom'
          return (
            <div key={cfg.type} className="flex gap-6 px-6 py-4 border-b border-gray-100 last:border-0">
              <div className="w-44 flex-shrink-0 pt-0.5">
                <span className="text-xs font-semibold text-gray-800">{cfg.label}</span>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Response Type</span>
                  <select value={action} onChange={e => updatePage(cfg.type, { ajaxActionType: e.target.value })}
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                    {cfg.actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                  </select>
                </div>
                {action === 'redirect' ? (
                  <input value={page.ajaxRedirectUrl || ''} onChange={e => updatePage(cfg.type, { ajaxRedirectUrl: e.target.value })}
                    placeholder="Add URL"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-500" />
                ) : isPopup ? (
                  <textarea rows={4} readOnly
                    value={cfg.defaultPopup}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-gray-50 text-gray-400 cursor-default select-none resize-y" />
                ) : isCustom ? (
                  <textarea rows={4}
                    value={page.ajaxCustomContent || ''}
                    onChange={e => updatePage(cfg.type, { ajaxCustomContent: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-y" />
                ) : null}
              </div>
            </div>
          )
        }

        const ajaxPage = getPage('ajax')
        const ajaxEnabled = ajaxPage.ajaxEnabled ?? false

        return (
          <div className="space-y-3">
            <Card>
              {PAGE_CONFIG.map(cfg => rpEntry(cfg))}
            </Card>
            <Card>
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">AJAX Blocking Behavior (JavaScript Injection)</span>
                <Toggle on={ajaxEnabled} onClick={() => updatePage('ajax', { ajaxEnabled: !ajaxEnabled })} />
              </div>
              {ajaxEnabled && AJAX_CONFIG.map(cfg => ajaxEntry(cfg))}
            </Card>
          </div>
        )
      })()}

      {/* ── HTTP PROTOCOLS ── */}
      {false && activeTab === 'http' && (
        <Card>
          <SectionHeader title="HTTP protocol compliance" sub={`${httpProtos.length} checks`}
            onClick={() => toggleSection('http')} collapsed={collapsed.http} />
          {!collapsed.http && (httpProtos.length === 0
            ? <div className="p-4 text-xs text-gray-400">No HTTP protocol settings.</div>
            : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Check</th>
                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Enable</th>
                  <th className="px-4 py-2 font-medium text-gray-500 text-center w-20">Learn</th>
                </tr></thead>
                <tbody>
                  {httpProtos.map((h, i) => {
                    const desc = (h.description || h.name || '').toLowerCase()
                    const maxCountCfg =
                      /maximum number of cookies/.test(desc)
                        ? { prop: 'maxCookies',        label: 'cookies',    default: 50 }
                        : /maximum number of parameters/.test(desc)
                          ? { prop: 'maxParams',         label: 'parameters', default: 500 }
                          : /maximum number of headers/.test(desc)
                            ? { prop: 'maxHeaders',        label: 'headers',    default: 20 }
                            : null
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">
                          <span>{h.description || h.name}</span>
                          {maxCountCfg && (
                            <span className="ml-2 text-gray-500 font-normal">
                              (maximum{' '}
                              <input
                                type="number"
                                min={1}
                                value={h[maxCountCfg.prop] ?? maxCountCfg.default}
                                onChange={ev => setBlockingItemField('http-protocols', i, maxCountCfg.prop, Number(ev.target.value))}
                                onClick={ev => ev.stopPropagation()}
                                className="mx-1 w-16 border border-gray-300 rounded px-1 py-0.5 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              {maxCountCfg.label})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center"><Toggle on={h.enabled ?? false} onClick={() => toggleBlockingItem('http-protocols', i, 'enabled')} /></td>
                        <td className="px-4 py-2 text-center">
                          {h.learn === undefined
                            ? <span className="text-gray-300">—</span>
                            : <Toggle on={h.learn} onClick={() => toggleBlockingItem('http-protocols', i, 'learn')} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}
        </Card>
      )}

      {/* ── WEBSOCKET ── */}
      {activeTab === 'websocket' && (
        <Card>
          <SectionHeader title="WebSocket URLs" sub={`${wsUrls.length} entries`}
            onClick={() => toggleSection('websocket')} collapsed={collapsed.websocket} />
          {!collapsed.websocket && (wsUrls.length === 0
            ? <div className="p-4 text-xs text-gray-400">No WebSocket URLs configured.</div>
            : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  {['Name', 'Protocol', 'Check payload', 'Attack sigs', 'Staging'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {wsUrls.map((u, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-medium text-gray-800">{u.name}</td>
                      <td className="px-3 py-2"><Badge color={u.protocol === 'wss' ? 'green' : 'blue'}>{u.protocol || 'ws'}</Badge></td>
                      <td className="px-3 py-2"><Toggle on={u.checkPayload ?? true}      onClick={() => toggleItem('websocket-urls', i, 'checkPayload', true)} /></td>
                      <td className="px-3 py-2"><Toggle on={u.attackSignatures ?? true}  onClick={() => toggleItem('websocket-urls', i, 'attackSignatures', true)} /></td>
                      <td className="px-3 py-2"><Toggle on={u.inStaging ?? false}        onClick={() => toggleItem('websocket-urls', i, 'inStaging')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </Card>
      )}

      {/* ── CSRF ── */}
      {activeTab === 'csrf' && (() => {
        const csrf = pol['csrf-protection'] || {}
        const csrfUrls = pol['csrf-urls'] || []
        const sslOnly = csrf.sslOnly ?? true
        const noLimit = csrf.expirationTimeInSeconds == null || csrf.expirationTimeInSeconds === 'disabled'
        function patchCsrf(patch) {
          setEditedPol(p => ({ ...p, 'csrf-protection': { ...(p['csrf-protection'] || {}), ...patch } }))
          setUnsaved(true)
        }
        function setCsrfUrls(arr) {
          setEditedPol(p => ({ ...p, 'csrf-urls': arr }))
          setUnsaved(true)
        }
        function openCsrfModal(idx) {
          const base = idx === -1
            ? { method: 'POST', url: '', requiredParameters: 'ignore', parameters: [], enforcementAction: 'verify-csrf-token' }
            : JSON.parse(JSON.stringify(csrfUrls[idx]))
          setCsrfModalDraft(base)
          setCsrfModalIdx(idx)
          setCsrfNewParam('')
        }
        function saveCsrfModal() {
          const arr = [...csrfUrls]
          if (csrfModalIdx === -1) arr.push(csrfModalDraft)
          else arr[csrfModalIdx] = csrfModalDraft
          setCsrfUrls(arr)
          setCsrfModalIdx(null); setCsrfModalDraft(null)
        }
        function deleteCsrfUrl(idx) { setCsrfUrls(csrfUrls.filter((_, i) => i !== idx)) }
        function patchModal(patch) { setCsrfModalDraft(d => ({ ...d, ...patch })) }
        const cd = csrfModalDraft || {}
        const actionLabel = { none: 'None', 'verify-origin': 'Verify Origin', 'verify-csrf-token': 'Verify CSRF Token' }
        function Btn3({ options, value, onChange }) {
          return (
            <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
              {options.map(o => (
                <button key={o.value} onClick={() => onChange(o.value)}
                  className={`px-3 py-1.5 ${value === o.value ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          )
        }
        return (
          <div>
          <Card>
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">CSRF Protection <span className="text-gray-400 font-normal">(Cross-Site Request Forgery)</span></h2>
            </div>
            <div className="divide-y divide-gray-50">
              {/* Protected URLs Type */}
              <div className="px-4 py-3 flex items-center gap-8">
                <span className="text-xs font-medium text-gray-700 w-56 flex-shrink-0">Protected URLs Type</span>
                <Btn3
                  options={[{ value: false, label: 'All URLs' }, { value: true, label: 'SSL Only' }]}
                  value={sslOnly}
                  onChange={v => patchCsrf({ sslOnly: v })}
                />
              </div>
              {/* CSRF Token Expiration Time */}
              <div className="px-4 py-3 flex items-center gap-4">
                <span className="text-xs font-medium text-gray-700 w-56 flex-shrink-0">CSRF Token Expiration Time</span>
                <div className="flex items-center gap-3">
                  <Btn3
                    options={[{ value: true, label: 'No Limit' }, { value: false, label: 'After' }]}
                    value={noLimit}
                    onChange={v => patchCsrf({ expirationTimeInSeconds: v ? 'disabled' : 600 })}
                  />
                  {!noLimit && (
                    <>
                      <input type="number" min={1} value={typeof csrf.expirationTimeInSeconds === 'number' ? csrf.expirationTimeInSeconds : 600}
                        onChange={e => patchCsrf({ expirationTimeInSeconds: Number(e.target.value) })}
                        className="text-xs border border-gray-200 rounded px-2 py-1.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <span className="text-xs text-gray-500">seconds</span>
                    </>
                  )}
                </div>
              </div>
              {/* URLs List */}
              <div className="px-4 py-3">
                <div className="text-xs font-medium text-gray-700 mb-2">URLs List <span className="font-normal text-gray-400">(Wildcards supported)</span></div>
                <div className="space-y-1 mb-3">
                  {csrfUrls.length === 0 && <div className="text-xs text-gray-400">No URLs configured.</div>}
                  {csrfUrls.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <span className="text-gray-300 text-xs">⠿</span>
                      <button onClick={() => openCsrfModal(i)}
                        className="text-xs text-blue-600 hover:underline flex-1 text-left">
                        {u.method} {u.url} <span className="text-gray-500">({actionLabel[u.enforcementAction] || u.enforcementAction})</span>
                      </button>
                      <button onClick={() => deleteCsrfUrl(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => openCsrfModal(-1)}
                  className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">+ Add URL</button>
              </div>
            </div>
          </Card>

          {/* ── CSRF URL Modal ── */}
          {csrfModalIdx !== null && csrfModalDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setCsrfModalIdx(null); setCsrfModalDraft(null) }}>
              <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">CSRF URL Properties</h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {/* Method and URL */}
                  <div className="flex items-center gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">
                      Method and URL <span className="text-red-500">*</span>
                    </label>
                    {csrfModalIdx === -1 ? (
                      <div className="flex items-center gap-2 flex-1">
                        <select value={cd.method || 'POST'} onChange={e => patchModal({ method: e.target.value })}
                          className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="Any">Any</option>
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                        <input value={cd.url || ''} onChange={e => patchModal({ url: e.target.value })}
                          placeholder="URL (Wildcard Supported)"
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                    ) : (
                      <span className="text-xs text-blue-600 font-medium">{cd.method} {cd.url}</span>
                    )}
                  </div>
                  {/* Required Parameters */}
                  <div className="flex items-start gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 pt-1">Required Parameters</label>
                    <div className="flex-1 space-y-2">
                      <Btn3
                        options={[{ value: 'ignore', label: 'Ignore' }, { value: 'at-least-one', label: 'At Least One' }, { value: 'specify', label: 'Specify' }]}
                        value={cd.requiredParameters || 'ignore'}
                        onChange={v => patchModal({ requiredParameters: v })}
                      />
                      {cd.requiredParameters === 'specify' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input value={csrfNewParam} onChange={e => setCsrfNewParam(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && csrfNewParam.trim()) { patchModal({ parameters: [...(cd.parameters || []), csrfNewParam.trim()] }); setCsrfNewParam('') } }}
                              placeholder="Parameter name"
                              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <button onClick={() => { if (csrfNewParam.trim()) { patchModal({ parameters: [...(cd.parameters || []), csrfNewParam.trim()] }); setCsrfNewParam('') } }}
                              className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Add</button>
                          </div>
                          {(cd.parameters || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {(cd.parameters || []).map((p, pi) => (
                                <span key={pi} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {p}
                                  <button onClick={() => patchModal({ parameters: (cd.parameters || []).filter((_, j) => j !== pi) })} className="hover:text-red-500">×</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Enforcement Action */}
                  <div className="flex items-start gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 pt-1">Enforcement Action</label>
                    <div className="flex-1 space-y-2">
                      <Btn3
                        options={[{ value: 'none', label: 'None' }, { value: 'verify-origin', label: 'Verify Origin' }, { value: 'verify-csrf-token', label: 'Verify CSRF Token' }]}
                        value={cd.enforcementAction || 'verify-csrf-token'}
                        onChange={v => patchModal({ enforcementAction: v })}
                      />
                      {cd.enforcementAction === 'verify-origin' && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                          <span className="text-amber-500 mt-0.5">⚠</span>
                          <span>Note: Verify Origin action requires configuration of Host Name</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button onClick={() => { setCsrfModalIdx(null); setCsrfModalDraft(null) }}
                    className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveCsrfModal} disabled={!cd.url?.trim()}
                    className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {csrfModalIdx === -1 ? 'Add' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )
      })()}

      {/* ── REDIRECTION PROTECTION ── */}
      {/* ── SESSIONS & LOGINS ── */}
      {activeTab === 'sessions' && (() => {
        const loginPages = pol['login-pages'] || []
        const loginEnf = pol['login-enforcement'] || {}
        const logoutUrls = loginEnf.logoutUrls || []
        const authUrls = loginEnf.authenticatedUrls || []
        const expPeriod = loginEnf.expirationTimePeriod
        const noLimit = expPeriod === 'disabled' || expPeriod == null

        function patchEnf(patch) {
          setEditedPol(p => ({ ...p, 'login-enforcement': { ...(p['login-enforcement'] || {}), ...patch } }))
          setUnsaved(true)
        }

        const AUTH_TYPES = [
          { value: 'none',               label: 'None' },
          { value: 'form',               label: 'HTML Form' },
          { value: 'http-basic',         label: 'HTTP Basic Authentication' },
          { value: 'http-digest',        label: 'HTTP Digest Authentication' },
          { value: 'ntlm',               label: 'NTLM' },
          { value: 'ajax-or-json-request', label: 'JSON / AJAX Request' },
          { value: 'request-body',       label: 'Request Body' },
        ]
        const COND_TYPES = [
          { value: 'responseContains',        label: 'Expected String in Response',       placeholder: 'For example "Logout"' },
          { value: 'responseOmits',           label: 'Unexpected String in Response',     placeholder: 'For example "Unsuccessful"' },
          { value: 'headerContains',          label: 'Expected Header Name and Value',    placeholder: 'For example "Location" or "Location: /main.aspx"' },
          { value: 'headerOmits',             label: 'Unexpected Header Name and Value',  placeholder: 'For example "Location: /PasswordRestoring.aspx"' },
          { value: 'cookieContains',          label: 'Expected Domain Cookie Name',       placeholder: 'Cookie added in the Set-Cookie response header' },
          { value: 'parameterContains',       label: 'Expected Parameter Name',           placeholder: 'Parameter added to URI links in the response' },
          { value: 'responseHttpStatus',      label: 'Expected Response Status Code',     placeholder: 'For example, 306 or 2xx' },
          { value: 'responseHttpStatusOmits', label: 'Unexpected Response Status Codes',  placeholder: 'For example, 400 or 5xx' },
        ]
        const HEADER_COND = ['headerContains', 'headerOmits']

        function accessValidationToConditions(av = {}) {
          const conds = []
          const matchMap = { headerContains: av.headerContainsMatchCondition || 'exact', headerOmits: av.headerOmitsMatchCondition || 'exact' }
          for (const t of COND_TYPES) {
            const val = av[t.value]
            if (t.value === 'responseHttpStatusOmits') {
              if (Array.isArray(val) && val.length > 0) val.forEach(v => conds.push({ type: t.value, value: v }))
            } else if (val) {
              conds.push({ type: t.value, value: val, match: matchMap[t.value] })
            }
          }
          return conds
        }
        function conditionsToAccessValidation(conds = []) {
          const av = {}
          for (const c of conds) {
            if (c.type === 'responseHttpStatusOmits') {
              av.responseHttpStatusOmits = [...(av.responseHttpStatusOmits || []), c.value]
            } else {
              av[c.type] = c.value
              if (c.type === 'headerContains') av.headerContainsMatchCondition = c.match || 'exact'
              if (c.type === 'headerOmits') av.headerOmitsMatchCondition = c.match || 'exact'
            }
          }
          return av
        }

        function openLoginModal(idx) {
          const base = idx === -1
            ? { url: { type: 'explicit', protocol: 'http', method: '*', name: '' }, authenticationType: 'none', conditions: [] }
            : { ...JSON.parse(JSON.stringify(loginPages[idx])), conditions: accessValidationToConditions(loginPages[idx].accessValidation) }
          setLoginModalDraft(base)
          setLoginModalIdx(idx)
          setLoginUrlSearch(base.url?.name || '')
          setLoginUrlOpen(false)
          setNewCondType('responseContains'); setNewCondValue(''); setNewCondMatch('exact')
        }
        function saveLoginModal() {
          const { conditions, accessValidation: _av, ...rest } = loginModalDraft
          const entry = { ...rest, accessValidation: conditionsToAccessValidation(conditions || []) }
          const arr = [...loginPages]
          if (loginModalIdx === -1) arr.push(entry)
          else arr[loginModalIdx] = entry
          setEditedPol(p => ({ ...p, 'login-pages': arr }))
          setUnsaved(true)
          setLoginModalIdx(null); setLoginModalDraft(null)
        }
        function deleteLoginPage(idx) {
          setEditedPol(p => ({ ...p, 'login-pages': loginPages.filter((_, i) => i !== idx) }))
          setUnsaved(true)
        }
        function patchLogin(patch) { setLoginModalDraft(d => ({ ...d, ...patch })) }
        function patchLoginUrl(patch) { setLoginModalDraft(d => ({ ...d, url: { ...d.url, ...patch } })) }
        const ld = loginModalDraft || {}

        function openLogoutModal(idx) {
          const base = idx === -1
            ? { url: { type: 'explicit', protocol: 'http', method: '*', name: '' }, requestContains: '', requestOmits: '' }
            : JSON.parse(JSON.stringify(logoutUrls[idx]))
          setLogoutModalDraft(base)
          setLogoutModalIdx(idx)
          setLogoutUrlSearch(base.url?.name || '')
          setLogoutUrlOpen(false)
        }
        function saveLogoutModal() {
          const arr = [...logoutUrls]
          if (logoutModalIdx === -1) arr.push(logoutModalDraft)
          else arr[logoutModalIdx] = logoutModalDraft
          patchEnf({ logoutUrls: arr })
          setLogoutModalIdx(null); setLogoutModalDraft(null)
        }
        function deleteLogoutUrl(idx) { patchEnf({ logoutUrls: logoutUrls.filter((_, i) => i !== idx) }) }
        function patchLogout(patch) { setLogoutModalDraft(d => ({ ...d, ...patch })) }
        function patchLogoutUrl(patch) { setLogoutModalDraft(d => ({ ...d, url: { ...d.url, ...patch } })) }
        const od = logoutModalDraft || {}

        function urlLabel(u) {
          if (!u) return '—'
          const proto = (u.protocol || 'http').toUpperCase()
          const method = u.method && u.method !== '*' ? ` ${u.method}` : ''
          return `[${proto}]${method} ${u.name || ''}`
        }

        function addAuthUrl() {
          const v = newAuthUrl.trim(); if (!v) return
          patchEnf({ authenticatedUrls: [...authUrls, v] })
          setNewAuthUrl('')
        }
        function removeAuthUrl(i) { patchEnf({ authenticatedUrls: authUrls.filter((_, j) => j !== i) }) }

        function addCondition() {
          const v = newCondValue.trim(); if (!v) return
          patchLogin({ conditions: [...(ld.conditions || []), { type: newCondType, value: v, match: newCondMatch }] })
          setNewCondValue('')
        }

        const METHODS = ['*', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

        return (
          <div className="space-y-4">
            {/* ── Login & Logout Pages card ── */}
            <Card>
              <div className="divide-y divide-gray-50">
                {/* Login Pages */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Login Pages</span>
                    <button onClick={() => openLoginModal(-1)} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">+ Add Page</button>
                  </div>
                  {loginPages.length > 0 && (
                    <table className="w-full text-xs mt-2">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">URL</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Authentication Type</th>
                        <th className="px-3 py-1.5 w-16"></th>
                      </tr></thead>
                      <tbody>
                        {loginPages.map((lp, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <button onClick={() => openLoginModal(i)} className="text-blue-600 hover:underline font-mono">{urlLabel(lp.url)}</button>
                            </td>
                            <td className="px-3 py-2 text-gray-600 capitalize">{AUTH_TYPES.find(a => a.value === lp.authenticationType)?.label || lp.authenticationType || 'None'}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => deleteLoginPage(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {/* Logout Pages */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Logout Pages</span>
                    <button onClick={() => openLogoutModal(-1)} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">+ Add Page</button>
                  </div>
                  {logoutUrls.length > 0 && (
                    <table className="w-full text-xs mt-2">
                      <thead><tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">URL</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Expected String</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-500">Unexpected String</th>
                        <th className="px-3 py-1.5 w-16"></th>
                      </tr></thead>
                      <tbody>
                        {logoutUrls.map((lu, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <button onClick={() => openLogoutModal(i)} className="text-blue-600 hover:underline font-mono">{urlLabel(lu.url)}</button>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{lu.requestContains || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{lu.requestOmits || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => deleteLogoutUrl(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </Card>

            {/* ── Login Enforcement card ── */}
            <Card>
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Login Enforcement</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {/* Session Expiration */}
                <div className="px-4 py-3 flex items-start gap-8">
                  <span className="text-xs font-medium text-gray-700 w-52 flex-shrink-0 pt-1">Session Expiration Time</span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
                        <button onClick={() => patchEnf({ expirationTimePeriod: 'disabled' })}
                          className={`px-3 py-1.5 ${noLimit ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>No Limit</button>
                        <button onClick={() => patchEnf({ expirationTimePeriod: 600 })}
                          className={`px-3 py-1.5 ${!noLimit ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>After</button>
                      </div>
                      {!noLimit && (
                        <>
                          <input type="number" min={1} value={typeof expPeriod === 'number' ? expPeriod : 600}
                            onChange={e => patchEnf({ expirationTimePeriod: Number(e.target.value) })}
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          <span className="text-xs text-gray-500">seconds</span>
                        </>
                      )}
                    </div>
                    {!noLimit && (
                      <div className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                        <span>Although the feature is enabled, violations will not be alerted or learned. To change this, modify flags for the <span className="font-medium">"Login URL expired"</span> violation in <button onClick={() => setActiveTab('violations')} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Learning and Blocking Settings <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button></span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Authenticated URLs */}
                <div className="px-4 py-3 flex items-start gap-8">
                  <span className="text-xs font-medium text-gray-700 w-52 flex-shrink-0 pt-1">Authenticated URLs <span className="font-normal text-gray-400">(Wildcards supported)</span></span>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={newAuthUrl} onChange={e => setNewAuthUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addAuthUrl()}
                        placeholder="/secure/*"
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <button onClick={addAuthUrl} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Add</button>
                    </div>
                    {authUrls.length > 0 && (
                      <div className="space-y-1">
                        {authUrls.map((u, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-1.5">
                            <span className="font-mono text-gray-800">{u}</span>
                            <button onClick={() => removeAuthUrl(i)} className="text-gray-400 hover:text-red-500 ml-3">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {authUrls.length > 0 && loginPages.length === 0 && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                        <span>Although the feature is enabled, violations will not be alerted or learned. To change this, modify flags for the <span className="font-medium">"Login URL bypassed"</span> violation in <button onClick={() => setActiveTab('violations')} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Learning and Blocking Settings <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button></span>
                      </div>
                    )}
                    {authUrls.length > 0 && loginPages.length === 0 && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                        <span>Login Pages List is empty. You need to create a Login Page for this feature to work correctly.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Login Page Modal ── */}
            {loginModalIdx !== null && loginModalDraft && (() => {
              const noUrlsDefined = urls.length === 0
              const isFormAuth = ld.authenticationType === 'form'
              const isAjaxAuth = ld.authenticationType === 'ajax-or-json-request'
              const isBodyAuth = ld.authenticationType === 'request-body'
              const canSave = ld.url?.name?.trim() && ld.authenticationType && ld.authenticationType !== 'none' && (ld.conditions || []).length > 0
              const condPlaceholder = COND_TYPES.find(t => t.value === newCondType)?.placeholder || 'Value'
              return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setLoginModalIdx(null); setLoginModalDraft(null) }}>
                <div className="bg-white rounded-xl shadow-2xl w-[775px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Login Page Properties</h2>
                  </div>
                  <div className="px-6 py-4 space-y-4">
                    {/* Login URL — select from existing URLs */}
                    <div className="flex items-start gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 pt-1">Login URL <span className="text-red-500">*</span></label>
                      <div className="flex-1 space-y-2">
                        {noUrlsDefined && (
                          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            <span className="text-amber-500 mt-0.5">⚠</span>
                            <span>No URLs defined. <button onClick={() => { setLoginModalIdx(null); setLoginModalDraft(null); setActiveTab('urls') }} className="text-blue-600 hover:underline">Add a URL first</button> before configuring a login page.</span>
                          </div>
                        )}
                        <div className="relative">
                          <input
                            value={loginUrlSearch}
                            onChange={e => { setLoginUrlSearch(e.target.value); setLoginUrlOpen(true) }}
                            onFocus={() => setLoginUrlOpen(true)}
                            onBlur={() => setTimeout(() => setLoginUrlOpen(false), 150)}
                            placeholder="Type to search URLs…"
                            disabled={noUrlsDefined}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                          {loginUrlOpen && (() => {
                            const q = loginUrlSearch.toLowerCase()
                            const filtered = urls.filter(u => !q || u.name.toLowerCase().includes(q))
                            return filtered.length > 0 ? (
                              <div className="absolute left-0 right-0 top-full mt-0.5 z-10 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map((u, i) => (
                                  <button key={i} type="button"
                                    onMouseDown={() => {
                                      patchLogin({ url: { type: u.type || 'explicit', protocol: u.protocol || 'http', method: u.method || '*', name: u.name } })
                                      setLoginUrlSearch(u.name)
                                      setLoginUrlOpen(false)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2">
                                    <span className="text-gray-400 flex-shrink-0 font-mono">[{(u.protocol || 'http').toUpperCase()}]{u.method && u.method !== '*' ? ` ${u.method}` : ''}</span>
                                    <span className="text-gray-800 font-mono">{u.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Authentication Type */}
                    <div className="flex items-center gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Authentication Type</label>
                      <select value={ld.authenticationType || 'none'} onChange={e => patchLogin({ authenticationType: e.target.value })}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                        {AUTH_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                    {/* Form auth: Username / Password */}
                    {isFormAuth && (
                      <>
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 text-right">Username</label>
                          <input value={ld.usernameParameterName || ''} onChange={e => patchLogin({ usernameParameterName: e.target.value })}
                            placeholder="Type the parameter name"
                            className="w-[60%] text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 text-right">Password</label>
                          <input value={ld.passwordParameterName || ''} onChange={e => patchLogin({ passwordParameterName: e.target.value })}
                            placeholder="Type the parameter name"
                            className="w-[60%] text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </>
                    )}
                    {/* JSON/AJAX auth: Username / Password JSON elements */}
                    {isAjaxAuth && (
                      <>
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 text-right">Username</label>
                          <input value={ld.usernameParameterName || ''} onChange={e => patchLogin({ usernameParameterName: e.target.value })}
                            placeholder="Add JSON element"
                            className="w-[60%] text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 text-right">Password</label>
                          <input value={ld.passwordParameterName || ''} onChange={e => patchLogin({ passwordParameterName: e.target.value })}
                            placeholder="Add JSON element"
                            className="w-[60%] text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </>
                    )}
                    {/* Request Body auth: PCRE regex */}
                    {isBodyAuth && (
                      <>
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 text-right">Username</label>
                          <input value={ld.usernameRegex || ''} onChange={e => patchLogin({ usernameRegex: e.target.value })}
                            placeholder="PCRE regular expression"
                            className="w-[60%] text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono" />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 text-right">Password</label>
                          <input value={ld.passwordRegex || ''} onChange={e => patchLogin({ passwordRegex: e.target.value })}
                            placeholder="PCRE regular expression"
                            className="w-[60%] text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono" />
                        </div>
                      </>
                    )}
                    {/* Successful Login Conditions */}
                    <div className="flex items-start gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0 pt-1">Successful Login Conditions <span className="text-red-500">*</span></label>
                      <div className="flex-1 space-y-2">
                        {(ld.conditions || []).map((c, ci) => (
                          <div key={ci} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                            <span className="text-xs text-gray-500 w-48 flex-shrink-0">{COND_TYPES.find(t => t.value === c.type)?.label || c.type}</span>
                            <span className="text-xs text-gray-800 flex-1 font-mono">{c.value}</span>
                            {HEADER_COND.includes(c.type) && <span className="text-xs text-gray-400 flex-shrink-0">{c.match}</span>}
                            <button onClick={() => patchLogin({ conditions: (ld.conditions || []).filter((_, j) => j !== ci) })} className="text-gray-300 hover:text-red-500 ml-1">×</button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <select value={newCondType} onChange={e => { setNewCondType(e.target.value); setNewCondValue('') }}
                            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-56 flex-shrink-0">
                            {COND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <input value={newCondValue} onChange={e => setNewCondValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCondition()}
                            placeholder={condPlaceholder}
                            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          {HEADER_COND.includes(newCondType) && (
                            <select value={newCondMatch} onChange={e => setNewCondMatch(e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 flex-shrink-0">
                              <option value="exact">Exact</option>
                              <option value="regex">Regex</option>
                            </select>
                          )}
                        </div>
                        <button onClick={addCondition} disabled={!newCondValue.trim()}
                          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">+ Add Condition</button>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => { setLoginModalIdx(null); setLoginModalDraft(null) }}
                      className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={saveLoginModal} disabled={!canSave}
                      className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      {loginModalIdx === -1 ? 'Add' : 'Update'}
                    </button>
                  </div>
                </div>
              </div>
              )
            })()}

            {/* ── Logout Page Modal ── */}
            {logoutModalIdx !== null && logoutModalDraft && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setLogoutModalIdx(null); setLogoutModalDraft(null) }}>
                <div className="bg-white rounded-xl shadow-2xl w-[560px]" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Logout Page Properties</h2>
                  </div>
                  <div className="px-6 py-4 space-y-4">
                    {/* Logout URL */}
                    <div className="flex items-start gap-4">
                      <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0 pt-1">Logout URL (Explicit Only) <span className="text-red-500">*</span></label>
                      <div className="flex-1 space-y-2">
                        {urls.length === 0 && (
                          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            <span className="text-amber-500 mt-0.5">⚠</span>
                            <span>No URLs defined. <button onClick={() => { setLogoutModalIdx(null); setLogoutModalDraft(null); setActiveTab('urls') }} className="text-blue-600 hover:underline">Add a URL first</button> before configuring a logout page.</span>
                          </div>
                        )}
                        <div className="relative">
                          <input
                            value={logoutUrlSearch}
                            onChange={e => { setLogoutUrlSearch(e.target.value); setLogoutUrlOpen(true) }}
                            onFocus={() => setLogoutUrlOpen(true)}
                            onBlur={() => setTimeout(() => setLogoutUrlOpen(false), 150)}
                            placeholder="Type to search URLs…"
                            disabled={urls.length === 0}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                          {logoutUrlOpen && (() => {
                            const q = logoutUrlSearch.toLowerCase()
                            const filtered = urls.filter(u => !q || u.name.toLowerCase().includes(q))
                            return filtered.length > 0 ? (
                              <div className="absolute left-0 right-0 top-full mt-0.5 z-10 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                                {filtered.map((u, i) => (
                                  <button key={i} type="button"
                                    onMouseDown={() => {
                                      patchLogout({ url: { type: u.type || 'explicit', protocol: u.protocol || 'http', method: u.method || '*', name: u.name } })
                                      setLogoutUrlSearch(u.name)
                                      setLogoutUrlOpen(false)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2">
                                    <span className="text-gray-400 flex-shrink-0 font-mono">[{(u.protocol || 'http').toUpperCase()}]{u.method && u.method !== '*' ? ` ${u.method}` : ''}</span>
                                    <span className="text-gray-800 font-mono">{u.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Expected String */}
                    <div className="flex items-center gap-4">
                      <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Expected String in Request</label>
                      <input value={od.requestContains || ''} onChange={e => patchLogout({ requestContains: e.target.value })}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    {/* Unexpected String */}
                    <div className="flex items-center gap-4">
                      <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Unexpected String in Request</label>
                      <input value={od.requestOmits || ''} onChange={e => patchLogout({ requestOmits: e.target.value })}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => { setLogoutModalIdx(null); setLogoutModalDraft(null) }}
                      className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={saveLogoutModal} disabled={!od.url?.name?.trim()}
                      className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      {logoutModalIdx === -1 ? 'Add' : 'Update'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── BEHAVIORAL ── */}
      {activeTab === 'behavioral' && (
        <Card>
          <SectionHeader title="Behavioral enforcement"
            onClick={() => toggleSection('behavioral')} collapsed={collapsed.behavioral} />
          {!collapsed.behavioral && <div className="px-4 py-3 space-y-0">
            {[
              ['Enable behavioral enforcement',     'enableBehavioralEnforcement',         'ML-based anomaly detection'],
              ['Block CVE signatures',              'enableBlockingCveSignatures',          'Block requests matching known CVE attack signatures'],
              ['Block high-accuracy signatures',    'enableBlockingHighAccuracySignatures', 'Block high-confidence attack signatures'],
            ].map(([label, key, sub]) => (
              <ToggleRow key={key} label={label} sub={sub}
                on={pol['behavioral-enforcement']?.[key] ?? false}
                onClick={() => toggleNested('behavioral-enforcement', key)} />
            ))}
          </div>}
        </Card>
      )}

      {/* ── BRUTE FORCE (merged into sessions tab) ── */}
      {activeTab === 'sessions' && (() => {
        const bfList = pol['brute-force-attack-preventions'] || []
        const loginPagesList = pol['login-pages'] || []

        const BF_DEFAULT = {
          bruteForceProtectionForAllLoginPages: true,
          leakedCredentialsCriteria: { enabled: false, action: 'alarm-and-blocking-page' },
          sourceBasedProtectionDetectionPeriod: 3600,
          preventionDuration: '3600',
          loginAttemptsFromTheSameUser: { enabled: false, threshold: 3, action: 'alarm-and-captcha' },
          loginAttemptsFromTheSameDeviceId: { enabled: false, threshold: 3, action: 'alarm-and-captcha' },
          loginAttemptsFromTheSameIp: { enabled: true, threshold: 20, action: 'alarm-and-captcha' },
          clientSideIntegrityBypassCriteria: { enabled: false, threshold: 3, action: 'alarm-and-captcha' },
          captchaBypassCriteria: { enabled: false, threshold: 5, action: 'alarm-and-drop' },
          measurementPeriod: 900,
          reEnableLoginAfter: 3600,
          detectionCriteria: { detectDistributedBruteForceAttack: true, failedLoginAttemptsRateReached: 100, detectCredentialsStuffingAttack: true, credentialsStuffingMatchesReached: 100, action: 'alarm-and-captcha' },
        }

        function openBfModal(idx) {
          const base = idx === -1 ? JSON.parse(JSON.stringify(BF_DEFAULT)) : JSON.parse(JSON.stringify(bfList[idx]))
          setBfModalDraft(base)
          setBfModalIdx(idx)
        }
        function saveBfModal() {
          const arr = [...bfList]
          if (bfModalIdx === -1) arr.push(bfModalDraft)
          else arr[bfModalIdx] = bfModalDraft
          setEditedPol(p => ({ ...p, 'brute-force-attack-preventions': arr }))
          setUnsaved(true)
          setBfModalIdx(null); setBfModalDraft(null)
        }
        function deleteBf(idx) {
          setEditedPol(p => ({ ...p, 'brute-force-attack-preventions': bfList.filter((_, i) => i !== idx) }))
          setUnsaved(true)
        }
        function patchBf(patch) { setBfModalDraft(d => ({ ...d, ...patch })) }
        function patchBfCrit(key, patch) { setBfModalDraft(d => ({ ...d, [key]: { ...d[key], ...patch } })) }
        const bd = bfModalDraft || {}

        // seconds ↔ minutes helpers
        function toMin(s) { return Math.round((Number(s) || 0) / 60) }
        function fromMin(m) { return (Number(m) || 0) * 60 }

        const ACTION_LABELS = {
          'alarm': 'Alarm',
          'alarm-and-blocking-page': 'Alarm and Blocking Page',
          'alarm-and-captcha': 'Alarm and CAPTCHA',
          'alarm-and-client-side-integrity': 'Alarm and Client Side Integrity',
          'alarm-and-drop': 'Alarm and Drop',
          'alarm-and-honeypot-page': 'Alarm and Honeypot Page',
          'alarm-and-leaked-credentials-response-page': 'Alarm and Leaked Credentials Page',
          'alarm-and-client-side-integrity-captcha': 'Alarm and Client Side Integrity Followed by CAPTCHA',
        }
        function ActionSelect({ value, onChange, options }) {
          return (
            <select value={value || ''} onChange={e => onChange(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-56">
              {options.map(o => <option key={o} value={o}>{ACTION_LABELS[o]}</option>)}
            </select>
          )
        }
        function TriggerRow({ label, unit = 'failed attempts', value, threshold, onToggle, onThreshold, showCount = true }) {
          return (
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
                <button onClick={() => onToggle(false)} className={`px-3 py-1.5 ${!value ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Never Trigger</button>
                <button onClick={() => onToggle(true)}  className={`px-3 py-1.5 ${value  ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Trigger After</button>
              </div>
              {value && showCount && (
                <>
                  <input type="number" min={1} value={threshold || ''} onChange={e => onThreshold(Number(e.target.value))}
                    className="w-14 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                  <span className="text-xs text-gray-500">{unit}</span>
                </>
              )}
            </div>
          )
        }

        function Check({ v }) { return v ? <span className="text-blue-500 text-sm">✓</span> : <span className="text-gray-300 text-sm">✕</span> }
        function pageLabel(bf) {
          if (bf.bruteForceProtectionForAllLoginPages || !bf.url?.name) return 'Default'
          return bf.url.name
        }

        return (
          <div className="space-y-4">
            <div className="pt-2">
              <h2 className="text-sm font-semibold text-gray-700 px-1 pb-2 border-b border-gray-200">Brute Force Protection</h2>
            </div>
            <Card>
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700">{bfList.length} Entry{bfList.length !== 1 ? 'ies' : ''}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openBfModal(-1)} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Create</button>
                </div>
              </div>
              {bfList.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Login Page</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center">Leaked<br/>Credentials</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center">Username</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center">Device ID</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center">IP Address</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center">Client Side<br/>Bypass</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-center">CAPTCHA<br/>Bypass</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr></thead>
                  <tbody>
                    {bfList.map((bf, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <button onClick={() => openBfModal(i)} className="text-blue-600 hover:underline">{pageLabel(bf)}</button>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-600">{bf.leakedCredentialsCriteria?.enabled ? 'Enabled' : 'Disabled'}</td>
                        <td className="px-4 py-2 text-center"><Check v={bf.loginAttemptsFromTheSameUser?.enabled} /></td>
                        <td className="px-4 py-2 text-center"><Check v={bf.loginAttemptsFromTheSameDeviceId?.enabled} /></td>
                        <td className="px-4 py-2 text-center"><Check v={bf.loginAttemptsFromTheSameIp?.enabled} /></td>
                        <td className="px-4 py-2 text-center"><Check v={bf.clientSideIntegrityBypassCriteria?.enabled} /></td>
                        <td className="px-4 py-2 text-center"><Check v={bf.captchaBypassCriteria?.enabled} /></td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => deleteBf(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-4 py-6 text-xs text-gray-400 text-center">No brute force prevention configured. Click Create to add one.</div>
              )}
            </Card>

            {/* ── BF Modal ── */}
            {bfModalIdx !== null && bfModalDraft && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setBfModalIdx(null); setBfModalDraft(null) }}>
                <div className="bg-white rounded-xl shadow-2xl w-[694px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Brute Force Protection Configuration</h2>
                  </div>
                  <div className="px-6 py-4 space-y-5">
                    {/* Transparent mode notice */}
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                      <span>Note: The security policy's enforcement mode is Transparent. Requests will not be blocked unless the enforcement mode is changed to Blocking in <button onClick={() => { setBfModalIdx(null); setBfModalDraft(null); setActiveTab('general') }} className="text-blue-600 hover:underline">General Settings</button></span>
                    </div>

                    {/* Login Page */}
                    <div className="flex items-center gap-4">
                      <label className="w-40 text-xs font-medium text-gray-700 flex-shrink-0">Login Page <span className="text-red-500">*</span></label>
                      <div className="flex-1 space-y-1">
                        <select value={bd.url?.name || ''} onChange={e => {
                          if (!e.target.value) { patchBf({ bruteForceProtectionForAllLoginPages: true, url: undefined }) }
                          else {
                            const lp = loginPagesList.find(p => p.url?.name === e.target.value)
                            patchBf({ bruteForceProtectionForAllLoginPages: false, url: lp?.url || { name: e.target.value } })
                          }
                        }} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">Select login page…</option>
                          {loginPagesList.map((lp, i) => (
                            <option key={i} value={lp.url?.name}>[{(lp.url?.protocol || 'http').toUpperCase()}] {lp.url?.name}</option>
                          ))}
                        </select>
                        <button onClick={() => { setBfModalIdx(null); setBfModalDraft(null); setActiveTab('sessions') }}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1">+ Create New Login Page in "Sessions and Logins"</button>
                      </div>
                    </div>

                    {/* ── Leaked Credentials Detection ── */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Leaked Credentials Detection</h3>
                      <div className="divide-y divide-gray-50 border border-gray-100 rounded">
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-40 text-xs font-medium text-gray-700 flex-shrink-0">Detection</label>
                          <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
                            <button onClick={() => patchBfCrit('leakedCredentialsCriteria', { enabled: true })}
                              className={`px-3 py-1.5 ${bd.leakedCredentialsCriteria?.enabled ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Enabled</button>
                            <button onClick={() => patchBfCrit('leakedCredentialsCriteria', { enabled: false })}
                              className={`px-3 py-1.5 ${!bd.leakedCredentialsCriteria?.enabled ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Disabled</button>
                          </div>
                        </div>
                        {bd.leakedCredentialsCriteria?.enabled && (
                          <div className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-4">
                              <label className="w-40 text-xs text-gray-600 flex-shrink-0">Mitigation Action</label>
                              <ActionSelect value={bd.leakedCredentialsCriteria?.action} onChange={v => patchBfCrit('leakedCredentialsCriteria', { action: v })}
                                options={['alarm', 'alarm-and-blocking-page', 'alarm-and-honeypot-page', 'alarm-and-leaked-credentials-response-page']} />
                            </div>
                            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                              <span>Note: Leaked Credentials Detection is not operational because Blackfish API Cloud service is not available.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Source-based Brute Force Protection ── */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Source-based Brute Force Protection</h3>
                      <div className="divide-y divide-gray-100 border border-gray-100 rounded">
                        {/* Detection Period */}
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Detection Period</label>
                          <input type="number" min={1} value={toMin(bd.sourceBasedProtectionDetectionPeriod)}
                            onChange={e => patchBf({ sourceBasedProtectionDetectionPeriod: fromMin(e.target.value) })}
                            className="w-20 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                          <span className="text-xs text-gray-500">minutes</span>
                        </div>
                        {/* Max Prevention Duration */}
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Maximum Prevention Duration</label>
                          <input type="number" min={1} value={toMin(bd.preventionDuration)}
                            onChange={e => patchBf({ preventionDuration: String(fromMin(e.target.value)) })}
                            className="w-20 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                          <span className="text-xs text-gray-500">minutes</span>
                        </div>
                        {/* Username */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Username</label>
                            <TriggerRow value={bd.loginAttemptsFromTheSameUser?.enabled}
                              threshold={bd.loginAttemptsFromTheSameUser?.threshold}
                              onToggle={v => patchBfCrit('loginAttemptsFromTheSameUser', { enabled: v })}
                              onThreshold={v => patchBfCrit('loginAttemptsFromTheSameUser', { threshold: v })} />
                          </div>
                          {bd.loginAttemptsFromTheSameUser?.enabled && (
                            <div className="flex items-center gap-4 pl-52">
                              <label className="text-xs text-gray-600 w-32 flex-shrink-0">Mitigation Action</label>
                              <ActionSelect value={bd.loginAttemptsFromTheSameUser?.action}
                                onChange={v => patchBfCrit('loginAttemptsFromTheSameUser', { action: v })}
                                options={['alarm', 'alarm-and-captcha', 'alarm-and-client-side-integrity']} />
                            </div>
                          )}
                        </div>
                        {/* Device ID */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Device ID</label>
                            <TriggerRow value={bd.loginAttemptsFromTheSameDeviceId?.enabled}
                              threshold={bd.loginAttemptsFromTheSameDeviceId?.threshold}
                              onToggle={v => patchBfCrit('loginAttemptsFromTheSameDeviceId', { enabled: v })}
                              onThreshold={v => patchBfCrit('loginAttemptsFromTheSameDeviceId', { threshold: v })} />
                          </div>
                          {bd.loginAttemptsFromTheSameDeviceId?.enabled && (
                            <div className="flex items-center gap-4 pl-52">
                              <label className="text-xs text-gray-600 w-32 flex-shrink-0">Mitigation Action</label>
                              <ActionSelect value={bd.loginAttemptsFromTheSameDeviceId?.action}
                                onChange={v => patchBfCrit('loginAttemptsFromTheSameDeviceId', { action: v })}
                                options={['alarm', 'alarm-and-blocking-page', 'alarm-and-captcha', 'alarm-and-client-side-integrity', 'alarm-and-drop', 'alarm-and-honeypot-page']} />
                            </div>
                          )}
                          {bd.loginAttemptsFromTheSameDeviceId?.enabled && (
                            <div className="space-y-1 pl-52">
                              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                                <span>Although the policy is in transparent mode, using device id will block requests from clients that do not support JavaScript</span>
                              </div>
                              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                                <span>Note: Device-ID mode must be configured in bot profile for this option to work.</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* IP Address */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">IP Address</label>
                            <TriggerRow value={bd.loginAttemptsFromTheSameIp?.enabled}
                              threshold={bd.loginAttemptsFromTheSameIp?.threshold}
                              onToggle={v => patchBfCrit('loginAttemptsFromTheSameIp', { enabled: v })}
                              onThreshold={v => patchBfCrit('loginAttemptsFromTheSameIp', { threshold: v })} />
                          </div>
                          {bd.loginAttemptsFromTheSameIp?.enabled && (
                            <div className="flex items-center gap-4 pl-52">
                              <label className="text-xs text-gray-600 w-32 flex-shrink-0">Mitigation Action</label>
                              <ActionSelect value={bd.loginAttemptsFromTheSameIp?.action}
                                onChange={v => patchBfCrit('loginAttemptsFromTheSameIp', { action: v })}
                                options={['alarm', 'alarm-and-blocking-page', 'alarm-and-captcha', 'alarm-and-client-side-integrity', 'alarm-and-drop', 'alarm-and-honeypot-page']} />
                            </div>
                          )}
                        </div>
                        {/* Client Side Integrity Bypass */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0 leading-tight">Client Side Integrity Bypass Mitigation</label>
                            <TriggerRow value={bd.clientSideIntegrityBypassCriteria?.enabled}
                              threshold={bd.clientSideIntegrityBypassCriteria?.threshold}
                              unit="successful challenges"
                              onToggle={v => patchBfCrit('clientSideIntegrityBypassCriteria', { enabled: v })}
                              onThreshold={v => patchBfCrit('clientSideIntegrityBypassCriteria', { threshold: v })} />
                          </div>
                          {bd.clientSideIntegrityBypassCriteria?.enabled && (
                            <div className="flex items-center gap-4 pl-52">
                              <label className="text-xs text-gray-600 w-32 flex-shrink-0">Mitigation Action</label>
                              <ActionSelect value={bd.clientSideIntegrityBypassCriteria?.action}
                                onChange={v => patchBfCrit('clientSideIntegrityBypassCriteria', { action: v })}
                                options={['alarm-and-captcha']} />
                            </div>
                          )}
                        </div>
                        {/* CAPTCHA Bypass */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">CAPTCHA Bypass Mitigation</label>
                            <TriggerRow value={bd.captchaBypassCriteria?.enabled}
                              threshold={bd.captchaBypassCriteria?.threshold}
                              unit="successful challenges"
                              onToggle={v => patchBfCrit('captchaBypassCriteria', { enabled: v })}
                              onThreshold={v => patchBfCrit('captchaBypassCriteria', { threshold: v })} />
                          </div>
                          {bd.captchaBypassCriteria?.enabled && (
                            <div className="flex items-center gap-4 pl-52">
                              <label className="text-xs text-gray-600 w-32 flex-shrink-0">Mitigation Action</label>
                              <ActionSelect value={bd.captchaBypassCriteria?.action}
                                onChange={v => patchBfCrit('captchaBypassCriteria', { action: v })}
                                options={['alarm-and-blocking-page', 'alarm-and-drop', 'alarm-and-honeypot-page']} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Distributed Brute Force Protection ── */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Distributed Brute Force Protection</h3>
                      <div className="divide-y divide-gray-100 border border-gray-100 rounded">
                        {/* Detection Period */}
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Detection Period</label>
                          <input type="number" min={1} value={toMin(bd.measurementPeriod)}
                            onChange={e => patchBf({ measurementPeriod: fromMin(e.target.value) })}
                            className="w-20 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                          <span className="text-xs text-gray-500">minutes</span>
                        </div>
                        {/* Max Prevention Duration */}
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Maximum Prevention Duration</label>
                          <input type="number" min={1} value={toMin(bd.reEnableLoginAfter)}
                            onChange={e => patchBf({ reEnableLoginAfter: fromMin(e.target.value) })}
                            className="w-20 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                          <span className="text-xs text-gray-500">minutes</span>
                        </div>
                        {/* Detect Distributed Attack */}
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Detect Distributed Attack</label>
                          <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
                            <button onClick={() => patchBfCrit('detectionCriteria', { detectDistributedBruteForceAttack: false })}
                              className={`px-3 py-1.5 ${!bd.detectionCriteria?.detectDistributedBruteForceAttack ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Never</button>
                            <button onClick={() => patchBfCrit('detectionCriteria', { detectDistributedBruteForceAttack: true })}
                              className={`px-3 py-1.5 ${bd.detectionCriteria?.detectDistributedBruteForceAttack ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>After</button>
                          </div>
                          {bd.detectionCriteria?.detectDistributedBruteForceAttack && (
                            <>
                              <input type="number" min={1} value={bd.detectionCriteria?.failedLoginAttemptsRateReached || ''}
                                onChange={e => patchBfCrit('detectionCriteria', { failedLoginAttemptsRateReached: Number(e.target.value) })}
                                className="w-16 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                              <span className="text-xs text-gray-500">failed attempts</span>
                            </>
                          )}
                        </div>
                        {/* Detect Credential Stuffing */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Detect Credential Stuffing</label>
                            <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
                              <button onClick={() => patchBfCrit('detectionCriteria', { detectCredentialsStuffingAttack: false })}
                                className={`px-3 py-1.5 ${!bd.detectionCriteria?.detectCredentialsStuffingAttack ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Never</button>
                              <button onClick={() => patchBfCrit('detectionCriteria', { detectCredentialsStuffingAttack: true })}
                                className={`px-3 py-1.5 ${bd.detectionCriteria?.detectCredentialsStuffingAttack ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>After</button>
                            </div>
                            {bd.detectionCriteria?.detectCredentialsStuffingAttack && (
                              <>
                                <input type="number" min={1} value={bd.detectionCriteria?.credentialsStuffingMatchesReached || ''}
                                  onChange={e => patchBfCrit('detectionCriteria', { credentialsStuffingMatchesReached: Number(e.target.value) })}
                                  className="w-16 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
                                <span className="text-xs text-gray-500">login attempts</span>
                              </>
                            )}
                          </div>
                          {bd.detectionCriteria?.detectCredentialsStuffingAttack && (
                            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                              <span>Note: In order for Detect Leaked Credential Stuffing Attack to operate, Blackfish API Cloud service needs to be configured (under Cloud Services) and be reachable.</span>
                            </div>
                          )}
                        </div>
                        {/* Mitigation Action */}
                        <div className="px-4 py-3 flex items-center gap-4">
                          <label className="w-48 text-xs font-medium text-gray-700 flex-shrink-0">Mitigation Action</label>
                          <ActionSelect value={bd.detectionCriteria?.action}
                            onChange={v => patchBfCrit('detectionCriteria', { action: v })}
                            options={['alarm', 'alarm-and-captcha', 'alarm-and-client-side-integrity', 'alarm-and-client-side-integrity-captcha']} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => { setBfModalIdx(null); setBfModalDraft(null) }}
                      className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={saveBfModal}
                      className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
                      {bfModalIdx === -1 ? 'Add' : 'Update'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── DATA GUARD ── */}
      {activeTab === 'dataguard' && (() => {
        const dg = pol['data-guard'] || {}

        function dgSet(key, val) { setNested('data-guard', key, val) }
        function dgToggle(key) { dgSet(key, !(dg[key] ?? false)) }

        function dgAddToList(key, val, clearFn) {
          const trimmed = val.trim()
          if (!trimmed) return
          const list = dg[key] || []
          if (list.includes(trimmed)) return
          dgSet(key, [...list, trimmed])
          clearFn('')
        }

        function dgRemoveFromList(key, val) {
          dgSet(key, (dg[key] || []).filter(v => v !== val))
        }

        // Segmented button pair helper
        function Seg({ leftLabel, rightLabel, active, onLeft, onRight }) {
          const base = 'px-3 py-1 text-xs font-medium border transition-colors'
          return (
            <span className="inline-flex rounded overflow-hidden border border-gray-200">
              <button onClick={onLeft}
                className={`${base} border-0 border-r border-gray-200 ${active ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {leftLabel}
              </button>
              <button onClick={onRight}
                className={`${base} border-0 ${!active ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {rightLabel}
              </button>
            </span>
          )
        }

        const maskEnabled  = dg.maskData ?? false
        const ccnDetect    = dg.creditCardNumbers ?? false
        const ssnDetect    = dg.usSocialSecurityNumbers ?? false
        const customDetect = dg.customPatterns ?? false
        const exceptDetect = dg.exceptionPatterns ?? false
        const fileCheck    = dg.fileContentDetection ?? false
        const enforceUrls  = (dg.enforcementMode === 'enforce-urls-in-list')

        const ROW = 'flex items-start gap-4 px-4 py-3 border-b border-gray-50 text-xs'
        const LABEL = 'w-52 shrink-0 font-medium text-gray-700 pt-1'

        return (
          <Card>
            <SectionHeader title="Data Guard (Sensitive Information Protection)"
              onClick={() => toggleSection('dataguard')} collapsed={collapsed.dataguard}
              action={
                <Toggle on={dg.enabled ?? false} onClick={e => { e.stopPropagation(); dgToggle('enabled') }} />
              } />
            {!collapsed.dataguard && (
              <div className="divide-y divide-gray-50">
              {!dg.enabled && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  Data Guard is disabled. Enable it to configure sensitive information protection.
                </div>
              )}
              {dg.enabled && <>

                {/* Mask Sensitive Data */}
                <div className={ROW}>
                  <span className={LABEL}>Mask Sensitive Data</span>
                  <div className="space-y-2">
                    <Seg leftLabel="Enabled" rightLabel="Disabled"
                      active={maskEnabled}
                      onLeft={() => dgSet('maskData', true)}
                      onRight={() => dgSet('maskData', false)} />
                    {maskEnabled && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-lg">
                        <span className="shrink-0">⚠</span>
                        <span>Since the security policy is configured to block the <strong>Data Guard: Information leakage detected</strong> violation, this setting has no effect and is relevant only if Delay Blocking is enabled in Session Tracking.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Credit Card Numbers */}
                <div className={ROW}>
                  <span className={LABEL}>Credit Card Numbers</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Seg leftLabel="Detect" rightLabel="Ignore"
                      active={ccnDetect}
                      onLeft={() => dgSet('creditCardNumbers', true)}
                      onRight={() => dgSet('creditCardNumbers', false)} />
                    {ccnDetect && (
                      <span className="flex items-center gap-2 text-gray-600">
                        Expose the last
                        <select value={dg.lastCcnDigitsToExpose ?? 4}
                          onChange={e => dgSet('lastCcnDigitsToExpose', Number(e.target.value))}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none">
                          {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        digits
                      </span>
                    )}
                  </div>
                </div>

                {/* US Social Security Numbers */}
                <div className={ROW}>
                  <span className={LABEL}>U.S. Social Security Numbers</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Seg leftLabel="Detect" rightLabel="Ignore"
                      active={ssnDetect}
                      onLeft={() => dgSet('usSocialSecurityNumbers', true)}
                      onRight={() => dgSet('usSocialSecurityNumbers', false)} />
                    {ssnDetect && (
                      <span className="flex items-center gap-2 text-gray-600">
                        Expose the last
                        <select value={dg.lastSsnDigitsToExpose ?? 4}
                          onChange={e => dgSet('lastSsnDigitsToExpose', Number(e.target.value))}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none">
                          {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        digits
                      </span>
                    )}
                  </div>
                </div>

                {/* Custom Patterns */}
                <div className={ROW}>
                  <span className={LABEL}>Custom Patterns</span>
                  <div className="space-y-2 flex-1">
                    <Seg leftLabel="Detect" rightLabel="Ignore"
                      active={customDetect}
                      onLeft={() => dgSet('customPatterns', true)}
                      onRight={() => dgSet('customPatterns', false)} />
                    {customDetect && <>
                      <div className="flex items-center gap-4 text-gray-600">
                        <span className="flex items-center gap-2">
                          Expose the first
                          <input type="number" min={0}
                            value={dg.customExposeFirst ?? 0}
                            onChange={e => dgSet('customExposeFirst', Number(e.target.value))}
                            className="w-14 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none" />
                          characters
                        </span>
                        <span className="flex items-center gap-2">
                          Expose the last
                          <input type="number" min={0}
                            value={dg.customExposeLast ?? 0}
                            onChange={e => dgSet('customExposeLast', Number(e.target.value))}
                            className="w-14 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none" />
                          characters
                        </span>
                      </div>
                      <div className="text-xs text-blue-600">
                        ⓘ Note: To guarantee effective value masking, ensure that the matched string for the custom pattern will be longer than the exposed characters.
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Use PCRE regular expression syntax"
                          value={dgCustomInput}
                          onChange={e => setDgCustomInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && dgAddToList('customPatternsList', dgCustomInput, setDgCustomInput)}
                          className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300" />
                        <Btn size="sm" onClick={() => dgAddToList('customPatternsList', dgCustomInput, setDgCustomInput)}>Add</Btn>
                      </div>
                      {(dg.customPatternsList || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(dg.customPatternsList).map(p => (
                            <span key={p} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                              {p}
                              <button onClick={() => dgRemoveFromList('customPatternsList', p)}
                                className="text-gray-300 hover:text-red-500 transition-colors ml-0.5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>}
                  </div>
                </div>

                {/* Exception Patterns */}
                <div className={ROW}>
                  <span className={LABEL}>Exception Patterns</span>
                  <div className="space-y-2 flex-1">
                    <Seg leftLabel="Detect" rightLabel="Ignore"
                      active={exceptDetect}
                      onLeft={() => dgSet('exceptionPatterns', true)}
                      onRight={() => dgSet('exceptionPatterns', false)} />
                    {exceptDetect && <>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Use PCRE regular expression syntax"
                          value={dgExceptionInput}
                          onChange={e => setDgExceptionInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && dgAddToList('exceptionPatternsList', dgExceptionInput, setDgExceptionInput)}
                          className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300" />
                        <Btn size="sm" onClick={() => dgAddToList('exceptionPatternsList', dgExceptionInput, setDgExceptionInput)}>Add</Btn>
                      </div>
                      {(dg.exceptionPatternsList || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(dg.exceptionPatternsList).map(p => (
                            <span key={p} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                              {p}
                              <button onClick={() => dgRemoveFromList('exceptionPatternsList', p)}
                                className="text-gray-300 hover:text-red-500 transition-colors ml-0.5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>}
                  </div>
                </div>

                {/* File Content Detection */}
                <div className={ROW}>
                  <span className={LABEL}>File Content Detection</span>
                  <div className="space-y-2 flex-1">
                    <Seg leftLabel="Check" rightLabel="Don't Check"
                      active={fileCheck}
                      onLeft={() => dgSet('fileContentDetection', true)}
                      onRight={() => dgSet('fileContentDetection', false)} />
                    {fileCheck && <>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Specify one or few file types"
                          value={dgFileTypeInput}
                          onChange={e => setDgFileTypeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && dgAddToList('fileTypesList', dgFileTypeInput, setDgFileTypeInput)}
                          className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300" />
                        <Btn size="sm" onClick={() => dgAddToList('fileTypesList', dgFileTypeInput, setDgFileTypeInput)}>Add</Btn>
                      </div>
                      {(dg.fileTypesList || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(dg.fileTypesList).map(f => (
                            <span key={f} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                              {f}
                              <button onClick={() => dgRemoveFromList('fileTypesList', f)}
                                className="text-gray-300 hover:text-red-500 transition-colors ml-0.5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>}
                  </div>
                </div>

                {/* Data Guard Protection Enforcement */}
                <div className={ROW}>
                  <span className={LABEL}>Data Guard Protection Enforcement<br /><span className="font-normal text-gray-400">(Wildcards Supported)</span></span>
                  <div className="space-y-2 flex-1">
                    <Seg leftLabel="Ignore URLs" rightLabel="Enforce URLs"
                      active={!enforceUrls}
                      onLeft={() => dgSet('enforcementMode', 'ignore-urls-in-list')}
                      onRight={() => dgSet('enforcementMode', 'enforce-urls-in-list')} />
                    <div className="flex gap-2">
                      <input type="text" placeholder="e.g. /login or /api/*"
                        value={dgUrlInput}
                        onChange={e => setDgUrlInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && dgAddToList('urlList', dgUrlInput, setDgUrlInput)}
                        className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300" />
                      <Btn size="sm" onClick={() => dgAddToList('urlList', dgUrlInput, setDgUrlInput)}>Add</Btn>
                    </div>
                    {(dg.urlList || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(dg.urlList).map(u => (
                          <span key={u} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                            {u}
                            <button onClick={() => dgRemoveFromList('urlList', u)}
                              className="text-gray-300 hover:text-red-500 transition-colors ml-0.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </>}
              </div>
            )}
          </Card>
        )
      })()}

      {/* ── IP INTELLIGENCE ── */}
      {activeTab === 'ipintel' && (() => {
        const enabled = pol['ip-intelligence']?.enabled ?? false
        function getCat(name) { return ipCats.find(c => c.category === name) || { category: name, alarm: false, block: false } }
        function setIpCatField(name, field, val) {
          setEditedPol(p => {
            const ipIntel = { ...(p['ip-intelligence'] || {}) }
            const cats = [...(ipIntel.ipIntelligenceCategories || [])]
            const idx = cats.findIndex(c => c.category === name)
            if (idx === -1) cats.push({ category: name, alarm: false, block: false, [field]: val })
            else cats[idx] = { ...cats[idx], [field]: val }
            ipIntel.ipIntelligenceCategories = cats
            return { ...p, 'ip-intelligence': ipIntel }
          })
          setUnsaved(true)
        }
        const allAlarm = IP_INTEL_CATEGORIES.flat().every(n => getCat(n).alarm)
        const allBlock = IP_INTEL_CATEGORIES.flat().every(n => getCat(n).block)
        function toggleAll(field) {
          const newVal = field === 'alarm' ? !allAlarm : !allBlock
          setEditedPol(p => {
            const ipIntel = { ...(p['ip-intelligence'] || {}) }
            const names = IP_INTEL_CATEGORIES.flat()
            const cats = names.map(name => ({ ...(ipIntel.ipIntelligenceCategories?.find(c => c.category === name) || { category: name, alarm: false, block: false }), [field]: newVal }))
            ipIntel.ipIntelligenceCategories = cats
            return { ...p, 'ip-intelligence': ipIntel }
          })
          setUnsaved(true)
        }
        const ipExceptions = pol['whitelist-ips'] || []
        const filteredIpExc = ipExcSearch
          ? ipExceptions.filter(e => (e.ipAddress || '').toLowerCase().includes(ipExcSearch.toLowerCase()) || (e.description || '').toLowerCase().includes(ipExcSearch.toLowerCase()))
          : ipExceptions
        function openIpExcModal(idx) {
          const base = idx === -1
            ? { ipAddress: '', ipMask: '255.255.255.255', description: '', blockRequests: 'policy-default', trustedByPolicyBuilder: false, ignoreAnomalies: false, neverLearnRequests: false, neverLogRequests: false, ignoreIpReputation: false }
            : JSON.parse(JSON.stringify(ipExceptions[idx]))
          setIpExcModalDraft(base)
          setIpExcModalIdx(idx)
        }
        function saveIpExcModal() {
          const arr = [...ipExceptions]
          if (ipExcModalIdx === -1) arr.push(ipExcModalDraft)
          else arr[ipExcModalIdx] = ipExcModalDraft
          setEditedPol(p => ({ ...p, 'whitelist-ips': arr }))
          setUnsaved(true)
          setIpExcModalIdx(null)
          setIpExcModalDraft(null)
        }
        function patchExcDraft(patch) { setIpExcModalDraft(d => ({ ...d, ...patch })) }
        const excDraft = ipExcModalDraft || {}
        const showFullExcFields = excDraft.blockRequests !== 'always'
        const blockLabel = e => e.blockRequests === 'always' ? 'Always Block' : e.blockRequests === 'never' ? 'Never Block' : 'Policy Default'
        return (
          <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">IP Intelligence</span>
              <Toggle on={enabled} onClick={() => toggleNested('ip-intelligence', 'enabled')} />
            </div>
            {enabled && (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-x-8">
                  {[0, 1].map(col => (
                    <table key={col} className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-normal text-gray-400 w-full"></th>
                          <th className="py-2 w-20 text-center">
                            <label className="flex items-center justify-center gap-1.5 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                              <input type="checkbox" checked={allAlarm} onChange={() => toggleAll('alarm')} /> Alarm
                            </label>
                          </th>
                          <th className="py-2 w-20 text-center">
                            <label className="flex items-center justify-center gap-1.5 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                              <input type="checkbox" checked={allBlock} onChange={() => toggleAll('block')} /> Block
                            </label>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {IP_INTEL_CATEGORIES.map(row => row[col]).map(name => {
                          const cat = getCat(name)
                          return (
                            <tr key={name} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 pr-4 text-gray-800 font-medium">{name}</td>
                              <td className="py-2 text-center">
                                <input type="checkbox" checked={cat.alarm ?? false}
                                  onChange={e => setIpCatField(name, 'alarm', e.target.checked)} className="cursor-pointer" />
                              </td>
                              <td className="py-2 text-center">
                                <input type="checkbox" checked={cat.block ?? false}
                                  onChange={e => setIpCatField(name, 'block', e.target.checked)} className="cursor-pointer" />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── IP Address Exceptions ── */}
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">IP Address Exceptions</span>
              <button onClick={() => openIpExcModal(-1)}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Create</button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={ipExcSearch} onChange={e => setIpExcSearch(e.target.value)} placeholder="Search IP Address Exceptions"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{filteredIpExc.length} {filteredIpExc.length === 1 ? 'Entry' : 'Entries'}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">IP Address &amp; Netmask</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Block IP</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Policy Builder</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">Brute Force Detection</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">Learning Suggestions</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">Log Traffic</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">IP Intelligence</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Description</th>
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIpExc.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No IP address exceptions defined.</td></tr>
                  )}
                  {filteredIpExc.map((exc, i) => {
                    const realIdx = ipExceptions.indexOf(exc)
                    const showFull = exc.blockRequests !== 'always'
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 text-blue-600 font-medium font-mono cursor-pointer hover:underline" onClick={() => openIpExcModal(realIdx)}>
                          {exc.ipAddress}{exc.ipMask && exc.ipMask !== '255.255.255.255' ? ` / ${exc.ipMask}` : ''}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{blockLabel(exc)}</td>
                        <td className="px-4 py-2 text-gray-700">{showFull ? (exc.trustedByPolicyBuilder ? 'Trust this IP' : "Don't Trust IP") : '—'}</td>
                        <td className="px-4 py-2 text-center">{showFull ? (!exc.ignoreAnomalies ? <span className="text-blue-500">✓</span> : <span className="text-gray-400">✕</span>) : '—'}</td>
                        <td className="px-4 py-2 text-center">{!exc.neverLearnRequests ? <span className="text-blue-500">✓</span> : <span className="text-gray-400">✕</span>}</td>
                        <td className="px-4 py-2 text-center">{showFull ? (!exc.neverLogRequests ? <span className="text-blue-500">✓</span> : <span className="text-gray-400">✕</span>) : '—'}</td>
                        <td className="px-4 py-2 text-center">{showFull ? (!exc.ignoreIpReputation ? <span className="text-blue-500">✓</span> : <span className="text-gray-400">✕</span>) : '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{exc.description}</td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => {
                            setEditedPol(p => ({ ...p, 'whitelist-ips': (p['whitelist-ips'] || []).filter((_, j) => j !== realIdx) }))
                            setUnsaved(true)
                          }} className="text-gray-300 hover:text-red-500 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── IP Address Exception Modal ── */}
          {ipExcModalIdx !== null && ipExcModalDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-2xl w-[676px] max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">IP Address Exception Properties</h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {/* IP Address */}
                  <div className="flex items-start gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 pt-2 flex-shrink-0">IP Address <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-2 flex-1">
                      <input value={excDraft.ipAddress || ''} onChange={e => patchExcDraft({ ipAddress: e.target.value })}
                        placeholder="e.g. 192.168.1.1" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <span className="text-gray-400 text-xs">/</span>
                      <input value={excDraft.ipMask || ''} onChange={e => patchExcDraft({ ipMask: e.target.value })}
                        placeholder="e.g. 255.255.255.255" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                  {/* Description */}
                  <div className="flex items-start gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 pt-2 flex-shrink-0">Description</label>
                    <textarea value={excDraft.description || ''} onChange={e => patchExcDraft({ description: e.target.value })} rows={3}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y" />
                  </div>
                  {/* Block this IP Address */}
                  <div className="flex items-center gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Block this IP Address</label>
                    <select value={excDraft.blockRequests || 'policy-default'} onChange={e => patchExcDraft({ blockRequests: e.target.value })}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="policy-default">Policy Default</option>
                      <option value="always">Always Block this IP</option>
                      <option value="never">Never Block this IP</option>
                    </select>
                  </div>
                  {/* Policy Builder Traffic — hidden when Always Block */}
                  {showFullExcFields && (
                    <div className="flex items-center gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Policy Builder Traffic</label>
                      <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                        <button onClick={() => patchExcDraft({ trustedByPolicyBuilder: true })}
                          className={`px-3 py-1.5 ${excDraft.trustedByPolicyBuilder ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>
                          Trust this IP
                        </button>
                        <button onClick={() => patchExcDraft({ trustedByPolicyBuilder: false })}
                          className={`px-3 py-1.5 ${!excDraft.trustedByPolicyBuilder ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600'}`}>
                          Don't Trust IP
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Brute Force Detection — hidden when Always Block */}
                  {showFullExcFields && (
                    <div className="flex items-center gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Brute Force Detection</label>
                      <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                        <button onClick={() => patchExcDraft({ ignoreAnomalies: false })}
                          className={`px-3 py-1.5 flex items-center gap-1 ${!excDraft.ignoreAnomalies ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                          <span>✓</span> Include IP
                        </button>
                        <button onClick={() => patchExcDraft({ ignoreAnomalies: true })}
                          className={`px-3 py-1.5 flex items-center gap-1 ${excDraft.ignoreAnomalies ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                          <span>✕</span> Ignore IP
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Learning Suggestions — always shown */}
                  <div className="flex items-center gap-4">
                    <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Learning Suggestions</label>
                    <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                      <button onClick={() => patchExcDraft({ neverLearnRequests: false })}
                        className={`px-3 py-1.5 flex items-center gap-1 ${!excDraft.neverLearnRequests ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                        <span>✓</span> Include IP
                      </button>
                      <button onClick={() => patchExcDraft({ neverLearnRequests: true })}
                        className={`px-3 py-1.5 flex items-center gap-1 ${excDraft.neverLearnRequests ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                        <span>✕</span> Ignore IP
                      </button>
                    </div>
                  </div>
                  {/* Log Traffic — hidden when Always Block */}
                  {showFullExcFields && (
                    <div className="flex items-center gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">Log Traffic from this IP Address</label>
                      <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                        <button onClick={() => patchExcDraft({ neverLogRequests: false })}
                          className={`px-3 py-1.5 flex items-center gap-1 ${!excDraft.neverLogRequests ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                          <span>✓</span> Allow Logging
                        </button>
                        <button onClick={() => patchExcDraft({ neverLogRequests: true })}
                          className={`px-3 py-1.5 flex items-center gap-1 ${excDraft.neverLogRequests ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                          <span>✕</span> Never Log
                        </button>
                      </div>
                    </div>
                  )}
                  {/* IP Intelligence — hidden when Always Block */}
                  {showFullExcFields && (
                    <div className="flex items-center gap-4">
                      <label className="w-44 text-xs font-medium text-gray-700 flex-shrink-0">IP Intelligence</label>
                      <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
                        <button onClick={() => patchExcDraft({ ignoreIpReputation: false })}
                          className={`px-3 py-1.5 flex items-center gap-1 ${!excDraft.ignoreIpReputation ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                          <span>✓</span> Include IP
                        </button>
                        <button onClick={() => patchExcDraft({ ignoreIpReputation: true })}
                          className={`px-3 py-1.5 flex items-center gap-1 ${excDraft.ignoreIpReputation ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                          <span>✕</span> Ignore IP
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button onClick={() => { setIpExcModalIdx(null); setIpExcModalDraft(null) }}
                    className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveIpExcModal} disabled={!excDraft.ipAddress?.trim()}
                    className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {ipExcModalIdx === -1 ? 'Add' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )
      })()}

      {/* ── SERVER TECHNOLOGIES ── */}
      {/* ── SSRF ── */}
      {activeTab === 'ssrf' && (() => {
        const ssrfHosts = pol['ssrf-hosts'] || []
        const filtered = ssrfSearch
          ? ssrfHosts.filter(h => h.host.toLowerCase().includes(ssrfSearch.toLowerCase()))
          : ssrfHosts
        function setSsrfHosts(arr) { setEditedPol(p => ({ ...p, 'ssrf-hosts': arr })); setUnsaved(true) }
        function openSsrfModal(idx) {
          setSsrfModalDraft(idx === -1 ? { host: '', action: 'disallow' } : { ...ssrfHosts[idx] })
          setSsrfModalIdx(idx)
        }
        function saveSsrfModal() {
          const arr = [...ssrfHosts]
          const entry = { ...ssrfModalDraft, wildcardOrder: ssrfModalDraft.wildcardOrder ?? -2 }
          if (ssrfModalIdx === -1) arr.push(entry)
          else arr[ssrfModalIdx] = entry
          setSsrfHosts(arr)
          setSsrfModalIdx(null); setSsrfModalDraft(null)
        }
        const sd = ssrfModalDraft || {}
        const actionColor = { disallow: 'bg-red-100 text-red-700', resolve: 'bg-blue-100 text-blue-700', allow: 'bg-green-100 text-green-700' }
        const isDuplicate = !!sd.host?.trim() && ssrfHosts.some((h, i) => i !== ssrfModalIdx && h.host === sd.host.trim())
        return (
          <div>
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">SSRF Hosts</span>
              <button onClick={() => openSsrfModal(-1)}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Create</button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={ssrfSearch} onChange={e => setSsrfSearch(e.target.value)} placeholder="Search hosts…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{filtered.length} {filtered.length === 1 ? 'Entry' : 'Entries'}</span>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Host</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 w-32">Action</th>
                  <th className="px-4 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No SSRF hosts configured.</td></tr>
                )}
                {filtered.map((h, i) => {
                  const realIdx = ssrfHosts.indexOf(h)
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-800">
                        <button onClick={() => openSsrfModal(realIdx)} className="text-blue-600 hover:underline text-left">{h.host}</button>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${actionColor[h.action] || 'bg-gray-100 text-gray-600'}`}>
                          {h.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => setSsrfHosts(ssrfHosts.filter((_, j) => j !== realIdx))}
                          className="text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* SSRF notices */}
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-2.5">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
              <span>Although the feature is enabled, violations will not be alerted. To change this, modify flags for the <span className="font-medium">"Illegal parameter data type"</span> and <span className="font-medium">"Server-side access to disallowed host"</span> violations in <button onClick={() => setActiveTab('violations')} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Learning and Blocking Settings <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button></span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-2.5">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
              <span>This feature does not work until at least one parameter with URI Data Type is defined in <button onClick={() => setActiveTab('parameters')} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Parameters List <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button></span>
            </div>
          </div>

          {/* SSRF Modal */}
          {ssrfModalIdx !== null && ssrfModalDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSsrfModalIdx(null); setSsrfModalDraft(null) }}>
              <div className="bg-white rounded-xl shadow-2xl w-[480px]" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">SSRF Host Properties</h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-xs font-medium text-gray-700 flex-shrink-0">Host <span className="text-red-500">*</span></label>
                    <div className="flex-1">
                      <input value={sd.host || ''} onChange={e => setSsrfModalDraft(d => ({ ...d, host: e.target.value }))}
                        placeholder="Hostname, IP, CIDR or wildcard (e.g. *.example.com)"
                        className={`w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${isDuplicate ? 'border-red-400' : 'border-gray-200'}`} />
                      {isDuplicate && <p className="text-xs text-red-500 mt-1">"{sd.host}" already exists.</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-xs font-medium text-gray-700 flex-shrink-0">Action</label>
                    <div className="inline-flex rounded overflow-hidden border border-gray-200 text-xs">
                      {[{ value: 'disallow', label: 'Disallow' }, { value: 'resolve', label: 'Resolve' }, { value: 'allow', label: 'Allow' }].map(o => (
                        <button key={o.value} onClick={() => setSsrfModalDraft(d => ({ ...d, action: o.value }))}
                          className={`px-3 py-1.5 ${sd.action === o.value ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button onClick={() => { setSsrfModalIdx(null); setSsrfModalDraft(null) }}
                    className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveSsrfModal} disabled={!sd.host?.trim() || isDuplicate}
                    className="text-xs px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {ssrfModalIdx === -1 ? 'Add' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )
      })()}

      {/* ── PLAIN TEXT PROFILES ── */}
      {activeTab === 'plaintext' && (() => {
        function openPtModal(idx) {
          const base = idx === -1
            ? { name: '', description: '', defenseAttributes: { maximumTotalLength: 'any', maximumLineLength: 'any', performPercentDecoding: false }, attackSignaturesCheck: true, signatureOverrides: [], websocketUrls: [] }
            : JSON.parse(JSON.stringify(plainProfs[idx]))
          setPtModalIdx(idx)
          setPtModalDraft(base)
          setPlainTextSubTab('attack-sigs')
          setPtSelectedLeft(new Set())
          setPtSelectedRight(new Set())
          setPtSigSearch('')
        }
        function closePtModal() { setPtModalIdx(null); setPtModalDraft(null) }
        function commitPtModal() {
          setEditedPol(p => {
            const profs = [...(p['plain-text-profiles'] || [])]
            if (ptModalIdx === -1) profs.push(ptModalDraft)
            else profs[ptModalIdx] = ptModalDraft
            return { ...p, 'plain-text-profiles': profs }
          })
          setUnsaved(true)
          closePtModal()
        }
        function deletePtp(idx) {
          if (!window.confirm(`Delete profile "${plainProfs[idx].name}"?`)) return
          setEditedPol(p => {
            const profs = [...(p['plain-text-profiles'] || [])]
            profs.splice(idx, 1)
            return { ...p, 'plain-text-profiles': profs }
          })
          setUnsaved(true)
        }
        function patchDraft(patch) { setPtModalDraft(d => ({ ...d, ...patch })) }
        function patchDraftAttr(key, val) {
          setPtModalDraft(d => ({ ...d, defenseAttributes: { ...(d.defenseAttributes || {}), [key]: val } }))
        }
        function addSigOverride(sigId) {
          setPtModalDraft(d => {
            const overrides = d.signatureOverrides || []
            if (overrides.some(o => (o.signatureId ?? o.id) === sigId)) return d
            return { ...d, signatureOverrides: [...overrides, { signatureId: sigId, enabled: false }] }
          })
          setPtSelectedRight(new Set())
        }
        function removeSigOverride(sigId) {
          setPtModalDraft(d => ({ ...d, signatureOverrides: (d.signatureOverrides || []).filter(o => (o.signatureId ?? o.id) !== sigId) }))
          setPtSelectedLeft(new Set())
        }

        const draft = ptModalDraft
        const draftAttrs = draft?.defenseAttributes || {}
        const draftOverrides = draft?.signatureOverrides || []
        const ptAdvSigs = deviceSigs.filter(s => {
          const q = ptSigSearch.toLowerCase()
          if (q && !String(s.signatureId ?? s.id).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (ptSigFilters.accuracy !== 'all' && s.accuracy !== ptSigFilters.accuracy) return false
          if (ptSigFilters.risk !== 'all' && s.risk !== ptSigFilters.risk) return false
          if (ptSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (ptSigFilters.cve === 'yes')) return false
          return true
        })

        return (
          <>
          <ProfileTable
            title="Plain Text Profiles" profiles={plainProfs} cpType="plain-text" urls={urls}
            collapsed={collapsed.plaintext} onToggleCollapse={() => toggleSection('plaintext')}
            onCreate={() => openPtModal(-1)} onEdit={openPtModal}
            onChange={arr => setTop('plain-text-profiles', arr)} />

          {/* ── Plain Text Profile Modal ── */}
          {ptModalIdx !== null && draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closePtModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {ptModalIdx === -1 ? 'Create Plain Text Profile' : `Edit Profile — ${plainProfs[ptModalIdx]?.name || ''}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" onClick={closePtModal}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={commitPtModal}>
                      {ptModalIdx === -1 ? 'Create' : 'Update'}
                    </Btn>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                  {/* Profile Properties */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">Profile Properties</div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-44 text-xs text-gray-600 flex-shrink-0">Profile Name</span>
                        <input className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={draft.name || ''} onChange={e => patchDraft({ name: e.target.value })} />
                      </div>
                      <div className="flex items-start px-4 py-2.5 gap-4">
                        <span className="w-44 text-xs text-gray-600 flex-shrink-0 mt-1">Description</span>
                        <textarea rows={2} className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-none"
                          value={draft.description || ''} onChange={e => patchDraft({ description: e.target.value })} />
                      </div>
                      {[
                        { label: 'Maximum Total Length', key: 'maximumTotalLength' },
                        { label: 'Maximum Line Length',  key: 'maximumLineLength'  },
                      ].map(({ label, key }) => {
                        const val = draftAttrs[key] ?? 'any'
                        return (
                          <div key={key} className="flex items-center px-4 py-2.5 gap-4">
                            <span className="w-44 text-xs text-gray-600 flex-shrink-0">{label}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`pt-${key}`} checked={val === 'any'} onChange={() => patchDraftAttr(key, 'any')} /> Any
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`pt-${key}`} checked={val !== 'any'} onChange={() => patchDraftAttr(key, 65536)} /> Length:
                              </label>
                              <input type="number" min={1} disabled={val === 'any'}
                                value={val === 'any' ? '' : val}
                                onChange={e => patchDraftAttr(key, Number(e.target.value))}
                                className="w-20 border border-gray-300 rounded px-2 py-0.5 text-xs text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              <span className="text-gray-500">bytes</span>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-44 text-xs text-gray-600 flex-shrink-0">Perform Percent Decoding</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draftAttrs.performPercentDecoding ?? false}
                            onChange={e => patchDraftAttr('performPercentDecoding', e.target.checked)} />
                          Enabled
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                      {[['attack-sigs', 'Attack Signatures'], ['value-meta', 'Value Meta Characters']].map(([id, label]) => (
                        <button key={id} onClick={() => setPlainTextSubTab(id)}
                          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors
                            ${plainTextSubTab === id ? 'border-blue-500 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {plainTextSubTab === 'attack-sigs' && (() => {
                      const sigOverrides = draftOverrides
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={draft.attackSignaturesCheck ?? true}
                              onChange={e => patchDraft({ attackSignaturesCheck: e.target.checked })} />
                            Check attack signatures and threat campaigns
                          </label>
                          {(draft.attackSignaturesCheck ?? true) && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 mb-2">
                                Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}
                              </div>
                              {sigOverrides.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {sigOverrides.map((o, oi) => {
                                    const sigId = o.signatureId ?? o.id
                                    const info = deviceSigs.find(s => String(s.signatureId ?? s.id) === String(sigId))
                                    return (
                                      <span key={oi} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700">
                                        <span className="font-mono">{sigId}</span>
                                        {info && <span className="text-gray-400 max-w-32 truncate">{info.name}</span>}
                                        <button onClick={() => patchDraft({ signatureOverrides: sigOverrides.filter((_, j) => j !== oi) })}
                                          className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              <form onSubmit={e => {
                                e.preventDefault()
                                const v = e.target.sigId.value.trim()
                                if (!v) return
                                if (sigOverrides.some(o => String(o.signatureId ?? o.id) === v)) { e.target.reset(); return }
                                patchDraft({ signatureOverrides: [...sigOverrides, { signatureId: v, enabled: false }] })
                                e.target.reset()
                              }} className="flex gap-1">
                                <input name="sigId" placeholder="Signature ID…"
                                  className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                <button type="button"
                                  onClick={() => { setPtSigAdvancedOpen(true); setPtSigSearch(''); setPtSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' }); setPtSigAdvancedSelected(new Set(sigOverrides.map(o => String(o.signatureId ?? o.id)))) }}
                                  className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">Advanced</button>
                              </form>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {plainTextSubTab === 'value-meta' && (() => {
                      const vmChars = draft.valueMetaCharacters || []
                      const typeDefault = charsetDefaults['plain-text-content'] || {}
                      const defaultFor = (hex) => (hex in typeDefault) ? typeDefault[hex] : (PT_ALL_CHARS.find(c => c.hex === hex)?.defaultAllowed ?? false)
                      function getState(hex) {
                        const entry = vmChars.find(c => c.metachar === hex)
                        return entry ? entry.isAllowed : defaultFor(hex)
                      }
                      function setState(hex, allowed) {
                        const next = vmChars.filter(c => c.metachar !== hex)
                        next.push({ metachar: hex, isAllowed: allowed })
                        patchDraft({ valueMetaCharacters: next })
                      }
                      const allDisplay = (() => {
                        if (ptMetaView === 'meta-only') return PT_ALL_CHARS.filter(c => c.isMeta)
                        if (ptMetaView === 'allowed')   return PT_ALL_CHARS.filter(c => !c.disabled && getState(c.hex))
                        if (ptMetaView === 'disallowed') return PT_ALL_CHARS.filter(c => !c.disabled && !getState(c.hex))
                        return PT_ALL_CHARS
                      })()
                      const colSize = Math.ceil(allDisplay.length / 4)
                      const cols = [0,1,2,3].map(ci => allDisplay.slice(ci * colSize, (ci + 1) * colSize))
                      return (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">View</span>
                              <select value={ptMetaView} onChange={e => setPtMetaView(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="all">All characters</option>
                                <option value="allowed">Allowed characters</option>
                                <option value="disallowed">Disallowed characters</option>
                                <option value="meta-only">Meta characters only</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
                                onClick={() => patchDraft({ valueMetaCharacters: [] })}>
                                Restore Defaults
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
                            {cols.map((col, ci) => (
                              <div key={ci} className={`flex-1 ${ci < 3 ? 'border-r border-gray-200' : ''}`}>
                                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                                  <div className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">Hex</div>
                                  <div className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">Char</div>
                                  <div className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">State</div>
                                </div>
                                {col.map(ch => {
                                  const allowed = getState(ch.hex)
                                  const modified = !ch.disabled && allowed !== defaultFor(ch.hex)
                                  return (
                                    <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                                      <div className="px-2 py-1 text-[10px] text-blue-600 font-mono text-center">{ch.hex}</div>
                                      <div className="px-2 py-1 text-[10px] text-gray-700 text-center font-medium">{ch.name}</div>
                                      <div className="px-1 py-0.5 text-center">
                                        {ch.disabled
                                          ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full">
                                              <option>Disallow</option>
                                            </select>
                                          : <select value={allowed ? 'allow' : 'disallow'}
                                              onChange={e => setState(ch.hex, e.target.value === 'allow')}
                                              className="text-[10px] border border-gray-300 rounded px-1 py-0 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full cursor-pointer">
                                              <option value="allow">Allow</option>
                                              <option value="disallow">Disallow</option>
                                            </select>
                                        }
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── PT Advanced Signature Modal (z-60, above main PT modal) ── */}
          {ptSigAdvancedOpen && ptModalDraft && (() => {
            const sigOverrides = ptModalDraft.signatureOverrides || []
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={ptSigFilters[k]} onChange={e => setPtSigFilters(f => ({ ...f, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${ptSigFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setPtSigAdvancedOpen(false)}>
                <div className="bg-white rounded-lg shadow-2xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ptSigAdvancedSelected.size} selected · {deviceSigs.length} total</div>
                    </div>
                    <button onClick={() => setPtSigAdvancedOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input autoFocus placeholder="Search by ID or name…" value={ptSigSearch}
                      onChange={e => setPtSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {Object.values(ptSigFilters).some(v => v !== 'all') && (
                      <button onClick={() => setPtSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>
                    )}
                    <span className="ml-auto text-xs text-gray-400">{ptAdvSigs.length} shown · {ptSigAdvancedSelected.size} selected</span>
                    {ptSigAdvancedSelected.size > 0 && (
                      <button onClick={() => setPtSigAdvancedSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="px-5 py-8 text-center text-sm text-gray-400">Load signatures via the Signatures tab first.</div>
                      : ptAdvSigs.map(s => {
                        const sid = String(s.signatureId ?? s.id)
                        const checked = ptSigAdvancedSelected.has(sid)
                        return (
                          <div key={sid} onClick={() => setPtSigAdvancedSelected(prev => { const n = new Set(prev); checked ? n.delete(sid) : n.add(sid); return n })}
                            className={`flex items-center gap-3 px-5 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                            <span className="font-mono text-xs text-gray-500 w-20 flex-shrink-0">{sid}</span>
                            <span className="text-xs text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                            {s.accuracy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{s.accuracy}</span>}
                            {s.risk && <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${s.risk === 'high' ? 'bg-red-100 text-red-600' : s.risk === 'medium' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{s.risk}</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                  <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <Btn size="sm" onClick={() => setPtSigAdvancedOpen(false)}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={() => {
                      const newOverrides = [...ptSigAdvancedSelected].map(sid => {
                        const existing = sigOverrides.find(o => String(o.signatureId ?? o.id) === sid)
                        return existing || { signatureId: sid, enabled: false }
                      })
                      patchDraft({ signatureOverrides: newOverrides })
                      setPtSigAdvancedOpen(false)
                    }}>Apply</Btn>
                  </div>
                </div>
              </div>
            )
          })()}
          </>
        )
      })()}

      {/* ── GWT PROFILES ── */}
      {activeTab === 'gwt' && (() => {
        function openGwtModal(idx) {
          const base = idx === -1
            ? { name: '', description: '', defenseAttributes: { maximumTotalLength: 10000, maximumValueLength: 100, tolerateParsingWarnings: true }, attackSignaturesCheck: false, signatureOverrides: [], valueMetaCharacters: [] }
            : JSON.parse(JSON.stringify(gwtProfs[idx]))
          setGwtModalIdx(idx)
          setGwtModalDraft(base)
          setGwtSubTab('attack-sigs')
          setGwtSigSearch('')
          setGwtSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })
          setGwtSigAdvancedSelected(new Set())
        }
        function closeGwtModal() { setGwtModalIdx(null); setGwtModalDraft(null) }
        function commitGwtModal() {
          setEditedPol(p => {
            const profs = [...(p['gwt-profiles'] || [])]
            if (gwtModalIdx === -1) profs.push(gwtModalDraft)
            else profs[gwtModalIdx] = gwtModalDraft
            return { ...p, 'gwt-profiles': profs }
          })
          setUnsaved(true)
          closeGwtModal()
        }
        function deleteGwt(idx) {
          if (!window.confirm(`Delete profile "${gwtProfs[idx].name}"?`)) return
          setEditedPol(p => {
            const profs = [...(p['gwt-profiles'] || [])]
            profs.splice(idx, 1)
            return { ...p, 'gwt-profiles': profs }
          })
          setUnsaved(true)
        }
        function patchGwt(patch) { setGwtModalDraft(d => ({ ...d, ...patch })) }
        function patchGwtAttr(key, val) { setGwtModalDraft(d => ({ ...d, defenseAttributes: { ...(d.defenseAttributes || {}), [key]: val } })) }

        const draft = gwtModalDraft
        const draftAttrs = draft?.defenseAttributes || {}
        const draftOverrides = draft?.signatureOverrides || []

        const gwtAdvSigs = deviceSigs.filter(s => {
          const q = gwtSigSearch.toLowerCase()
          if (q && !String(s.signatureId ?? s.id).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (gwtSigFilters.accuracy !== 'all' && s.accuracy !== gwtSigFilters.accuracy) return false
          if (gwtSigFilters.risk !== 'all' && s.risk !== gwtSigFilters.risk) return false
          if (gwtSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (gwtSigFilters.cve === 'yes')) return false
          return true
        })

        return (
          <>
          <ProfileTable
            title="GWT Profiles" profiles={gwtProfs} cpType="gwt" urls={urls}
            collapsed={collapsed.gwt} onToggleCollapse={() => toggleSection('gwt')}
            onCreate={() => openGwtModal(-1)} onEdit={openGwtModal}
            onChange={arr => setTop('gwt-profiles', arr)} />

          {/* GWT Profile Modal */}
          {gwtModalIdx !== null && draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeGwtModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {gwtModalIdx === -1 ? 'Create GWT Profile' : `Edit Profile — ${gwtProfs[gwtModalIdx]?.name || ''}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" onClick={closeGwtModal}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={commitGwtModal}>{gwtModalIdx === -1 ? 'Create' : 'Update'}</Btn>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                  {/* Profile Properties */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">Profile Properties</div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0">Profile Name</span>
                        <input className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={draft.name || ''} onChange={e => patchGwt({ name: e.target.value })} />
                      </div>
                      <div className="flex items-start px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0 mt-1">Description</span>
                        <textarea rows={2} className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-none"
                          value={draft.description || ''} onChange={e => patchGwt({ description: e.target.value })} />
                      </div>
                      {[
                        { label: 'Maximum Total Length Of GWT Data', key: 'maximumTotalLength',  def: 10000 },
                        { label: 'Maximum Value Length',              key: 'maximumValueLength', def: 100   },
                      ].map(({ label, key, def }) => {
                        const val = draftAttrs[key] ?? def
                        const isAny = val === 'any'
                        return (
                          <div key={key} className="flex items-center px-4 py-2.5 gap-4">
                            <span className="w-52 text-xs text-gray-600 flex-shrink-0">{label}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`gwt-${key}`} checked={isAny} onChange={() => patchGwtAttr(key, 'any')} /> Any
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`gwt-${key}`} checked={!isAny} onChange={() => patchGwtAttr(key, def)} /> Length:
                              </label>
                              <input type="number" min={1} disabled={isAny}
                                value={isAny ? '' : val}
                                onChange={e => patchGwtAttr(key, Number(e.target.value))}
                                className="w-24 border border-gray-300 rounded px-2 py-0.5 text-xs text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              <span className="text-gray-500">bytes</span>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0">Tolerate GWT Parsing Warnings</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draftAttrs.tolerateParsingWarnings ?? true}
                            onChange={e => patchGwtAttr('tolerateParsingWarnings', e.target.checked)} />
                          Enabled
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                      {[['attack-sigs', 'Attack Signatures'], ['value-meta', 'Value Meta Characters']].map(([id, label]) => (
                        <button key={id} onClick={() => setGwtSubTab(id)}
                          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors
                            ${gwtSubTab === id ? 'border-blue-500 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {gwtSubTab === 'attack-sigs' && (() => {
                      const sigOverrides = draftOverrides
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={draft.attackSignaturesCheck ?? false}
                              onChange={e => patchGwt({ attackSignaturesCheck: e.target.checked })} />
                            Check attack signatures and threat campaigns
                          </label>
                          {(draft.attackSignaturesCheck ?? false) && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 mb-2">
                                Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}
                              </div>
                              {sigOverrides.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {sigOverrides.map((o, oi) => {
                                    const sigId = o.signatureId ?? o.id
                                    const info = deviceSigs.find(s => String(s.signatureId ?? s.id) === String(sigId))
                                    return (
                                      <span key={oi} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700">
                                        <span className="font-mono">{sigId}</span>
                                        {info && <span className="text-gray-400 max-w-32 truncate">{info.name}</span>}
                                        <button onClick={() => patchGwt({ signatureOverrides: sigOverrides.filter((_, j) => j !== oi) })}
                                          className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              <form onSubmit={e => {
                                e.preventDefault()
                                const v = e.target.sigId.value.trim()
                                if (!v || sigOverrides.some(o => String(o.signatureId ?? o.id) === v)) { e.target.reset(); return }
                                patchGwt({ signatureOverrides: [...sigOverrides, { signatureId: v, enabled: false }] })
                                e.target.reset()
                              }} className="flex gap-1">
                                <input name="sigId" placeholder="Signature ID…"
                                  className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                <button type="button"
                                  onClick={() => { setGwtSigAdvancedOpen(true); setGwtSigSearch(''); setGwtSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' }); setGwtSigAdvancedSelected(new Set(sigOverrides.map(o => String(o.signatureId ?? o.id)))) }}
                                  className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">Advanced</button>
                              </form>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {gwtSubTab === 'value-meta' && (() => {
                      const vmChars = draft.valueMetaCharacters || []
                      const typeDefault = charsetDefaults['gwt-content'] || {}
                      const defaultFor = (hex) => (hex in typeDefault) ? typeDefault[hex] : (PT_ALL_CHARS.find(c => c.hex === hex)?.defaultAllowed ?? false)
                      function getState(hex) {
                        const entry = vmChars.find(c => c.metachar === hex)
                        return entry ? entry.isAllowed : defaultFor(hex)
                      }
                      function setState(hex, allowed) {
                        const next = vmChars.filter(c => c.metachar !== hex)
                        next.push({ metachar: hex, isAllowed: allowed })
                        patchGwt({ valueMetaCharacters: next })
                      }
                      const allDisplay = (() => {
                        if (gwtMetaView === 'meta-only')  return PT_ALL_CHARS.filter(c => c.isMeta)
                        if (gwtMetaView === 'allowed')    return PT_ALL_CHARS.filter(c => !c.disabled && getState(c.hex))
                        if (gwtMetaView === 'disallowed') return PT_ALL_CHARS.filter(c => !c.disabled && !getState(c.hex))
                        return PT_ALL_CHARS
                      })()
                      const colSize = Math.ceil(allDisplay.length / 4)
                      const cols = [0,1,2,3].map(ci => allDisplay.slice(ci * colSize, (ci + 1) * colSize))
                      return (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">View</span>
                              <select value={gwtMetaView} onChange={e => setGwtMetaView(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="all">All characters</option>
                                <option value="allowed">Allowed characters</option>
                                <option value="disallowed">Disallowed characters</option>
                                <option value="meta-only">Meta characters only</option>
                              </select>
                            </div>
                            <button className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
                              onClick={() => patchGwt({ valueMetaCharacters: [] })}>
                              Restore Defaults
                            </button>
                          </div>
                          <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
                            {cols.map((col, ci) => (
                              <div key={ci} className={`flex-1 ${ci < 3 ? 'border-r border-gray-200' : ''}`}>
                                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                                  <div className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">Hex</div>
                                  <div className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">Char</div>
                                  <div className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">State</div>
                                </div>
                                {col.map(ch => {
                                  const allowed = getState(ch.hex)
                                  const modified = !ch.disabled && allowed !== defaultFor(ch.hex)
                                  return (
                                    <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                                      <div className="px-2 py-1 text-[10px] text-blue-600 font-mono text-center">{ch.hex}</div>
                                      <div className="px-2 py-1 text-[10px] text-gray-700 text-center font-medium">{ch.name}</div>
                                      <div className="px-1 py-0.5 text-center">
                                        {ch.disabled
                                          ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full"><option>Disallow</option></select>
                                          : <select value={allowed ? 'allow' : 'disallow'} onChange={e => setState(ch.hex, e.target.value === 'allow')}
                                              className="text-[10px] border border-gray-300 rounded px-1 py-0 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full cursor-pointer">
                                              <option value="allow">Allow</option>
                                              <option value="disallow">Disallow</option>
                                            </select>
                                        }
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GWT Advanced Signature Modal */}
          {gwtSigAdvancedOpen && draft && (() => {
            const sigOverrides = draftOverrides
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={gwtSigFilters[k]} onChange={e => setGwtSigFilters(f => ({ ...f, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${gwtSigFilters[k] !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setGwtSigAdvancedOpen(false)}>
                <div className="bg-white rounded-lg shadow-2xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures</div>
                      <div className="text-xs text-gray-400 mt-0.5">{gwtSigAdvancedSelected.size} selected · {deviceSigs.length} total</div>
                    </div>
                    <button onClick={() => setGwtSigAdvancedOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input autoFocus placeholder="Search by ID or name…" value={gwtSigSearch} onChange={e => setGwtSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {Object.values(gwtSigFilters).some(v => v !== 'all') && (
                      <button onClick={() => setGwtSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>
                    )}
                    <span className="ml-auto text-xs text-gray-400">{gwtAdvSigs.length} shown · {gwtSigAdvancedSelected.size} selected</span>
                    {gwtSigAdvancedSelected.size > 0 && (
                      <button onClick={() => setGwtSigAdvancedSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="px-5 py-8 text-center text-sm text-gray-400">Load signatures via the Signatures tab first.</div>
                      : gwtAdvSigs.map(s => {
                        const sid = String(s.signatureId ?? s.id)
                        const checked = gwtSigAdvancedSelected.has(sid)
                        return (
                          <div key={sid} onClick={() => setGwtSigAdvancedSelected(prev => { const n = new Set(prev); checked ? n.delete(sid) : n.add(sid); return n })}
                            className={`flex items-center gap-3 px-5 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                            <span className="font-mono text-xs text-gray-500 w-20 flex-shrink-0">{sid}</span>
                            <span className="text-xs text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                            {s.accuracy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{s.accuracy}</span>}
                            {s.risk && <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${s.risk === 'high' ? 'bg-red-100 text-red-600' : s.risk === 'medium' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{s.risk}</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                  <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <Btn size="sm" onClick={() => setGwtSigAdvancedOpen(false)}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={() => {
                      const newOverrides = [...gwtSigAdvancedSelected].map(sid => {
                        const existing = sigOverrides.find(o => String(o.signatureId ?? o.id) === sid)
                        return existing || { signatureId: sid, enabled: false }
                      })
                      patchGwt({ signatureOverrides: newOverrides })
                      setGwtSigAdvancedOpen(false)
                    }}>Apply</Btn>
                  </div>
                </div>
              </div>
            )
          })()}
          </>
        )
      })()}

      {/* ── JSON PROFILES ── */}
      {activeTab === 'json' && (() => {
        function openJsonModal(idx) {
          const base = idx === -1
            ? { name: '', description: '', defenseAttributes: { maximumTotalLength: 'any', maximumValueLength: 'any', maximumStructureDepth: 'any', maximumArrayElements: 'any', tolerateParsingWarnings: true, parseParameters: false }, attackSignaturesCheck: true, signatureOverrides: [], valueMetaCharacters: [], valueMasking: [] }
            : JSON.parse(JSON.stringify(jsonProfs[idx]))
          setJsonModalIdx(idx); setJsonModalDraft(base); setJsonSubTab('attack-sigs')
          setJsonSigSearch(''); setJsonSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' }); setJsonSigAdvancedSelected(new Set())
          setJsonNewMaskEl('')
        }
        function closeJsonModal() { setJsonModalIdx(null); setJsonModalDraft(null) }
        function commitJsonModal() {
          setEditedPol(p => {
            const profs = [...(p['json-profiles'] || [])]
            if (jsonModalIdx === -1) profs.push(jsonModalDraft)
            else profs[jsonModalIdx] = jsonModalDraft
            return { ...p, 'json-profiles': profs }
          })
          setUnsaved(true); closeJsonModal()
        }
        function deleteJson(idx) {
          if (!window.confirm(`Delete profile "${jsonProfs[idx].name}"?`)) return
          setEditedPol(p => { const profs = [...(p['json-profiles'] || [])]; profs.splice(idx, 1); return { ...p, 'json-profiles': profs } })
          setUnsaved(true)
        }
        function patchJson(patch) { setJsonModalDraft(d => ({ ...d, ...patch })) }
        function patchJsonAttr(key, val) { setJsonModalDraft(d => ({ ...d, defenseAttributes: { ...(d.defenseAttributes || {}), [key]: val } })) }

        const draft = jsonModalDraft
        const draftAttrs = draft?.defenseAttributes || {}
        const draftOverrides = draft?.signatureOverrides || []
        const jsonAdvSigs = deviceSigs.filter(s => {
          const q = jsonSigSearch.toLowerCase()
          if (q && !String(s.signatureId ?? s.id).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (jsonSigFilters.accuracy !== 'all' && s.accuracy !== jsonSigFilters.accuracy) return false
          if (jsonSigFilters.risk !== 'all' && s.risk !== jsonSigFilters.risk) return false
          if (jsonSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (jsonSigFilters.cve === 'yes')) return false
          return true
        })

        return (
          <>
          <ProfileTable
            title="JSON Profiles" profiles={jsonProfs} cpType="json" urls={urls}
            collapsed={collapsed.json} onToggleCollapse={() => toggleSection('json')}
            onCreate={() => openJsonModal(-1)} onEdit={openJsonModal}
            onChange={arr => setTop('json-profiles', arr)} />

          {/* JSON Profile Modal */}
          {jsonModalIdx !== null && draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeJsonModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {jsonModalIdx === -1 ? 'Create JSON Profile' : `Edit Profile — ${jsonProfs[jsonModalIdx]?.name || ''}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" onClick={closeJsonModal}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={commitJsonModal}>{jsonModalIdx === -1 ? 'Create' : 'Update'}</Btn>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                  {/* Profile Properties */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">Profile Properties</div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0">Profile Name</span>
                        <input className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={draft.name || ''} onChange={e => patchJson({ name: e.target.value })} />
                      </div>
                      <div className="flex items-start px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0 mt-1">Description</span>
                        <textarea rows={2} className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-none"
                          value={draft.description || ''} onChange={e => patchJson({ description: e.target.value })} />
                      </div>
                      {[
                        { label: 'Maximum Total Length Of JSON Data', key: 'maximumTotalLength',  unit: 'bytes' },
                        { label: 'Maximum Value Length',              key: 'maximumValueLength',  unit: 'bytes' },
                        { label: 'Maximum Structure Depth',           key: 'maximumStructureDepth', unit: null  },
                        { label: 'Maximum Array/Object Elements',     key: 'maximumArrayElements',  unit: null  },
                      ].map(({ label, key, unit }) => {
                        const val = draftAttrs[key] ?? 'any'
                        const isAny = val === 'any'
                        return (
                          <div key={key} className="flex items-center px-4 py-2.5 gap-4">
                            <span className="w-56 text-xs text-gray-600 flex-shrink-0">{label}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`json-${key}`} checked={isAny} onChange={() => patchJsonAttr(key, 'any')} /> Any
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`json-${key}`} checked={!isAny} onChange={() => patchJsonAttr(key, 65536)} /> Length:
                              </label>
                              <input type="number" min={1} disabled={isAny}
                                value={isAny ? '' : val}
                                onChange={e => patchJsonAttr(key, Number(e.target.value))}
                                className="w-24 border border-gray-300 rounded px-2 py-0.5 text-xs text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              {unit && <span className="text-gray-500">{unit}</span>}
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0">Tolerate JSON Parsing Warnings</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draftAttrs.tolerateParsingWarnings ?? true}
                            onChange={e => patchJsonAttr('tolerateParsingWarnings', e.target.checked)} /> Enabled
                        </label>
                      </div>
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0">Parse Parameters</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draftAttrs.parseParameters ?? false}
                            onChange={e => patchJsonAttr('parseParameters', e.target.checked)} /> Enabled
                        </label>
                      </div>
                      <div className="flex items-start px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0 mt-1">JSON Schema Files</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">File</span>
                            <input type="file" accept=".json,.schema" className="text-xs" onChange={e => {
                              const f = e.target.files?.[0]; if (!f) return
                              patchJson({ schemaFiles: [...(draft.schemaFiles || []), f.name] }); e.target.value = ''
                            }} />
                          </div>
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="bg-gray-50 px-3 py-1 border-b border-gray-200 text-[11px] font-medium text-gray-500">File Name</div>
                            {(draft.schemaFiles || []).length === 0
                              ? <div className="px-3 py-3 text-center text-xs text-gray-400">No records to display.</div>
                              : (draft.schemaFiles || []).map((f, fi) => (
                                <div key={fi} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 text-xs hover:bg-gray-50">
                                  <span className="text-gray-700 font-mono">{f}</span>
                                  <button onClick={() => patchJson({ schemaFiles: (draft.schemaFiles || []).filter((_,j)=>j!==fi) })} className="text-gray-400 hover:text-red-500">×</button>
                                </div>
                              ))
                            }
                          </div>
                          {(draft.schemaFiles || []).length > 0 && (
                            <button onClick={() => patchJson({ schemaFiles: [] })} className="text-xs mt-1.5 px-2.5 py-0.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Delete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  {!(draftAttrs.parseParameters) && <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                      {[['attack-sigs','Attack Signatures'],['value-meta','Value Meta Characters'],['value-masking','Value Masking']].map(([id, label]) => (
                        <button key={id} onClick={() => setJsonSubTab(id)}
                          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${jsonSubTab===id?'border-blue-500 text-blue-700 bg-white':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {jsonSubTab === 'attack-sigs' && (() => {
                      const sigOverrides = draftOverrides
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={draft.attackSignaturesCheck ?? true}
                              onChange={e => patchJson({ attackSignaturesCheck: e.target.checked })} />
                            Check attack signatures and threat campaigns
                          </label>
                          {(draft.attackSignaturesCheck ?? true) && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 mb-2">Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}</div>
                              {sigOverrides.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {sigOverrides.map((o, oi) => {
                                    const sigId = o.signatureId ?? o.id
                                    const info = deviceSigs.find(s => String(s.signatureId ?? s.id) === String(sigId))
                                    return (
                                      <span key={oi} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700">
                                        <span className="font-mono">{sigId}</span>
                                        {info && <span className="text-gray-400 max-w-32 truncate">{info.name}</span>}
                                        <button onClick={() => patchJson({ signatureOverrides: sigOverrides.filter((_,j) => j !== oi) })} className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              <form onSubmit={e => { e.preventDefault(); const v = e.target.sigId.value.trim(); if (!v || sigOverrides.some(o => String(o.signatureId??o.id)===v)) { e.target.reset(); return }; patchJson({ signatureOverrides: [...sigOverrides, { signatureId: v, enabled: false }] }); e.target.reset() }} className="flex gap-1">
                                <input name="sigId" placeholder="Signature ID…" className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                <button type="button" onClick={() => { setJsonSigAdvancedOpen(true); setJsonSigSearch(''); setJsonSigFilters({ accuracy:'all',risk:'all',cve:'all' }); setJsonSigAdvancedSelected(new Set(sigOverrides.map(o => String(o.signatureId??o.id)))) }}
                                  className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">Advanced</button>
                              </form>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {jsonSubTab === 'value-meta' && (() => {
                      const vmChars = draft.valueMetaCharacters || []
                      const typeDefault = charsetDefaults['json-content'] || {}
                      const defaultFor = (hex) => (hex in typeDefault) ? typeDefault[hex] : (PT_ALL_CHARS.find(c => c.hex === hex)?.defaultAllowed ?? false)
                      function getState(hex) { const e = vmChars.find(c => c.metachar === hex); return e ? e.isAllowed : defaultFor(hex) }
                      function setState(hex, allowed) { const next = vmChars.filter(c => c.metachar !== hex); next.push({ metachar: hex, isAllowed: allowed }); patchJson({ valueMetaCharacters: next }) }
                      const allDisplay = jsonMetaView==='meta-only' ? PT_ALL_CHARS.filter(c=>c.isMeta) : jsonMetaView==='allowed' ? PT_ALL_CHARS.filter(c=>!c.disabled&&getState(c.hex)) : jsonMetaView==='disallowed' ? PT_ALL_CHARS.filter(c=>!c.disabled&&!getState(c.hex)) : PT_ALL_CHARS
                      const colSize = Math.ceil(allDisplay.length / 4)
                      const cols = [0,1,2,3].map(ci => allDisplay.slice(ci*colSize, (ci+1)*colSize))
                      return (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">View</span>
                              <select value={jsonMetaView} onChange={e => setJsonMetaView(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="all">All characters</option>
                                <option value="allowed">Allowed characters</option>
                                <option value="disallowed">Disallowed characters</option>
                                <option value="meta-only">Meta characters only</option>
                              </select>
                            </div>
                            <button className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
                              onClick={() => patchJson({ valueMetaCharacters: [] })}>Restore Defaults</button>
                          </div>
                          <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
                            {cols.map((col, ci) => (
                              <div key={ci} className={`flex-1 ${ci<3?'border-r border-gray-200':''}`}>
                                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                                  {['Hex','Char','State'].map(h => <div key={h} className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">{h}</div>)}
                                </div>
                                {col.map(ch => {
                                  const allowed = getState(ch.hex)
                                  const modified = !ch.disabled && allowed !== defaultFor(ch.hex)
                                  return (
                                    <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                                      <div className="px-2 py-1 text-[10px] text-blue-600 font-mono text-center">{ch.hex}</div>
                                      <div className="px-2 py-1 text-[10px] text-gray-700 text-center font-medium">{ch.name}</div>
                                      <div className="px-1 py-0.5 text-center">
                                        {ch.disabled
                                          ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full"><option>Disallow</option></select>
                                          : <select value={allowed?'allow':'disallow'} onChange={e => setState(ch.hex, e.target.value==='allow')}
                                              className="text-[10px] border border-gray-300 rounded px-1 py-0 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full cursor-pointer">
                                              <option value="allow">Allow</option>
                                              <option value="disallow">Disallow</option>
                                            </select>
                                        }
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {jsonSubTab === 'value-masking' && (() => {
                      const maskEls = draft.valueMasking || []
                      return (
                        <div className="p-4 space-y-3">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Mask Value in Logs</div>
                          <form onSubmit={e => { e.preventDefault(); const v = jsonNewMaskEl.trim(); if (!v || maskEls.includes(v)) return; patchJson({ valueMasking: [...maskEls, v] }); setJsonNewMaskEl('') }} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-32 flex-shrink-0">Element Name:</span>
                            <input value={jsonNewMaskEl} onChange={e => setJsonNewMaskEl(e.target.value)} placeholder="Element name…"
                              className="text-xs border border-gray-300 rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <button type="submit" className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Add</button>
                          </form>
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="overflow-y-auto max-h-40 bg-white">
                              {maskEls.length === 0
                                ? <div className="px-3 py-4 text-center text-xs text-gray-400">No elements configured.</div>
                                : maskEls.map((v, vi) => (
                                  <div key={vi} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 text-xs hover:bg-gray-50">
                                    <span className="text-gray-700 font-mono">{v}</span>
                                    <button onClick={() => patchJson({ valueMasking: maskEls.filter((_,j)=>j!==vi) })} className="text-gray-400 hover:text-red-500">×</button>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                          {maskEls.length > 0 && <button onClick={() => patchJson({ valueMasking: [] })} className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Delete All</button>}
                        </div>
                      )
                    })()}
                  </div>}
                </div>
              </div>
            </div>
          )}

          {/* JSON Advanced Signature Modal */}
          {jsonSigAdvancedOpen && draft && (() => {
            const sigOverrides = draftOverrides
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={jsonSigFilters[k]} onChange={e => setJsonSigFilters(f => ({ ...f, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${jsonSigFilters[k]!=='all'?'border-blue-400 bg-blue-50 text-blue-700 font-medium':'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setJsonSigAdvancedOpen(false)}>
                <div className="bg-white rounded-lg shadow-2xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures</div>
                      <div className="text-xs text-gray-400 mt-0.5">{jsonSigAdvancedSelected.size} selected · {deviceSigs.length} total</div>
                    </div>
                    <button onClick={() => setJsonSigAdvancedOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input autoFocus placeholder="Search by ID or name…" value={jsonSigSearch} onChange={e => setJsonSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {Object.values(jsonSigFilters).some(v => v !== 'all') && <button onClick={() => setJsonSigFilters({ accuracy:'all',risk:'all',cve:'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                    <span className="ml-auto text-xs text-gray-400">{jsonAdvSigs.length} shown · {jsonSigAdvancedSelected.size} selected</span>
                    {jsonSigAdvancedSelected.size > 0 && <button onClick={() => setJsonSigAdvancedSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="px-5 py-8 text-center text-sm text-gray-400">Load signatures via the Signatures tab first.</div>
                      : jsonAdvSigs.map(s => {
                        const sid = String(s.signatureId ?? s.id)
                        const checked = jsonSigAdvancedSelected.has(sid)
                        return (
                          <div key={sid} onClick={() => setJsonSigAdvancedSelected(prev => { const n = new Set(prev); checked ? n.delete(sid) : n.add(sid); return n })}
                            className={`flex items-center gap-3 px-5 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${checked?'bg-blue-50':''}`}>
                            <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                            <span className="font-mono text-xs text-gray-500 w-20 flex-shrink-0">{sid}</span>
                            <span className="text-xs text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                            {s.accuracy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{s.accuracy}</span>}
                            {s.risk && <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${s.risk==='high'?'bg-red-100 text-red-600':s.risk==='medium'?'bg-orange-100 text-orange-600':'bg-gray-100 text-gray-500'}`}>{s.risk}</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                  <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <Btn size="sm" onClick={() => setJsonSigAdvancedOpen(false)}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={() => {
                      const newOverrides = [...jsonSigAdvancedSelected].map(sid => { const ex = sigOverrides.find(o => String(o.signatureId??o.id)===sid); return ex || { signatureId: sid, enabled: false } })
                      patchJson({ signatureOverrides: newOverrides }); setJsonSigAdvancedOpen(false)
                    }}>Apply</Btn>
                  </div>
                </div>
              </div>
            )
          })()}
          </>
        )
      })()}

      {/* ── XML PROFILES ── */}
      {activeTab === 'xml' && (() => {
        const XML_DEF_DEFENSE = { defenseLevel: 'medium', ...XML_DEFENSE_PRESETS.medium }

        function openXmlModal(idx) {
          const base = idx === -1
            ? { name: '', description: '', useXmlBlockingResponsePage: true, validationConfig: { configFiles: [], followSchemaLinks: false, allowAttachmentsInSoap: false, inspectSoapAttachments: false }, defenseConfig: { defenseLevel: 'medium', ...XML_DEFENSE_PRESETS.medium }, attackSignaturesCheck: true, signatureOverrides: [], elementMetaChars: { enabled: false }, attributeMetaChars: { enabled: false }, metaCharacters: [], valueMasking: [] }
            : JSON.parse(JSON.stringify(xmlProfs[idx]))
          setXmlModalIdx(idx); setXmlModalDraft(base); setXmlSubTab('firewall-config')
          setXmlSigSearch(''); setXmlSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' }); setXmlSigAdvancedSelected(new Set())
          setXmlElemMetaView('meta-only'); setXmlAttrMetaView('meta-only')
          setXmlMaskNs('any'); setXmlMaskNsCustom(''); setXmlMaskNameType('element'); setXmlMaskNameValue('')
        }
        function closeXmlModal() { setXmlModalIdx(null); setXmlModalDraft(null) }
        function commitXmlModal() {
          setEditedPol(p => {
            const profs = [...(p['xml-profiles'] || [])]
            if (xmlModalIdx === -1) profs.push(xmlModalDraft)
            else profs[xmlModalIdx] = xmlModalDraft
            return { ...p, 'xml-profiles': profs }
          })
          setUnsaved(true); closeXmlModal()
        }
        function deleteXml(idx) {
          if (!window.confirm(`Delete profile "${xmlProfs[idx].name}"?`)) return
          setEditedPol(p => { const profs = [...(p['xml-profiles'] || [])]; profs.splice(idx, 1); return { ...p, 'xml-profiles': profs } })
          setUnsaved(true)
        }
        function patchXml(patch) { setXmlModalDraft(d => ({ ...d, ...patch })) }
        function patchValidation(patch) { setXmlModalDraft(d => ({ ...d, validationConfig: { ...(d.validationConfig || {}), ...patch } })) }
        function patchDefense(patch) { setXmlModalDraft(d => ({ ...d, defenseConfig: { ...(d.defenseConfig || {}), ...patch } })) }
        function applyDefenseLevel(level) {
          if (level === 'custom') { patchDefense({ defenseLevel: 'custom' }); return }
          patchDefense({ defenseLevel: level, ...XML_DEFENSE_PRESETS[level] })
        }

        const draft = xmlModalDraft
        const dc = draft?.defenseConfig || {}
        const vc = draft?.validationConfig || {}
        const draftOverrides = draft?.signatureOverrides || []
        const xmlAdvSigs = deviceSigs.filter(s => {
          const q = xmlSigSearch.toLowerCase()
          if (q && !String(s.signatureId ?? s.id).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (xmlSigFilters.accuracy !== 'all' && s.accuracy !== xmlSigFilters.accuracy) return false
          if (xmlSigFilters.risk !== 'all' && s.risk !== xmlSigFilters.risk) return false
          if (xmlSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (xmlSigFilters.cve === 'yes')) return false
          return true
        })

        function XmlMetaGrid({ characters, onSetChar, view, setView }) {
          const typeDefault = charsetDefaults['xml-content'] || {}
          const defaultFor = (hex) => (hex in typeDefault) ? typeDefault[hex] : (PT_ALL_CHARS.find(c => c.hex === hex)?.defaultAllowed ?? false)
          function getState(hex) { const e = characters.find(c => c.metachar === hex); return e ? e.isAllowed : defaultFor(hex) }
          function setState(hex, allowed) { const next = characters.filter(c => c.metachar !== hex); next.push({ metachar: hex, isAllowed: allowed }); onSetChar(next) }
          const allDisplay = view==='meta-only' ? PT_ALL_CHARS.filter(c=>c.isMeta) : view==='allowed' ? PT_ALL_CHARS.filter(c=>!c.disabled&&getState(c.hex)) : view==='disallowed' ? PT_ALL_CHARS.filter(c=>!c.disabled&&!getState(c.hex)) : PT_ALL_CHARS
          const colSize = Math.ceil(allDisplay.length / 4)
          const cols = [0,1,2,3].map(ci => allDisplay.slice(ci*colSize, (ci+1)*colSize))
          return (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">View</span>
                  <select value={view} onChange={e => setView(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                    <option value="all">All characters</option>
                    <option value="allowed">Allowed characters</option>
                    <option value="disallowed">Disallowed characters</option>
                    <option value="meta-only">Meta characters only</option>
                  </select>
                </div>
                <button className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
                  onClick={() => onSetChar([])}>Restore Defaults</button>
              </div>
              <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
                {cols.map((col, ci) => (
                  <div key={ci} className={`flex-1 ${ci<3?'border-r border-gray-200':''}`}>
                    <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                      {['Hex','Char','State'].map(h => <div key={h} className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">{h}</div>)}
                    </div>
                    {col.map(ch => {
                      const allowed = getState(ch.hex)
                      const modified = !ch.disabled && allowed !== defaultFor(ch.hex)
                      return (
                        <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                          <div className="px-2 py-1 text-[10px] text-blue-600 font-mono text-center">{ch.hex}</div>
                          <div className="px-2 py-1 text-[10px] text-gray-700 text-center font-medium">{ch.name}</div>
                          <div className="px-1 py-0.5 text-center">
                            {ch.disabled
                              ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full"><option>Disallow</option></select>
                              : <select value={allowed?'allow':'disallow'} onChange={e => setState(ch.hex, e.target.value==='allow')}
                                  className="text-[10px] border border-gray-300 rounded px-1 py-0 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full cursor-pointer">
                                  <option value="allow">Allow</option>
                                  <option value="disallow">Disallow</option>
                                </select>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
          <>
          <ProfileTable
            title="XML Profiles" profiles={xmlProfs} cpType="xml" urls={urls}
            collapsed={collapsed.xml} onToggleCollapse={() => toggleSection('xml')}
            onCreate={() => openXmlModal(-1)} onEdit={openXmlModal}
            onChange={arr => setTop('xml-profiles', arr)} />

          {/* XML Profile Modal */}
          {xmlModalIdx !== null && draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeXmlModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {xmlModalIdx === -1 ? 'Create XML Profile' : `Edit Profile — ${xmlProfs[xmlModalIdx]?.name || ''}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" onClick={closeXmlModal}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={commitXmlModal}>{xmlModalIdx === -1 ? 'Create' : 'Update'}</Btn>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                  {/* Profile Properties */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">Profile Properties</div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0">Profile Name</span>
                        <input className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={draft.name || ''} onChange={e => patchXml({ name: e.target.value })} />
                      </div>
                      <div className="flex items-start px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0 mt-1">Description</span>
                        <textarea rows={2} className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-none"
                          value={draft.description || ''} onChange={e => patchXml({ description: e.target.value })} />
                      </div>
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-56 text-xs text-gray-600 flex-shrink-0">Use XML Blocking Response Page</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draft.useXmlBlockingResponsePage ?? true}
                            onChange={e => patchXml({ useXmlBlockingResponsePage: e.target.checked })} /> Enabled
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                      {[['firewall-config','XML Firewall Configuration'],['attack-sigs','Attack Signatures'],['meta-chars','Meta Characters'],['value-masking','Value Masking']].map(([id, label]) => (
                        <button key={id} onClick={() => setXmlSubTab(id)}
                          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${xmlSubTab===id?'border-blue-500 text-blue-700 bg-white':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* ── XML Firewall Configuration ── */}
                    {xmlSubTab === 'firewall-config' && (
                      <div className="p-4 space-y-5">
                        {/* Validation Configuration */}
                        <div>
                          <div className="text-xs font-semibold text-gray-800 mb-3">Validation Configuration</div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                            {/* Configuration Files */}
                            <div className="flex items-start px-4 py-3 gap-4">
                              <span className="w-44 text-xs text-gray-600 flex-shrink-0 mt-1">Configuration Files</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-gray-500">File</span>
                                  <input type="file" accept=".xsd,.wsdl,.xml" className="text-xs" onChange={e => {
                                    const f = e.target.files?.[0]; if (!f) return
                                    patchValidation({ configFiles: [...(vc.configFiles || []), { fileName: f.name, importUrl: '' }] }); e.target.value = ''
                                  }} />
                                </div>
                                <div className="border border-gray-200 rounded overflow-hidden">
                                  <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
                                    <div className="px-3 py-1 text-[11px] font-medium text-gray-500">File Name</div>
                                    <div className="px-3 py-1 text-[11px] font-medium text-gray-500">Import URL</div>
                                  </div>
                                  {(vc.configFiles || []).length === 0
                                    ? <div className="px-3 py-3 text-center text-xs text-gray-400">No records to display.</div>
                                    : (vc.configFiles || []).map((f, fi) => (
                                      <div key={fi} className="grid grid-cols-2 border-b border-gray-50 hover:bg-gray-50 text-xs">
                                        <div className="px-3 py-1.5 text-gray-700 font-mono flex items-center gap-1">
                                          {f.fileName}
                                          <button onClick={() => patchValidation({ configFiles: (vc.configFiles||[]).filter((_,j)=>j!==fi) })} className="text-gray-300 hover:text-red-500 ml-auto">×</button>
                                        </div>
                                        <div className="px-3 py-1.5">
                                          <input value={f.importUrl || ''} placeholder="URL…"
                                            onChange={e => { const arr=[...(vc.configFiles||[])]; arr[fi]={...arr[fi],importUrl:e.target.value}; patchValidation({configFiles:arr}) }}
                                            className="text-xs w-full border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                        </div>
                                      </div>
                                    ))
                                  }
                                </div>
                                {(vc.configFiles || []).length > 0 && (
                                  <button onClick={() => patchValidation({ configFiles: [] })} className="text-xs mt-1.5 px-2.5 py-0.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Delete</button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center px-4 py-2.5 gap-4">
                              <span className="w-44 text-xs text-gray-600 flex-shrink-0">Follow Schema Links</span>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" checked={vc.followSchemaLinks ?? false} onChange={e => patchValidation({ followSchemaLinks: e.target.checked })} /> Enabled
                              </label>
                            </div>
                            <div className="flex items-center px-4 py-2.5 gap-4">
                              <span className="w-44 text-xs text-gray-600 flex-shrink-0">Allow Attachments in SOAP Messages</span>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" checked={vc.allowAttachmentsInSoap ?? false} onChange={e => patchValidation({ allowAttachmentsInSoap: e.target.checked })} /> Enabled
                              </label>
                            </div>
                            {vc.allowAttachmentsInSoap && (
                              <div className="flex items-center px-4 py-2.5 gap-4">
                                <span className="w-44 text-xs text-gray-600 flex-shrink-0">Inspect SOAP Attachments</span>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input type="checkbox" checked={vc.inspectSoapAttachments ?? false} onChange={e => patchValidation({ inspectSoapAttachments: e.target.checked })} /> Enabled
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Defense Configuration */}
                        <div>
                          <div className="text-xs font-semibold text-gray-800 mb-3">Defense Configuration</div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                            {/* Defense Level */}
                            <div className="flex items-center px-4 py-2.5 gap-4">
                              <span className="w-56 text-xs text-gray-600 flex-shrink-0">Defense Level</span>
                              <select value={dc.defenseLevel || 'medium'} onChange={e => applyDefenseLevel(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>
                            {/* Checkboxes */}
                            {[
                              { label: 'Allow DTDs',                       key: 'allowDTDs' },
                              { label: 'Allow External References',        key: 'allowExternalRefs' },
                              { label: 'Tolerate Leading White Space',     key: 'tolerateLeadingWS' },
                              { label: 'Tolerate Close Tag Shorthand',     key: 'tolerateCloseTagShorthand' },
                              { label: 'Tolerate Numeric Names',           key: 'tolerateNumericNames' },
                              { label: 'Allow Processing Instructions',    key: 'allowProcessingInstructions' },
                              { label: 'Allow CDATA',                      key: 'allowCDATA' },
                            ].map(({ label, key }) => (
                              <div key={key} className="flex items-center px-4 py-2 gap-4">
                                <span className="w-56 text-xs text-gray-600 flex-shrink-0">{label}</span>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input type="checkbox" checked={dc[key] ?? false}
                                    onChange={e => patchDefense({ defenseLevel: 'custom', [key]: e.target.checked })} /> Enabled
                                </label>
                              </div>
                            ))}
                            {/* Any/Maximum fields */}
                            {[
                              { label: 'Maximum Document Size',        key: 'maxDocSize',            unit: 'bytes' },
                              { label: 'Maximum Elements',             key: 'maxElements',            unit: null    },
                              { label: 'Maximum Name Length',          key: 'maxNameLength',          unit: 'bytes' },
                              { label: 'Maximum Attribute Value Length', key: 'maxAttrValueLength',  unit: 'bytes' },
                              { label: 'Maximum Document Depth',       key: 'maxDocDepth',            unit: null    },
                              { label: 'Maximum Children Per Element', key: 'maxChildrenPerElement',  unit: null    },
                              { label: 'Maximum Attributes Per Element', key: 'maxAttrsPerElement',  unit: null    },
                              { label: 'Maximum NS Declarations',      key: 'maxNsDeclarations',      unit: null    },
                              { label: 'Maximum Namespace Length',     key: 'maxNamespaceLength',     unit: 'bytes' },
                            ].map(({ label, key, unit }) => {
                              const val = dc[key] ?? 'any'
                              const isAny = val === 'any'
                              const defaultMax = { maxDocSize: 1024000, maxElements: 65536, maxNameLength: 256, maxAttrValueLength: 1024, maxDocDepth: 32, maxChildrenPerElement: 1024, maxAttrsPerElement: 16, maxNsDeclarations: 64, maxNamespaceLength: 256 }[key]
                              return (
                                <div key={key} className="flex items-center px-4 py-2 gap-4">
                                  <span className="w-56 text-xs text-gray-600 flex-shrink-0">{label}</span>
                                  <div className="flex items-center gap-3 text-xs">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name={`xml-${key}`} checked={isAny} onChange={() => patchDefense({ defenseLevel: 'custom', [key]: 'any' })} /> Any
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input type="radio" name={`xml-${key}`} checked={!isAny} onChange={() => patchDefense({ defenseLevel: 'custom', [key]: defaultMax })} /> Maximum
                                    </label>
                                    <input type="number" min={1} disabled={isAny}
                                      value={isAny ? '' : val}
                                      onChange={e => patchDefense({ defenseLevel: 'custom', [key]: Number(e.target.value) })}
                                      className="w-28 border border-gray-300 rounded px-2 py-0.5 text-xs text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    {unit && <span className="text-gray-500">{unit}</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Attack Signatures ── */}
                    {xmlSubTab === 'attack-sigs' && (() => {
                      const sigOverrides = draftOverrides
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={draft.attackSignaturesCheck ?? true}
                              onChange={e => patchXml({ attackSignaturesCheck: e.target.checked })} />
                            Check attack signatures and threat campaigns
                          </label>
                          {(draft.attackSignaturesCheck ?? true) && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 mb-2">Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}</div>
                              {sigOverrides.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {sigOverrides.map((o, oi) => {
                                    const sigId = o.signatureId ?? o.id
                                    const info = deviceSigs.find(s => String(s.signatureId ?? s.id) === String(sigId))
                                    return (
                                      <span key={oi} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700">
                                        <span className="font-mono">{sigId}</span>
                                        {info && <span className="text-gray-400 max-w-32 truncate">{info.name}</span>}
                                        <button onClick={() => patchXml({ signatureOverrides: sigOverrides.filter((_,j) => j !== oi) })} className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              <form onSubmit={e => { e.preventDefault(); const v = e.target.sigId.value.trim(); if (!v || sigOverrides.some(o => String(o.signatureId??o.id)===v)) { e.target.reset(); return }; patchXml({ signatureOverrides: [...sigOverrides, { signatureId: v, enabled: false }] }); e.target.reset() }} className="flex gap-1">
                                <input name="sigId" placeholder="Signature ID…" className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                <button type="button" onClick={() => { setXmlSigAdvancedOpen(true); setXmlSigSearch(''); setXmlSigFilters({ accuracy:'all',risk:'all',cve:'all' }); setXmlSigAdvancedSelected(new Set(sigOverrides.map(o => String(o.signatureId??o.id)))) }}
                                  className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">Advanced</button>
                              </form>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* ── Meta Characters ── */}
                    {xmlSubTab === 'meta-chars' && (() => {
                      const sharedChars = draft.metaCharacters || []
                      const elemEnabled = draft.elementMetaChars?.enabled ?? false
                      const attrEnabled = draft.attributeMetaChars?.enabled ?? false
                      const showGrid = elemEnabled || attrEnabled
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={elemEnabled}
                              onChange={e => patchXml({ elementMetaChars: { ...(draft.elementMetaChars||{}), enabled: e.target.checked } })} />
                            Check element value characters
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={attrEnabled}
                              onChange={e => patchXml({ attributeMetaChars: { ...(draft.attributeMetaChars||{}), enabled: e.target.checked } })} />
                            Check attribute value characters
                          </label>
                          {showGrid && (
                            <div className="mt-2">
                              <XmlMetaGrid
                                characters={sharedChars}
                                onSetChar={chars => patchXml({ metaCharacters: chars })}
                                view={xmlElemMetaView} setView={setXmlElemMetaView}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* ── Value Masking ── */}
                    {xmlSubTab === 'value-masking' && (() => {
                      const maskItems = draft.valueMasking || []
                      const nsLabel = xmlMaskNs === 'any' ? 'Any Namespace' : xmlMaskNs === 'none' ? 'No Namespace' : (xmlMaskNsCustom || 'Custom')
                      return (
                        <div className="p-4 space-y-3">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Mask Value in Logs</div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                            <div className="flex items-center px-4 py-2.5 gap-4">
                              <span className="w-32 text-xs text-gray-600 flex-shrink-0">Namespace</span>
                              <div className="flex items-center gap-2">
                                <select value={xmlMaskNs} onChange={e => setXmlMaskNs(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                  <option value="any">Any Namespace</option>
                                  <option value="custom">Custom</option>
                                  <option value="none">No Namespace</option>
                                </select>
                                {xmlMaskNs === 'custom' && (
                                  <input value={xmlMaskNsCustom} onChange={e => setXmlMaskNsCustom(e.target.value)} placeholder="Namespace URI…"
                                    className="text-xs border border-gray-300 rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center px-4 py-2.5 gap-4">
                              <span className="w-32 text-xs text-gray-600 flex-shrink-0">Name</span>
                              <div className="flex items-center gap-2">
                                <select value={xmlMaskNameType} onChange={e => setXmlMaskNameType(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                  <option value="element">Element</option>
                                  <option value="attribute">Attribute</option>
                                </select>
                                <input value={xmlMaskNameValue} onChange={e => setXmlMaskNameValue(e.target.value)} placeholder="Name…"
                                  className="text-xs border border-gray-300 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.form?.requestSubmit() }} />
                              </div>
                            </div>
                            <div className="px-4 py-2">
                              <button onClick={() => {
                                const name = xmlMaskNameValue.trim(); if (!name) return
                                const ns = xmlMaskNs === 'custom' ? (xmlMaskNsCustom.trim() || 'Custom') : xmlMaskNs === 'none' ? 'No Namespace' : 'Any Namespace'
                                patchXml({ valueMasking: [...maskItems, { namespace: ns, name, type: xmlMaskNameType === 'element' ? 'Element' : 'Attribute' }] })
                                setXmlMaskNameValue('')
                              }} className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Add</button>
                            </div>
                          </div>
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                              {['Namespace','Name','Type'].map(h => <div key={h} className="px-3 py-1.5 text-[11px] font-medium text-gray-500">{h}</div>)}
                            </div>
                            <div className="overflow-y-auto max-h-40 bg-white">
                              {maskItems.length === 0
                                ? <div className="px-3 py-4 text-center text-xs text-gray-400">No records to display.</div>
                                : maskItems.map((item, ii) => (
                                  <div key={ii} className="grid grid-cols-3 border-b border-gray-50 hover:bg-gray-50 text-xs">
                                    <div className="px-3 py-1.5 text-gray-700">{item.namespace}</div>
                                    <div className="px-3 py-1.5 text-blue-600 font-mono">{item.name}</div>
                                    <div className="px-3 py-1.5 text-gray-600 flex items-center justify-between">
                                      {item.type}
                                      <button onClick={() => patchXml({ valueMasking: maskItems.filter((_,j)=>j!==ii) })} className="text-gray-300 hover:text-red-500 ml-2">×</button>
                                    </div>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                          {maskItems.length > 0 && (
                            <button onClick={() => patchXml({ valueMasking: [] })} className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Delete</button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* XML Advanced Signature Modal */}
          {xmlSigAdvancedOpen && draft && (() => {
            const sigOverrides = draftOverrides
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={xmlSigFilters[k]} onChange={e => setXmlSigFilters(f => ({ ...f, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${xmlSigFilters[k]!=='all'?'border-blue-400 bg-blue-50 text-blue-700 font-medium':'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setXmlSigAdvancedOpen(false)}>
                <div className="bg-white rounded-lg shadow-2xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures</div>
                      <div className="text-xs text-gray-400 mt-0.5">{xmlSigAdvancedSelected.size} selected · {deviceSigs.length} total</div>
                    </div>
                    <button onClick={() => setXmlSigAdvancedOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input autoFocus placeholder="Search by ID or name…" value={xmlSigSearch} onChange={e => setXmlSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {Object.values(xmlSigFilters).some(v => v !== 'all') && <button onClick={() => setXmlSigFilters({ accuracy:'all',risk:'all',cve:'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                    <span className="ml-auto text-xs text-gray-400">{xmlAdvSigs.length} shown · {xmlSigAdvancedSelected.size} selected</span>
                    {xmlSigAdvancedSelected.size > 0 && <button onClick={() => setXmlSigAdvancedSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="px-5 py-8 text-center text-sm text-gray-400">Load signatures via the Signatures tab first.</div>
                      : xmlAdvSigs.map(s => {
                        const sid = String(s.signatureId ?? s.id)
                        const checked = xmlSigAdvancedSelected.has(sid)
                        return (
                          <div key={sid} onClick={() => setXmlSigAdvancedSelected(prev => { const n = new Set(prev); checked ? n.delete(sid) : n.add(sid); return n })}
                            className={`flex items-center gap-3 px-5 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${checked?'bg-blue-50':''}`}>
                            <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                            <span className="font-mono text-xs text-gray-500 w-20 flex-shrink-0">{sid}</span>
                            <span className="text-xs text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                            {s.accuracy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{s.accuracy}</span>}
                            {s.risk && <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${s.risk==='high'?'bg-red-100 text-red-600':s.risk==='medium'?'bg-orange-100 text-orange-600':'bg-gray-100 text-gray-500'}`}>{s.risk}</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                  <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <Btn size="sm" onClick={() => setXmlSigAdvancedOpen(false)}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={() => {
                      const newOverrides = [...xmlSigAdvancedSelected].map(sid => { const ex = sigOverrides.find(o => String(o.signatureId??o.id)===sid); return ex || { signatureId: sid, enabled: false } })
                      patchXml({ signatureOverrides: newOverrides }); setXmlSigAdvancedOpen(false)
                    }}>Apply</Btn>
                  </div>
                </div>
              </div>
            )
          })()}
          </>
        )
      })()}

      {/* ── GRAPHQL PROFILES ── */}
      {activeTab === 'graphql' && (() => {
        function openGqlModal(idx) {
          const base = idx === -1
            ? { name: '', description: '', defenseAttributes: { maximumTotalLength: 'any', maximumValueLength: 'any', maximumStructureDepth: 'any', maximumBatchedQueries: 'any', tolerateParsingWarnings: true, allowIntrospectionQueries: false, maximumQueryCost: 100000 }, attackSignaturesCheck: true, signatureOverrides: [], valueMetaCharacters: [], valueMasking: [], blockErrorResponses: { enabled: false, customPatterns: [] } }
            : JSON.parse(JSON.stringify(graphqlProfs[idx]))
          setGqlModalIdx(idx); setGqlModalDraft(base); setGqlSubTab('attack-sigs')
          setGqlSigSearch(''); setGqlSigFilters({ accuracy: 'all', risk: 'all', cve: 'all' }); setGqlSigAdvancedSelected(new Set())
          setGqlNewPattern(''); setGqlNewMaskVar('')
        }
        function closeGqlModal() { setGqlModalIdx(null); setGqlModalDraft(null) }
        function commitGqlModal() {
          setEditedPol(p => {
            const profs = [...(p['graphql-profiles'] || [])]
            if (gqlModalIdx === -1) profs.push(gqlModalDraft)
            else profs[gqlModalIdx] = gqlModalDraft
            return { ...p, 'graphql-profiles': profs }
          })
          setUnsaved(true); closeGqlModal()
        }
        function deleteGql(idx) {
          if (!window.confirm(`Delete profile "${graphqlProfs[idx].name}"?`)) return
          setEditedPol(p => { const profs = [...(p['graphql-profiles'] || [])]; profs.splice(idx, 1); return { ...p, 'graphql-profiles': profs } })
          setUnsaved(true)
        }
        function patchGql(patch) { setGqlModalDraft(d => ({ ...d, ...patch })) }
        function patchGqlAttr(key, val) { setGqlModalDraft(d => ({ ...d, defenseAttributes: { ...(d.defenseAttributes || {}), [key]: val } })) }

        const draft = gqlModalDraft
        const draftAttrs = draft?.defenseAttributes || {}
        const draftOverrides = draft?.signatureOverrides || []
        const gqlAdvSigs = deviceSigs.filter(s => {
          const q = gqlSigSearch.toLowerCase()
          if (q && !String(s.signatureId ?? s.id).includes(q) && !(s.name || '').toLowerCase().includes(q)) return false
          if (gqlSigFilters.accuracy !== 'all' && s.accuracy !== gqlSigFilters.accuracy) return false
          if (gqlSigFilters.risk !== 'all' && s.risk !== gqlSigFilters.risk) return false
          if (gqlSigFilters.cve !== 'all' && Boolean(s.hasCve) !== (gqlSigFilters.cve === 'yes')) return false
          return true
        })

        return (
          <>
          <ProfileTable
            title="GraphQL Profiles" profiles={graphqlProfs} cpType="graphql" urls={urls}
            collapsed={collapsed.graphql} onToggleCollapse={() => toggleSection('graphql')}
            onCreate={() => openGqlModal(-1)} onEdit={openGqlModal}
            onChange={arr => setTop('graphql-profiles', arr)} />

          {/* GraphQL Profile Modal */}
          {gqlModalIdx !== null && draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeGqlModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {gqlModalIdx === -1 ? 'Create GraphQL Profile' : `Edit Profile — ${graphqlProfs[gqlModalIdx]?.name || ''}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" onClick={closeGqlModal}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={commitGqlModal}>{gqlModalIdx === -1 ? 'Create' : 'Update'}</Btn>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                  {/* Profile Properties */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">Profile Properties</div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0">Profile Name</span>
                        <input className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={draft.name || ''} onChange={e => patchGql({ name: e.target.value })} />
                      </div>
                      <div className="flex items-start px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0 mt-1">Description</span>
                        <textarea rows={2} className="border border-gray-300 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-none"
                          value={draft.description || ''} onChange={e => patchGql({ description: e.target.value })} />
                      </div>
                      {[
                        { label: 'Maximum Total Length',      key: 'maximumTotalLength',      unit: 'bytes', type: 'length' },
                        { label: 'Maximum Value Length',      key: 'maximumValueLength',      unit: 'bytes', type: 'length' },
                        { label: 'Maximum Structure Depth',   key: 'maximumStructureDepth',   unit: null,    type: 'value'  },
                        { label: 'Maximum Batched Queries',   key: 'maximumBatchedQueries',   unit: null,    type: 'value'  },
                      ].map(({ label, key, unit, type }) => {
                        const val = draftAttrs[key] ?? 'any'
                        const isAny = val === 'any'
                        return (
                          <div key={key} className="flex items-center px-4 py-2.5 gap-4">
                            <span className="w-52 text-xs text-gray-600 flex-shrink-0">{label}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`gql-${key}`} checked={isAny} onChange={() => patchGqlAttr(key, 'any')} /> Any
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`gql-${key}`} checked={!isAny} onChange={() => patchGqlAttr(key, type === 'length' ? 65536 : 10)} />
                                {type === 'length' ? 'Length:' : 'Value:'}
                              </label>
                              <input type="number" min={1} disabled={isAny}
                                value={isAny ? '' : val}
                                onChange={e => patchGqlAttr(key, Number(e.target.value))}
                                className="w-24 border border-gray-300 rounded px-2 py-0.5 text-xs text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              {unit && <span className="text-gray-500">{unit}</span>}
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0">Tolerate Parsing Warnings</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draftAttrs.tolerateParsingWarnings ?? true}
                            onChange={e => patchGqlAttr('tolerateParsingWarnings', e.target.checked)} /> Enabled
                        </label>
                      </div>
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0">Allow Introspection Queries</span>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={draftAttrs.allowIntrospectionQueries ?? false}
                            onChange={e => patchGqlAttr('allowIntrospectionQueries', e.target.checked)} /> Enabled
                        </label>
                      </div>
                      <div className="flex items-center px-4 py-2.5 gap-4">
                        <span className="w-52 text-xs text-gray-600 flex-shrink-0">Maximum Query Cost</span>
                        <div className="flex items-center gap-3 text-xs">
                          {(() => { const val = draftAttrs.maximumQueryCost ?? 100000; const isAny = val === 'any'; return (<>
                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="gql-mqc" checked={isAny} onChange={() => patchGqlAttr('maximumQueryCost','any')} /> Any</label>
                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="gql-mqc" checked={!isAny} onChange={() => patchGqlAttr('maximumQueryCost',100000)} /> Value:</label>
                            <input type="number" min={1} disabled={isAny} value={isAny?'':val} onChange={e=>patchGqlAttr('maximumQueryCost',Number(e.target.value))}
                              className="w-24 border border-gray-300 rounded px-2 py-0.5 text-xs text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </>)})()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex border-b border-gray-200 bg-gray-50">
                      {[['attack-sigs','Attack Signatures'],['value-meta','Value Meta Characters'],['value-masking','Value Masking'],['block-errors','Block Error Responses']].map(([id, label]) => (
                        <button key={id} onClick={() => setGqlSubTab(id)}
                          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${gqlSubTab===id?'border-blue-500 text-blue-700 bg-white':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {gqlSubTab === 'attack-sigs' && (() => {
                      const sigOverrides = draftOverrides
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={draft.attackSignaturesCheck ?? true}
                              onChange={e => patchGql({ attackSignaturesCheck: e.target.checked })} />
                            Check attack signatures and threat campaigns
                          </label>
                          {(draft.attackSignaturesCheck ?? true) && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 mb-2">Excluded signatures {sigOverrides.length > 0 && <span className="text-gray-400 font-normal">({sigOverrides.length})</span>}</div>
                              {sigOverrides.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {sigOverrides.map((o, oi) => {
                                    const sigId = o.signatureId ?? o.id
                                    const info = deviceSigs.find(s => String(s.signatureId ?? s.id) === String(sigId))
                                    return (
                                      <span key={oi} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700">
                                        <span className="font-mono">{sigId}</span>
                                        {info && <span className="text-gray-400 max-w-32 truncate">{info.name}</span>}
                                        <button onClick={() => patchGql({ signatureOverrides: sigOverrides.filter((_,j) => j !== oi) })} className="text-gray-400 hover:text-red-500 leading-none ml-0.5">×</button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              <form onSubmit={e => { e.preventDefault(); const v = e.target.sigId.value.trim(); if (!v || sigOverrides.some(o => String(o.signatureId??o.id)===v)) { e.target.reset(); return }; patchGql({ signatureOverrides: [...sigOverrides, { signatureId: v, enabled: false }] }); e.target.reset() }} className="flex gap-1">
                                <input name="sigId" placeholder="Signature ID…" className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                <button type="submit" className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Add</button>
                                <button type="button" onClick={() => { setGqlSigAdvancedOpen(true); setGqlSigSearch(''); setGqlSigFilters({ accuracy:'all',risk:'all',cve:'all' }); setGqlSigAdvancedSelected(new Set(sigOverrides.map(o => String(o.signatureId??o.id)))) }}
                                  className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 bg-white hover:bg-blue-50">Advanced</button>
                              </form>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {gqlSubTab === 'value-meta' && (() => {
                      const vmChars = draft.valueMetaCharacters || []
                      const typeDefault = charsetDefaults['json-content'] || {}
                      const defaultFor = (hex) => (hex in typeDefault) ? typeDefault[hex] : (PT_ALL_CHARS.find(c => c.hex === hex)?.defaultAllowed ?? false)
                      function getState(hex) { const e = vmChars.find(c => c.metachar === hex); return e ? e.isAllowed : defaultFor(hex) }
                      function setState(hex, allowed) { const next = vmChars.filter(c => c.metachar !== hex); next.push({ metachar: hex, isAllowed: allowed }); patchGql({ valueMetaCharacters: next }) }
                      const allDisplay = gqlMetaView==='meta-only' ? PT_ALL_CHARS.filter(c=>c.isMeta) : gqlMetaView==='allowed' ? PT_ALL_CHARS.filter(c=>!c.disabled&&getState(c.hex)) : gqlMetaView==='disallowed' ? PT_ALL_CHARS.filter(c=>!c.disabled&&!getState(c.hex)) : PT_ALL_CHARS
                      const colSize = Math.ceil(allDisplay.length / 4)
                      const cols = [0,1,2,3].map(ci => allDisplay.slice(ci*colSize, (ci+1)*colSize))
                      return (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">View</span>
                              <select value={gqlMetaView} onChange={e => setGqlMetaView(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="all">All characters</option>
                                <option value="allowed">Allowed characters</option>
                                <option value="disallowed">Disallowed characters</option>
                                <option value="meta-only">Meta characters only</option>
                              </select>
                            </div>
                            <button className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
                              onClick={() => patchGql({ valueMetaCharacters: [] })}>Restore Defaults</button>
                          </div>
                          <div className="flex gap-0 border border-gray-200 rounded overflow-hidden">
                            {cols.map((col, ci) => (
                              <div key={ci} className={`flex-1 ${ci<3?'border-r border-gray-200':''}`}>
                                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                                  {['Hex','Char','State'].map(h => <div key={h} className="px-2 py-1 text-[10px] font-medium text-gray-500 text-center">{h}</div>)}
                                </div>
                                {col.map(ch => {
                                  const allowed = getState(ch.hex)
                                  const modified = !ch.disabled && allowed !== defaultFor(ch.hex)
                                  return (
                                    <div key={ch.hex} className={`grid grid-cols-3 border-b border-gray-50 ${modified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                                      <div className="px-2 py-1 text-[10px] text-blue-600 font-mono text-center">{ch.hex}</div>
                                      <div className="px-2 py-1 text-[10px] text-gray-700 text-center font-medium">{ch.name}</div>
                                      <div className="px-1 py-0.5 text-center">
                                        {ch.disabled
                                          ? <select disabled className="text-[10px] border border-gray-200 rounded px-1 py-0 bg-gray-50 text-gray-300 w-full"><option>Disallow</option></select>
                                          : <select value={allowed?'allow':'disallow'} onChange={e => setState(ch.hex, e.target.value==='allow')}
                                              className="text-[10px] border border-gray-300 rounded px-1 py-0 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full cursor-pointer">
                                              <option value="allow">Allow</option>
                                              <option value="disallow">Disallow</option>
                                            </select>
                                        }
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {gqlSubTab === 'value-masking' && (() => {
                      const maskVars = draft.valueMasking || []
                      return (
                        <div className="p-4 space-y-3">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Mask Value in Logs</div>
                          <form onSubmit={e => { e.preventDefault(); const v = gqlNewMaskVar.trim(); if (!v || maskVars.includes(v)) return; patchGql({ valueMasking: [...maskVars, v] }); setGqlNewMaskVar('') }} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-32 flex-shrink-0">Variable Name:</span>
                            <input value={gqlNewMaskVar} onChange={e => setGqlNewMaskVar(e.target.value)} placeholder="Variable name…"
                              className="text-xs border border-gray-300 rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <button type="submit" className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Add</button>
                          </form>
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="overflow-y-auto max-h-40 bg-white">
                              {maskVars.length === 0
                                ? <div className="px-3 py-4 text-center text-xs text-gray-400">No variables configured.</div>
                                : maskVars.map((v, vi) => (
                                  <div key={vi} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 text-xs hover:bg-gray-50">
                                    <span className="text-gray-700 font-mono">{v}</span>
                                    <button onClick={() => patchGql({ valueMasking: maskVars.filter((_,j)=>j!==vi) })} className="text-gray-400 hover:text-red-500">×</button>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                          {maskVars.length > 0 && <button onClick={() => patchGql({ valueMasking: [] })} className="text-xs px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Delete All</button>}
                        </div>
                      )
                    })()}

                    {gqlSubTab === 'block-errors' && (() => {
                      const ber = draft.blockErrorResponses || {}
                      const patterns = ber.customPatterns || []
                      return (
                        <div className="p-4 space-y-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={ber.enabled ?? false}
                              onChange={e => patchGql({ blockErrorResponses: { ...ber, enabled: e.target.checked } })} />
                            Enabled
                          </label>
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">Custom Patterns to Block Responses</div>
                            <form onSubmit={e => { e.preventDefault(); const v = gqlNewPattern.trim(); if (!v || patterns.includes(v)) return; patchGql({ blockErrorResponses: { ...ber, customPatterns: [...patterns, v] } }); setGqlNewPattern('') }} className="flex items-center gap-2 mb-2">
                              <input value={gqlNewPattern} onChange={e => setGqlNewPattern(e.target.value)} placeholder="Use PCRE regular expression syntax"
                                className="text-xs border border-gray-300 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono" />
                              <button type="submit" className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 flex-shrink-0">Add</button>
                            </form>
                            <div className="border border-gray-200 rounded overflow-hidden">
                              <div className="overflow-y-auto max-h-40 bg-white">
                                {patterns.length === 0
                                  ? <div className="px-3 py-4 text-center text-xs text-gray-400">No patterns configured.</div>
                                  : patterns.map((v, vi) => (
                                    <div key={vi} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 text-xs hover:bg-gray-50">
                                      <span className="text-gray-700 font-mono">{v}</span>
                                      <button onClick={() => patchGql({ blockErrorResponses: { ...ber, customPatterns: patterns.filter((_,j)=>j!==vi) } })} className="text-gray-400 hover:text-red-500">×</button>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                            {patterns.length > 0 && <button onClick={() => patchGql({ blockErrorResponses: { ...ber, customPatterns: [] } })} className="text-xs px-2.5 py-1 mt-2 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Delete All</button>}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GraphQL Advanced Signature Modal */}
          {gqlSigAdvancedOpen && draft && (() => {
            const sigOverrides = draftOverrides
            const FSel = ({ label, k, opts }) => (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">{label}</span>
                <select value={gqlSigFilters[k]} onChange={e => setGqlSigFilters(f => ({ ...f, [k]: e.target.value }))}
                  className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none ${gqlSigFilters[k]!=='all'?'border-blue-400 bg-blue-50 text-blue-700 font-medium':'border-gray-200 text-gray-600'}`}>
                  <option value="all">All</option>
                  {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )
            return (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setGqlSigAdvancedOpen(false)}>
                <div className="bg-white rounded-lg shadow-2xl w-[740px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Exclude signatures</div>
                      <div className="text-xs text-gray-400 mt-0.5">{gqlSigAdvancedSelected.size} selected · {deviceSigs.length} total</div>
                    </div>
                    <button onClick={() => setGqlSigAdvancedOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
                    <input autoFocus placeholder="Search by ID or name…" value={gqlSigSearch} onChange={e => setGqlSigSearch(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <FSel label="Accuracy" k="accuracy" opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="Risk"     k="risk"     opts={[['high','High'],['medium','Medium'],['low','Low']]} />
                    <FSel label="CVE"      k="cve"      opts={[['yes','Has CVE'],['no','No CVE']]} />
                    {Object.values(gqlSigFilters).some(v => v !== 'all') && <button onClick={() => setGqlSigFilters({ accuracy:'all',risk:'all',cve:'all' })} className="text-xs text-blue-600 hover:underline">Clear</button>}
                    <span className="ml-auto text-xs text-gray-400">{gqlAdvSigs.length} shown · {gqlSigAdvancedSelected.size} selected</span>
                    {gqlSigAdvancedSelected.size > 0 && <button onClick={() => setGqlSigAdvancedSelected(new Set())} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {deviceSigs.length === 0
                      ? <div className="px-5 py-8 text-center text-sm text-gray-400">Load signatures via the Signatures tab first.</div>
                      : gqlAdvSigs.map(s => {
                        const sid = String(s.signatureId ?? s.id)
                        const checked = gqlSigAdvancedSelected.has(sid)
                        return (
                          <div key={sid} onClick={() => setGqlSigAdvancedSelected(prev => { const n = new Set(prev); checked ? n.delete(sid) : n.add(sid); return n })}
                            className={`flex items-center gap-3 px-5 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${checked?'bg-blue-50':''}`}>
                            <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                            <span className="font-mono text-xs text-gray-500 w-20 flex-shrink-0">{sid}</span>
                            <span className="text-xs text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                            {s.accuracy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{s.accuracy}</span>}
                            {s.risk && <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${s.risk==='high'?'bg-red-100 text-red-600':s.risk==='medium'?'bg-orange-100 text-orange-600':'bg-gray-100 text-gray-500'}`}>{s.risk}</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                  <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <Btn size="sm" onClick={() => setGqlSigAdvancedOpen(false)}>Cancel</Btn>
                    <Btn size="sm" variant="primary" onClick={() => {
                      const newOverrides = [...gqlSigAdvancedSelected].map(sid => { const ex = sigOverrides.find(o => String(o.signatureId??o.id)===sid); return ex || { signatureId: sid, enabled: false } })
                      patchGql({ signatureOverrides: newOverrides }); setGqlSigAdvancedOpen(false)
                    }}>Apply</Btn>
                  </div>
                </div>
              </div>
            )
          })()}
          </>
        )
      })()}

      {/* ── RAW JSON ── */}
      {activeTab === 'rawjson' && (
        <Card>
          <SectionHeader
            title="Raw JSON view"
            sub={`v${policy.version_num} · ${Math.round(JSON.stringify(policy.content).length / 1024)}KB`}
            action={
              <>
                <Btn size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(policy.content, null, 2)); toast.success('Copied') }}>Copy</Btn>
                <Btn size="sm" onClick={() => {
                  const blob = new Blob([JSON.stringify(policy.content, null, 2)], { type: 'application/json' })
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                  a.download = `${policy.name}.json`; a.click()
                }}>Download</Btn>
              </>
            }
            onClick={() => toggleSection('rawjson')} collapsed={collapsed.rawjson}
          />
          {!collapsed.rawjson && (() => {
            const rawText = JSON.stringify(policy.content, null, 2)
            const lines = rawText.split('\n')
            const q = rawSearch.trim().toLowerCase()
            const firstMatch = q ? lines.findIndex(ln => ln.toLowerCase().includes(q)) : -1
            const matchCount = q ? lines.filter(ln => ln.toLowerCase().includes(q)).length : 0
            return (
              <div className="m-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={rawSearch}
                    onChange={e => setRawSearch(e.target.value)}
                    placeholder="Search JSON… (jumps to first match)"
                    className="w-72 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                  {q && <span className="text-xs text-gray-400">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>}
                </div>
                <div ref={rawPreRef} className="bg-gray-50 rounded-lg font-mono text-xs text-gray-600 overflow-auto max-h-[48rem] leading-relaxed p-4">
                  {lines.map((ln, i) => {
                    const match = q && ln.toLowerCase().includes(q)
                    return (
                      <div key={i} data-match={i === firstMatch ? '1' : undefined} className={`flex ${match ? 'bg-yellow-100' : ''}`}>
                        <span className="select-none text-gray-300 pr-3 text-right flex-shrink-0" style={{ minWidth: '3.5em' }}>{i + 1}</span>
                        <span className="whitespace-pre">{ln}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </Card>
      )}

      {/* ── CHARACTER SETS ── */}
      {activeTab === 'charsets' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 px-1">
            Allowed/disallowed characters per context. These map to the policy's <span className="font-mono text-gray-600">character-sets</span> key.
          </div>
          {CHAR_SET_TYPES.map(({ type, label }) => (
            <PolicyCharSetPanel key={type} title={`${label} Character Set`} csType={type}
              charSets={pol['character-sets']} onChange={cs => setTop('character-sets', cs)}
              defaultCharSet={charsetDefaults[type]}
              collapsed={collapsed[`cs-${type}`]} onToggleCollapse={() => toggleSection(`cs-${type}`)} />
          ))}
        </div>
      )}

      </div>{/* end editor column */}

      {/* ── Live diff panel ── */}
      {showDiff && (() => {
        const savedPol = policy.content?.policy || {}
        const sections = computeDiff(savedPol, editedPol)
        const totalChanges = sections.reduce((n, s) => n + (s.tooLarge ? 0 : s.changes), 0)
        return (
          <div className="w-96 flex-shrink-0 sticky top-4 self-start">
            <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-700">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <span className="text-xs font-semibold text-orange-400 font-mono">live diff vs saved</span>
                <span className="text-xs text-gray-400">
                  {sections.length === 0 ? 'no changes' : `${totalChanges} change${totalChanges !== 1 ? 's' : ''} in ${sections.length} section${sections.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                {sections.length === 0 ? (
                  <div className="p-4 text-xs text-gray-500 text-center">No changes yet</div>
                ) : sections.map(sec => (
                  <div key={sec.key} className="border-b border-gray-800">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/60">
                      <span className="text-xs font-mono font-semibold text-yellow-300">{sec.key}</span>
                      <span className="text-xs text-gray-500">
                        {sec.tooLarge ? 'large' : `${sec.changes} change${sec.changes !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    {sec.tooLarge ? (
                      <div className="px-3 py-2 text-xs text-gray-500 italic">Section too large to inline</div>
                    ) : (
                      <div className="font-mono text-xs">
                        {sec.lines.filter(l => l.type !== 'same').map((line, i) => (
                          <div key={i} className={`flex gap-2 px-3 py-0.5 whitespace-pre
                            ${line.type === 'added' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                            <span className="select-none w-3 flex-shrink-0 font-bold">
                              {line.type === 'added' ? '+' : '-'}
                            </span>
                            <span className="truncate">{line.content.trim()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      </div>{/* end flex row */}
    </div>
  )
}
