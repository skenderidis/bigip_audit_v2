import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, PageHeader, Btn } from '../components/ui'
import { getAuditPolicy, getPolicyOwasp, setPolicyOwaspAck, downloadPolicyOwaspReport } from '../api/auditPolicies'

// Compliance % → colour (higher = better).
function band(v) {
  if (v >= 75) return '#16a34a'
  if (v >= 50) return '#d97706'
  return '#e4502b'
}

const STATUS = {
  fulfilled: { dot: 'bg-green-500', text: 'text-green-700', label: 'Fulfilled' },
  partial:   { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Partial' },
  not:        { dot: 'bg-rose-400',  text: 'text-rose-600',  label: 'Not met' },
  unknown:   { dot: 'bg-gray-300',  text: 'text-gray-400',  label: 'Needs pull' },
}
const pct = (v) => (typeof v === 'number' ? `${v}%` : '—')

// Per-requirement help text, keyed by requirement label. Applies wherever the
// same requirement appears across categories.
const REQ_HELP = {
  'Authentication/Authorization Attacks':
    'The system detects an attempt to bypass authentication or authorization mechanism. This attack may lead to disclosure of sensitive information, escalation of privileges, and data tampering.',
  'Path Traversal':
    'The system detects an attempt to access files and directories that are stored outside the web root folder on the web application host system. This attack (which is also known as directory traversal) may lead to disclosure of sensitive information and data tampering.',
  'Predictable Resource Location':
    'The system detects an attempt to access a known sensitive resource on a web application host system. This attack may lead to disclosure of sensitive information and additional attacks that can be possible using this information.',
  'Login Enforcement':
    'The system detects access to a sensitive resource without prior authentication.',
  'Disallowed File types':
    'Disallowed File Types define a list of file extensions that are considered illegal by the security policy. Requests to a URL with an extension from this list will be blocked. This item shows the number of the Disallowed File Types defined in the policy with a link to their list.',
  'Disallowed URLs':
    'Disallowed URLs define a list of URLs that are considered illegal by the security policy. Requests to a URL from this list will be blocked. This item shows the number of the Disallowed URLs defined in the policy with a link to their list.',
  'Information Leakage':
    'The system detects an attempt to retrieve sensitive information that should not be accessible by design. This attack is also known as Information Disclosure.',
  'Data Guard':
    'The system examines responses and searches for sensitive information (e.g. Credit Card Numbers, U.S. Social Security Numbers) to prevent information leakage.',
  'Mask Credit Card Numbers in Request Log':
    'The system detects Credit Card Numbers in HTTP requests and masks them in the request log.',
  'Masked Parameters':
    'Masked Parameters are parameters that contain sensitive user input, such as a password or a credit card number, in a validated request. The contents of sensitive parameters are not visible in logs nor in the user interface. This item shows the number of sensitive parameters defined in the policy added to the number of parameters that have "mask value in logs" enabled. The link is to the list of sensitive parameters.',
  'Masked Headers':
    'Masked Headers are HTTP headers that contain sensitive user input, such as a password or a credit card number, in a validated request. The contents of masked headers are not visible in logs nor in the user interface. This item shows the number of headers defined in the policy that have "mask value in logs" enabled. The link is to the list of HTTP headers.',
  'Masked Cookies':
    'Masked Cookies are cookies that contain sensitive user input, such as a password or a credit card number, in a validated request. The contents of masked cookies are not visible in logs nor in the user interface. This item shows the number of cookies defined in the policy that have "mask value in logs" enabled. The link is to the list of cookies.',
  'Client-side encryption':
    'The client-side communication must be protected using TLS with strong cipher and secure key exchange. The default Client SSL profile must be attached to the virtual server.',
  'Server-side encryption':
    'The server-side communication must be protected using TLS. A Server SSL profile must be attached to the virtual server.',
  'Buffer Overflow':
    'The system detects an attempt to exploit a buffer overflow vulnerability in order to crash a web application or execute malicious code.',
  'Command Execution':
    'The system detects an attempt to inject a shell command and execute it on the host operating system of a web application.',
  'Cross Site Scripting (XSS)':
    'The system detects an attempt to inject a malicious script into a web application. This attack may lead to data tampering, disclosure of sensitive information and session hijacking.',
  'Denial of Service':
    'The system detects a tool or an attack technique focused on making a web application unavailable.',
  'LDAP Injection':
    'The system detects an attempt to inject LDAP statements into a web application. This attack may lead to execution of arbitrary commands, data tampering and disclosure of sensitive information.',
  'Remote File Include':
    'The system detects an attempt to exploit a vulnerable dynamic file inclusion mechanism of a web application to execute malicious code on the web server. This attack can also lead to data tampering, disclosure of sensitive information, and execution of malicious client-side code.',
  'SQL-Injection':
    'The system detects an attempt to inject SQL statements into web application input. A successful SQL injection exploit can lead to data tampering, disclosure of sensitive information, and execution of arbitrary commands on the host operating system.',
  'Server Side Code Injection':
    'The system detects an attempt to exploit a vulnerable Server Side Include (SSI) mechanism. This attack may lead to execution of arbitrary commands on the host operating system.',
  'Vulnerability Scan':
    'The system detects known vulnerability scanner clients (e.g. Nessus, Nikto, Qualys, etc.).',
  'XPath Injection':
    'The system detects an attempt to inject an XPath query into web application input. This attack may lead to disclosure of structure of the XML objects used by the web application, disclosure of sensitive information and even elevation of privileges if XML data is being used for authentication.',
  'Evasion Techniques': [
    'The system detects a number of evasion techniques that attackers use to bypass detection. Met when the Evasion violation is set to blocking and these sub-techniques are enabled:',
    'Bad unescape — detects illegal HEX encoding and reports unescaping errors (such as %RR), which can be used to evade attack-signature detection and break applications that cannot handle this input.',
    'Bare byte decoding — detects higher ASCII bytes (greater than 127), commonly used to hide attacks such as XSS.',
    'IIS backslashes — detects backslashes in the URI, which IIS treats as forward slashes, and which can be used to evade path-based detection.',
  ],
  'Disallowed Meta Characters In Parameters':
    'Disallowed meta characters in parameters are characters (letters, digits, and symbols) that are not allowed by the security policy in parameter names and parameter values. HTTP requests with such parameters will be blocked.',
  'HttpOnly Cookie Attribute Enforcement':
    'The system adds the HttpOnly cookie attribute to protect the web application from XSS attacks. The HttpOnly attribute instructs the browser that scripts executing in the browser are not allowed to access this cookie. This item shows the number of cookie entities for which the Insert HttpOnly attribute option is enabled, with a link to their list.',
  'Use cases Analysis':
    'Analyze use cases together with misuse cases when defining the user stories.',
  'Security rules Definitions':
    'Define security rules, checks and access controls in each user story.',
  'Threat modelling assessments':
    'Threat modelling assessment process per each component and feature.',
  'Threat modelling testing':
    'Write unit and integration tests to validate that all critical flows are resistant to the threat model.',
  'Tenant isolation Design':
    'Design tenant isolation in all layers.',
  'Resource consumption limitation':
    'Limit resource consumption per user and service.',
  'Disallow DTDs in XML content profile':
    'DTDs (Document Type Definition) may be used to launch attacks similar to the XML External Entity attack. These attacks can include disclosing local files, which may contain sensitive data such as passwords or private user data, using file: schemes or relative paths in the system identifier. Note: enabling this protection will also block benign DTD use-cases.',
  'Attack Signatures':
    'Attack signatures are rules or patterns that identify attack sequences or classes of attacks on a web application and its components. This item shows the number of Attack Signature Sets defined in the policy, with a link to their list.',
  'Server Technologies':
    'Server technologies can be server-side applications, frameworks, programs, web servers, operating systems, and so on, and they are associated with one or more sets of attack signatures that can be added to the policy. Defining Server Technologies allows a more selective set of attack signatures to be assigned to the policy — signatures that specifically apply to the technologies used in the application being protected. This item shows the number of Server Technologies defined in the policy, with a link to their list.',
  'Allowed Methods':
    'Allowed Methods is a list of HTTP methods that are acceptable within the context of the web application. This item shows the number of allowed methods defined in the policy, with a link to their list.',
  'SameSite Cookie Attribute Enforcement':
    'The system adds the SameSite cookie attribute to protect the web application from security misconfiguration. The SameSite attribute of the Set-Cookie HTTP response header lets you declare whether your cookie is restricted to a first-party or same-site context. This item shows the number of cookie entities for which the Insert SameSite attribute option is enabled, with a link to their list.',
  'CORS enabled in URLs':
    'The system adds cross-origin request enforcement to an existing URL to allow a website to access the resources of another website. This item shows the number of URL entities for which the CORS attribute option is enabled, with a link to their list.',
  'Clickjacking protection URLs':
    'A clickjacking attack inserts malicious frames on legitimate pages, misleading users into clicking on them and causing effects they cannot anticipate, such as giving a "like". To prevent this, the system adds a header to the response instructing the browser to accept frames only from the same origin.',
  'ASM cookie tampering protection':
    'The system checks that the request contains an ASM cookie that has not been modified or tampered with, and blocks modified requests. This protection prevents session hijacking.',
  'Session Hijacking protection': [
    'The system checks that the request does not contain an ASM cookie that was created in another session, and blocks modified requests. This is done in two ways:',
    '1. Verifying that ASM’s session cookies are consistent.',
    '2. Verifying that ASM’s session cookies match the client’s Device-ID. Note: Device-ID mode must be configured in the bot profile for this option to work.',
  ],
  'Brute Force protection':
    'The system detects an attempt to guess user credentials by enumerating a username/password combination.',
  'Application vulnerability scanning':
    'The web application security administrator should periodically use web application security scanner tools to discover potential vulnerabilities and weak security configurations. The vulnerability scanner report should be investigated and confirmed issues should be mitigated. Mark this item as fulfilled if this activity is done regularly.',
  'Vulnerability scanner integration':
    'Vulnerability scanner integration is an ASM feature that allows building a security policy based on the findings of a Vulnerability Assessment Tool. Mark this item as fulfilled if this activity is done regularly.',
  'Application and system patching':
    'The web application security administrator should monitor published vulnerabilities for all software components of the web application. All known vulnerabilities should be mitigated by upgrading to a fixed version of the software or implementing a configuration that mitigates them. Mark this item as fulfilled if this activity is done regularly.',
  'Application and system hardening':
    'Web application and system hardening is the process of securing the system by reducing its attack surface. This is achieved by implementing security configuration checklists for all system and application components. Mark this item as fulfilled if this activity is done regularly.',
  'Enforced cookies':
    'Cookies set by the origin server that are checked for integrity when returned by the client.',
  'Use trusted repositories':
    'Third-party packages must be taken only from trusted repositories.',
  'Packages digitally signed and verified':
    'All packages must be digitally signed to prevent malicious software from being installed.',
  'Secure CI/CD pipeline':
    'Apply authentication and authorization rules for access to the CI/CD, and make sure it is properly hardened and patched for vulnerabilities.',
  'Component inventory tool':
    'Tools such as OWASP Dependency-Check trace the dependency chain and alert on insecure packages.',
  'Log Illegal Requests':
    'Best practices require that violating requests are logged. Make sure a "Log illegal requests" logging profile is assigned to all relevant virtual servers. Mark this item as fulfilled if this configuration is implemented. This item is linked to the configuration dashboard that shows logging profile assignments.',
  'Remote Logging':
    'Best practices require that remote logging is configured. Make sure a logging profile with remote logging enabled is assigned to all relevant virtual servers. Mark this item as fulfilled if this configuration is implemented. This item is linked to the configuration dashboard that shows logging profile assignments.',
  'SSRF Attack Signatures':
    'Signatures for SSRF (Server-Side Request Forgery) attacks.',
  'SSRF Hosts':
    'SSRF Hosts restricts the server-side hosts that the server can access by URI parameter values. The list must be populated in order for the SSRF Protection to be effective.',
  'URI or Auto-detected Parameters':
    'Parameters that carry URIs for accessing server-side resources. You should either define the URI parameters in your application or allow them to be automatically detected. Use the Auto-detect Parameter feature to automatically detect URI parameters in the application — an alternative to defining them explicitly in the policy. Typically this is used on wildcard parameters.',
}

// Small (i) icon with a hover tooltip explaining a requirement. The tooltip is
// rendered in a portal with fixed positioning so it escapes the card's
// overflow-hidden and never gets clipped at a table/card edge; its left is
// clamped to the viewport so it stays fully on screen.
const TIP_W = 288   // w-72
function InfoTip({ text }) {
  const ref = useRef(null)
  const tipRef = useRef(null)
  const [rect, setRect] = useState(null)   // trigger rect while hovering
  const [pos, setPos] = useState(null)      // resolved {left, top} after measuring
  // After the tooltip mounts we know its height, so we can flip it above the
  // icon when there isn't room below (e.g. the last row near the viewport
  // bottom) and clamp it on-screen both ways.
  useLayoutEffect(() => {
    if (!rect) { setPos(null); return }
    const h = tipRef.current ? tipRef.current.offsetHeight : 0
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - TIP_W - 8))
    const below = rect.bottom + 6
    const fitsBelow = below + h <= window.innerHeight - 8
    const top = fitsBelow ? below : Math.max(8, rect.top - 6 - h)
    setPos({ left, top })
  }, [rect, text])
  if (!text) return null
  const show = () => { if (ref.current) setRect(ref.current.getBoundingClientRect()) }
  const hide = () => setRect(null)
  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onClick={e => e.stopPropagation()}
        className="inline-flex shrink-0 text-gray-300 hover:text-gray-500 cursor-help">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-label="More information">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {rect && createPortal(
        <div ref={tipRef} style={{
            position: 'fixed', left: pos ? pos.left : -9999, top: pos ? pos.top : -9999,
            width: TIP_W, zIndex: 60, visibility: pos ? 'visible' : 'hidden',
          }}
          className="pointer-events-none rounded-lg bg-gray-900 text-white text-[11px] leading-relaxed px-3 py-2 shadow-lg normal-case tracking-normal font-normal">
          {Array.isArray(text)
            ? text.map((line, i) => <div key={i} className={i ? 'mt-1.5' : ''}>{line}</div>)
            : text}
        </div>, document.body)}
    </>
  )
}

// Render order for requirement groups within a category.
const GROUP_ORDER = ['Attack Signatures', 'Required Signatures', 'Protections', 'Policy Entities', 'Best Practices', 'Virtual Server Protection']

function countsOf(reqs) {
  const c = { fulfilled: 0, partial: 0, not: 0, unknown: 0 }
  for (const r of reqs) c[r.status] = (c[r.status] || 0) + 1
  return c
}

// Small horizontal meter.
function Meter({ value }) {
  const v = typeof value === 'number' ? value : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: band(v) }} />
    </div>
  )
}

// Signatures placed in staging alarm but don't block yet.
const StageBadge = () => (
  <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold shrink-0">staging</span>
)

// Applied / Staging / Total signatures for an attack-type requirement.
const SigStats = ({ r }) => {
  const est = r.exact === false
  return (
    <span className="flex items-center gap-2.5 text-[11px] shrink-0 tabular-nums"
      title={est ? 'In-set counts estimated from the set filter' : undefined}>
      <span className="text-green-700 font-semibold">{est && r.applied > 0 ? '~' : ''}{r.applied}<span className="text-gray-400 font-normal"> applied</span></span>
      <span className="text-amber-700 font-semibold">{est && r.staging > 0 ? '~' : ''}{r.staging}<span className="text-gray-400 font-normal"> staging</span></span>
      {r.logOnly > 0 && (
        <span className="text-amber-700 font-semibold">{est ? '~' : ''}{r.logOnly}<span className="text-gray-400 font-normal"> log-only</span></span>
      )}
      <span className="text-gray-600 font-semibold">{r.available ?? '—'}<span className="text-gray-400 font-normal"> total</span></span>
    </span>
  )
}

function CategoryCard({ cat, open, onToggle, onAck, busyKey }) {
  const sc = cat.score
  const c = typeof sc === 'number' ? band(sc) : '#9ca3af'
  const counts = countsOf(cat.requirements)
  const groups = GROUP_ORDER.filter(g => cat.requirements.some(r => r.group === g))
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-gray-50"
        onClick={onToggle}>
        <span className="text-gray-400 text-lg leading-none w-4">{open ? '▾' : '▸'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-gray-900 truncate">
              <span className="text-gray-400 mr-1.5">{cat.id}</span>{cat.name}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {cat.staged && <StageBadge />}
              <span className="text-sm font-bold tabular-nums" style={{ color: c }}>{pct(sc)}</span>
            </span>
          </div>
          <div className="mt-1.5"><Meter value={sc} /></div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{counts.fulfilled} met</span>
            {counts.partial > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{counts.partial} partial</span>}
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{counts.not} not met</span>
            {counts.unknown > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" />{counts.unknown} needs pull</span>}
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500 leading-relaxed mb-3">{cat.description}</p>
          {groups.map(group => {
            const items = cat.requirements.filter(r => r.group === group)
            return (
              <div key={group} className="mb-3 last:mb-0">
                <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{group}</div>
                <div className="divide-y divide-gray-50">
                  {items.map((r, i) => {
                    const st = STATUS[r.status] || STATUS.not
                    const accepted = r.status === 'fulfilled'
                    const key = r.ackKey || r.ovKey
                    const busy = key && busyKey === key
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="flex items-center gap-1.5 text-[13px] text-gray-700 min-w-0">
                          <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${st.dot}`} />
                          <span className="truncate">{r.label}</span>
                          <InfoTip text={REQ_HELP[r.label]} />
                        </span>
                        {r.ackKey ? (
                          <button
                            disabled={busy}
                            onClick={() => onAck(r.ackKey, !accepted)}
                            className={`text-[11px] shrink-0 px-2 py-0.5 rounded border transition-colors ${busy ? 'opacity-50' : ''} ${
                              accepted
                                ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                          >
                            {accepted ? '✓ Accepted' : 'Accept'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            {/* computed value (dimmed when overridden) */}
                            <span className={r.overridden ? 'opacity-40' : ''}>
                              {r.applied !== undefined ? (
                                <SigStats r={r} />
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  {r.staged && <StageBadge />}
                                  <span className={`text-[11px] ${st.text}`}>{r.overridden ? r.baseDetail : r.detail}</span>
                                </span>
                              )}
                            </span>
                            {/* override toggle — mark the requirement met */}
                            <button
                              disabled={busy}
                              onClick={() => onAck(r.ovKey, !r.overridden)}
                              title={r.overridden ? 'Marked met — click to undo' : 'Mark this requirement as met'}
                              className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${busy ? 'opacity-50' : ''} ${
                                r.overridden
                                  ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                  : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                            >
                              {r.overridden ? '✓ Met' : 'Met'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default function OwaspDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [data, setData] = useState(null)      // full evaluate() result | 'error'
  const [open, setOpen] = useState(() => new Set())
  const [busyKey, setBusyKey] = useState(null)

  useEffect(() => {
    getAuditPolicy(id).then(d => setName(d.name || `Policy ${id}`)).catch(() => setName(`Policy ${id}`))
    getPolicyOwasp(id)
      .then(d => { setData(d); setOpen(new Set()) })   // start collapsed
      .catch(() => setData('error'))
  }, [id])

  async function ack(key, value) {
    setBusyKey(key)
    try {
      const res = await setPolicyOwaspAck(id, { [key]: value })
      setData(res.detail)
    } catch { toast.error('Could not save acceptance') }
    finally { setBusyKey(null) }
  }

  const allOpen = data && data !== 'error' && open.size === (data.categories || []).length
  function toggleAll() {
    if (allOpen) setOpen(new Set())
    else setOpen(new Set((data.categories || []).map(c => c.id)))
  }
  function toggleOne(cid) {
    setOpen(prev => { const n = new Set(prev); n.has(cid) ? n.delete(cid) : n.add(cid); return n })
  }

  const totals = useMemo(() => {
    if (!data || data === 'error') return null
    const t = { fulfilled: 0, partial: 0, not: 0, unknown: 0 }
    for (const c of data.categories) for (const r of c.requirements) t[r.status] = (t[r.status] || 0) + 1
    return t
  }, [data])

  if (data === 'error') return (
    <div>
      <PageHeader title="OWASP Top 10" />
      <Card><div className="p-8 text-center text-sm text-gray-400">Could not load OWASP compliance. Re-analyze the policy and try again.</div></Card>
    </div>
  )
  if (!data) return (
    <div><PageHeader title="OWASP Top 10" /><Card><div className="p-8 text-center text-sm text-gray-400">Loading…</div></Card></div>
  )

  const overall = typeof data.score === 'number' ? band(data.score) : '#9ca3af'
  return (
    <div>
      <PageHeader
        title="OWASP Top 10 — Compliance"
        sub={name}
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" size="sm" onClick={toggleAll}>{allOpen ? 'Collapse all' : 'Expand all'}</Btn>
            <Btn variant="secondary" size="sm"
              onClick={() => downloadPolicyOwaspReport(id).catch(() => toast.error('Could not build the report'))}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              OWASP Report
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => navigate('/waf')}>← All Policies</Btn>
          </div>
        }
      />

      {/* Overall summary */}
      <Card className="mb-5">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl shrink-0"
              style={{ background: `${overall}15`, border: `2px solid ${overall}` }}>
              <span className="text-2xl font-bold tabular-nums" style={{ color: overall }}>{pct(data.score)}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Overall compliance</div>
              <div className="text-xs text-gray-500 mt-0.5">{data.defined} of {data.total_categories} categories scored · average across defined categories</div>
              {totals && (
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600 flex-wrap">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{totals.fulfilled} fulfilled</span>
                  {totals.partial > 0 && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{totals.partial} partial</span>}
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />{totals.not} not met</span>
                  {totals.unknown > 0 && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" />{totals.unknown} needs signature pull</span>}
                </div>
              )}
            </div>
          </div>
          {/* Category chips */}
          <div className="flex-1 grid grid-cols-5 gap-2">
            {data.categories.map(c => (
              <button key={c.id} onClick={() => { toggleOne(c.id); document.getElementById(`owasp-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
                title={c.name}
                className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors">
                <span className="text-[11px] font-semibold text-gray-500">{c.id}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: typeof c.score === 'number' ? band(c.score) : '#9ca3af' }}>{pct(c.score)}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Per-category detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.categories.map(c => (
          <div key={c.id} id={`owasp-${c.id}`}>
            <CategoryCard cat={c} open={open.has(c.id)} onToggle={() => toggleOne(c.id)} onAck={ack} busyKey={busyKey} />
          </div>
        ))}
      </div>
    </div>
  )
}
