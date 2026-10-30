import { useState, useMemo, useEffect } from 'react'
import { Btn, Badge, Input } from './ui'
import { createTemplate } from '../api/templates'
import { CHECK_LABELS, CHECK_KEYS, GROUPS, GROUP_OF, CHECK_EFFORT, CHECK_LEARNING, ESSENTIAL } from '../lib/auditChecks'

const ESSENTIAL_SET = new Set(ESSENTIAL)

// Guided Configuration → a new Audit Template. The interview branches on the
// application type; the questions are about operational sustainability (how
// often the app changes, the team's process, false-positive appetite) which
// together set an "effort budget". A check is enabled when its ongoing
// operational effort (CHECK_EFFORT, 1..5) fits within that budget, so a team
// that can't keep up with change isn't handed high-maintenance checks.

const APP_TYPES = [
  { value: 'web', label: 'Web Application', desc: 'Browser-facing app — forms, cookies, sessions.' },
  { value: 'api', label: 'API Application', desc: 'REST / JSON API — machine clients, no browser rendering.' },
]

const CHANGE_FREQ = [
  { value: 'veryoften', label: 'Very often' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'rarely', label: 'Rarely' },
]

const FP = [
  { value: 'dontmind', label: "Don't mind" },
  { value: 'some', label: 'OK with some' },
  { value: 'avoid', label: 'Avoid them' },
]

// "OK with some" false positives → suggest the noisiest positive-security checks
// off (shown struck-through in the live panel). The customer can click to override.
const FP_SOME_OFF = new Set([
  'VIOL_PARAMETER_VALUE_METACHAR', 'VIOL_URL_METACHAR', 'VIOL_PARAMETER', 'VIOL_URL',
])

// "Avoid them" is the most false-positive-averse: on top of the "some" set it
// also suppresses file lengths, illegal file type, malicious IP, and the other
// two meta-character checks (header and parameter name). Overridable.
const FP_AVOID_OFF = new Set([
  ...FP_SOME_OFF,
  'VIOL_HEADER_METACHAR', 'VIOL_PARAMETER_NAME_METACHAR',
  'VIOL_FILETYPE', 'VIOL_MALICIOUS_IP',
  'VIOL_POST_DATA_LENGTH', 'VIOL_QUERY_STRING_LENGTH', 'VIOL_REQUEST_LENGTH', 'VIOL_URL_LENGTH',
])

// Notes shown on the false-positives step.
const FP_NOTES = [
  {
    title: 'Tune the Attack Signatures to the application',
    body: [
      'The default signature set is broad and includes low-accuracy signatures that often match legitimate traffic. Reduce noise by enabling only high-accuracy signatures, and by scoping the set to the attack types that actually concern this application.',
      'For example "SQL injection" for a database-backed app, command injection for anything that shells out, or XSS for pages that reflect user input — rather than running every signature against every request.',
    ],
  },
  {
    title: 'Exclude file-upload and free-text parameters from signature inspection',
    body: [
      'Signature inspection scans every parameter value, and two kinds of input reliably trigger false positives: file uploads (binary content whose byte sequences look like attacks) and free-text fields such as comments, descriptions or rich-text bodies (where normal words and punctuation match signatures).',
      'Identify those parameter names and disable signature inspection on them so legitimate content is not blocked.',
    ],
  },
]

const CONTENT_PROFILES = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML / SOAP' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'gwt', label: 'GWT' },
  { value: 'plaintext', label: 'Plain text' },
]

const YESNO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]

const IMPORTANCE = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

// From Medium importance upward we ask how often the app changes and whether
// the team works with us — both feed the capacity model below.
const asksContext = (a) => a.importance !== 'low'

const Q = {
  appType: {
    key: 'appType', type: 'single', title: 'What kind of application is this?',
    help: 'Sets the branch of questions that follow.', options: APP_TYPES,
  },
  importance: {
    key: 'importance', type: 'scale', title: 'How important is this application?',
    help: 'Business criticality — how much does an outage or breach hurt?', options: IMPORTANCE,
  },
  changeFreq: {
    key: 'changeFreq', type: 'scale', title: 'How often does the application change?',
    help: 'New pages, parameters or functionality. The more often it changes, the harder app-specific checks are to keep accurate.',
    options: CHANGE_FREQ,
  },
  teamProcess: {
    key: 'teamProcess', type: 'bool', title: 'Does the application team work with you on changes?',
    help: 'Do they inform you of changes and let you test the new functionality in a pre-production environment before it goes to production? If not, high-maintenance checks (meta-characters and manually-tuned parameters) are left off.',
    options: YESNO,
  },
  fpTolerance: {
    key: 'fpTolerance', type: 'scale', title: 'How important is avoiding false positives?',
    help: 'How much can this application tolerate a legitimate request being flagged or blocked?',
    options: FP,
  },
  hasLogin: {
    key: 'hasLogin', type: 'bool', title: 'Does the application have login pages?',
    help: 'Enables login, brute-force and session-token checks.', options: YESNO,
  },
  hasCsrf: {
    key: 'hasCsrf', type: 'bool',
    title: 'Does it have forms that need CSRF protection?',
    help: 'Forms that perform sensitive actions (transfers, profile or settings changes, purchases) can be abused by cross-site request forgery.',
    options: YESNO,
  },
  hasUploads: {
    key: 'hasUploads', type: 'bool', title: 'Does the application accept file uploads?',
    help: 'Enables the file-upload content checks.', options: YESNO,
  },
  hasIcap: {
    key: 'hasIcap', type: 'bool', title: 'Do you have an ICAP server to inspect the traffic?',
    help: 'An ICAP/AV server scans upload content for viruses. Note: if uploads can be larger than 10 MB, run ICAP on the LTM.',
    options: YESNO,
  },
  hasSensitiveData: {
    key: 'hasSensitiveData', type: 'bool', title: 'Does the application have sensitive PII data?',
    help: "If you don't want PII, card numbers or any customer data returned in responses, enable Data Guard.", options: YESNO,
  },
  hasOpenApi: {
    key: 'hasOpenApi', type: 'bool', title: 'Do you have the OpenAPI specification for this API?',
    help: 'With a spec the WAF can enforce positive security accurately — this enables the allow-list and parameter checks.',
    options: YESNO,
  },
  hasJwt: {
    key: 'hasJwt', type: 'bool', title: 'Does the application use JWT tokens?',
    help: 'Enables the JWT access-token validation checks (missing / malformed / invalid token).',
    options: YESNO,
  },
  contentProfiles: {
    key: 'contentProfiles', type: 'multi', title: 'Which content profiles does it use?',
    help: 'Enables the matching format/schema checks. Select all that apply.', options: CONTENT_PROFILES,
  },
}

// Steps group several questions. The feature step branches on app type: an API
// asks about its OpenAPI spec and JWT tokens (no login / CSRF / file-upload),
// while a web app asks the browser-facing feature questions.
function buildSteps(a) {
  // Business context: a low-importance app needs no further questions (it gets
  // essentials + its feature checks only). From Medium up we ask how often it
  // changes and whether the team works with us.
  const biz = [Q.importance]
  if (asksContext(a)) {
    biz.push(Q.changeFreq)
    biz.push(Q.teamProcess)
  }
  const features = a.appType === 'api'
    ? [Q.hasOpenApi, Q.hasJwt, Q.hasSensitiveData, Q.contentProfiles]
    : [Q.hasLogin, Q.hasCsrf, Q.hasUploads, ...(a.hasUploads === 'yes' ? [Q.hasIcap] : []), Q.hasSensitiveData, Q.contentProfiles]
  return [
    { questions: [Q.appType] },
    { title: 'Application features', questions: features },
    { title: 'Business context', questions: biz },
    { title: 'False positives', questions: [Q.fpTolerance] },
  ]
}

// Defaults are the minimal starting point: worst operational conditions (so no
// extra checks beyond Essential) and no optional features selected. Answering
// the questions only adds checks from here.
const DEFAULTS = {
  name: '', appType: 'web', importance: 'low',
  changeFreq: 'veryoften', teamProcess: 'no', fpTolerance: 'dontmind',
  hasLogin: 'no', hasCsrf: 'no', hasUploads: 'no', hasIcap: 'no', hasSensitiveData: 'no', contentProfiles: [],
  hasOpenApi: 'no', hasJwt: 'no',
}

// --- answers → checks --------------------------------------------------------
// A check is enabled when it is RELEVANT to the app (feature gate) OR its
// combined cost fits the app's "capacity". Capacity (2..10) is driven by three
// answers — how often the app changes, how important it is, and whether the
// team works with us:
//     capacity = base(change) + importance + team
// A check's cost is its operational effort (1..5) plus its learning effort
// (low=1 … high=5; manual=3, since a manual check needs hand-tuning but has no
// traffic-learning phase). Enable when cost <= capacity.
const BASE_CAP = { veryoften: 4, occasionally: 7, rarely: 10 }
const IMP_ADJ = { medium: 0, high: 1 }   // 'low' handled specially
const LEARN_NUM = { low: 1, 'low-med': 2, med: 3, 'med-high': 4, high: 5, manual: 3 }

export const costOf = (k) => (CHECK_EFFORT[k] ?? 3) + (LEARN_NUM[CHECK_LEARNING[k]] ?? 3)

// A low-importance app gets essentials + its feature checks only (capacity 0,
// so nothing cost-gated is added). Otherwise capacity is the budget above.
export function capacityOf(a) {
  if (a.importance === 'low') return 0
  const base = BASE_CAP[a.changeFreq] ?? 4
  const imp = IMP_ADJ[a.importance] ?? 0
  const team = a.teamProcess === 'yes' ? 1 : 0
  return Math.max(2, Math.min(10, base + imp + team))
}

// When the team does NOT work with us, these high-maintenance checks are always
// left off (regardless of capacity): meta-characters in the URL, parameter name
// and value, plus every parameter check that needs manual tuning.
const NOTEAM_OFF = new Set([
  'VIOL_URL_METACHAR', 'VIOL_PARAMETER_NAME_METACHAR', 'VIOL_PARAMETER_VALUE_METACHAR',
  ...CHECK_KEYS.filter(k => GROUP_OF[k] === 'parameters' && CHECK_LEARNING[k] === 'manual'),
])

// On a Medium-importance app the heavier parameter checks (operational effort
// 3) are left off — along with session-awareness and the two highest-cost
// checks (Illegal parameter and value meta-character, cost 10). These are
// reserved for High importance.
const MEDIUM_OFF = new Set([
  ...CHECK_KEYS.filter(k => GROUP_OF[k] === 'parameters' && CHECK_EFFORT[k] === 3),
  'VIOL_SESSION_AWARENESS',
  'VIOL_PARAMETER', 'VIOL_PARAMETER_VALUE_METACHAR',
])

// Exact per-profile tweaks, keyed by `importance|changeFreq|teamProcess`,
// applied last. For a settled (Rarely) Medium app we favour the cheaper URL
// meta-character over the high-maintenance Illegal-URL allow-list, and (with a
// non-cooperative team) still allow the URL meta-character check.
const PROFILE_OVERRIDES = {
  'medium|veryoften|yes': { VIOL_HEADER_METACHAR: 'yes' },
  'medium|rarely|no': { VIOL_URL: 'no', VIOL_URL_METACHAR: 'yes' },
  'high|rarely|no': { VIOL_URL_METACHAR: 'yes' },
  'high|veryoften|yes': { VIOL_PARAMETER_DATA_TYPE: 'no', VIOL_PARAMETER_NUMERIC_VALUE: 'no', VIOL_PARAMETER_VALUE_LENGTH: 'no', VIOL_HEADER_METACHAR: 'yes' },
}

// These are independent of the business-context step (importance / change /
// team): the Advanced reputation checks (except malicious IP, which stays
// context-driven), CSRF, and the JWT validation group. They default OFF and
// are opted into manually in the live panel.
const CONTEXT_INDEPENDENT_OFF = new Set([
  ...CHECK_KEYS.filter(k => GROUP_OF[k] === 'reputation' && k !== 'VIOL_MALICIOUS_IP'),
  'VIOL_CSRF_EXPIRED',
  'VIOL_COOKIE_EXPIRED',
  ...CHECK_KEYS.filter(k => GROUP_OF[k] === 'jwt'),
])

// Checks removed from the violation-options document — forced off in the
// wizard too so the app matches the document.
const REMOVED_OFF = new Set([
  'VIOL_MANDATORY_PARAMETER', 'VIOL_MANDATORY_REQUEST_BODY', 'VIOL_PARAMETER_ARRAY_VALUE',
  'VIOL_PARAMETER_DYNAMIC_VALUE', 'VIOL_PARAMETER_LOCATION', 'VIOL_PARAMETER_STATIC_VALUE',
  'VIOL_PARAMETER_VALUE_BASE64', 'VIOL_PARAMETER_VALUE_REGEXP',
  'VIOL_MANDATORY_HEADER',
])

// File-upload content checks (gated by hasUploads). Virus is separate — it
// needs an ICAP server, so it's gated by hasIcap.
const UPLOAD_CHECKS = new Set(['VIOL_FILE_UPLOAD', 'VIOL_FILE_UPLOAD_IN_BODY'])

function contentRelevant(k, profiles) {
  // Schema enforcement is opt-in (needs an uploaded schema), so selecting a
  // content profile enables its format/malformed checks but not the schema one.
  if (k === 'VIOL_JSON_SCHEMA' || k === 'VIOL_XML_SCHEMA') return false
  if (k.startsWith('VIOL_JSON')) return profiles.includes('json')
  if (k.startsWith('VIOL_XML')) return profiles.includes('xml')
  if (k.startsWith('VIOL_GRAPHQL')) return profiles.includes('graphql')
  if (k.startsWith('VIOL_GWT')) return profiles.includes('gwt')
  if (k.startsWith('VIOL_PLAINTEXT')) return profiles.includes('plaintext')
  return false
}

// "Does the app have login pages?" enables ONLY the Login group
// (brute force + illegal login attempt).
const SESSION_GROUPS = new Set(['login'])

// Is this a FEATURE-gated check, and if so is its feature present?
// Returns true/false for feature checks, or null for non-feature checks.
function featureOn(k, a) {
  const g = GROUP_OF[k]
  if (SESSION_GROUPS.has(g)) return a.hasLogin === 'yes'
  if (g === 'jwt') return a.hasJwt === 'yes'
  if (g === 'content') return contentRelevant(k, a.contentProfiles || [])
  if (UPLOAD_CHECKS.has(k)) return a.hasUploads === 'yes'
  if (k === 'VIOL_VIRUS') return a.hasUploads === 'yes' && a.hasIcap === 'yes'
  if (k === 'VIOL_DATA_GUARD') return a.hasSensitiveData === 'yes'
  if (k === 'VIOL_CSRF') return a.hasCsrf === 'yes'
  return null
}

export function answersToChecks(a) {
  // The wizard starts at Essential and grows. A check turns on when:
  //   1. it is in the Essential baseline — always on; or
  //   2. it is a feature check and its feature is present (login / uploads /
  //      sensitive data / content profile); or
  //   3. its combined cost fits the app's capacity.
  // Then, if the team does not work with us, the high-maintenance checks in
  // NOTEAM_OFF are forced back off regardless of capacity.
  const capacity = capacityOf(a)
  const noTeam = a.importance !== 'low' && a.teamProcess === 'no'
  const out = {}
  for (const k of CHECK_KEYS) {
    // JWT checks are normally opt-in (CONTEXT_INDEPENDENT_OFF); an API that uses
    // JWT tokens turns them on via the feature gate instead.
    const jwtOptedIn = GROUP_OF[k] === 'jwt' && a.hasJwt === 'yes'
    if (REMOVED_OFF.has(k) || (CONTEXT_INDEPENDENT_OFF.has(k) && !jwtOptedIn)) { out[k] = 'no'; continue }
    let on
    if (ESSENTIAL_SET.has(k)) on = true
    else {
      const f = featureOn(k, a)
      on = f === null ? costOf(k) <= capacity : f
    }
    if (a.importance === 'medium' && MEDIUM_OFF.has(k)) on = false
    if (noTeam && NOTEAM_OFF.has(k)) on = false
    // File-length checks are only worth their upkeep on a well-resourced policy:
    // require capacity 8+ (otherwise they would switch on at capacity 6).
    if (GROUP_OF[k] === 'lengths' && capacity < 8) on = false
    out[k] = on ? 'yes' : 'no'
  }
  const ov = PROFILE_OVERRIDES[`${a.importance}|${a.changeFreq}|${a.teamProcess}`]
  if (ov) for (const k in ov) out[k] = ov[k]
  // False-positive tolerance suppresses noisy checks (overridable in the panel).
  if (a.fpTolerance === 'some') for (const k of FP_SOME_OFF) out[k] = 'no'
  if (a.fpTolerance === 'avoid') for (const k of FP_AVOID_OFF) out[k] = 'no'
  // High importance enables the IP-reputation checks for every change frequency.
  if (a.importance === 'high') { out.VIOL_BLACKLISTED_IP = 'yes'; out.VIOL_GEOLOCATION = 'yes' }
  // API applications get the same baseline as a web app minus the two allow-list
  // essentials that assume a fixed request surface — APIs legitimately use many
  // HTTP methods and return a wide range of status codes, so these would false-positive.
  if (a.appType === 'api') {
    out.VIOL_METHOD = 'no'
    out.VIOL_HTTP_RESPONSE_STATUS = 'no'
    // APIs are JSON-centric, so malformed-JSON enforcement is on by default
    // (independent of the content-profile selection).
    out.VIOL_JSON_MALFORMED = 'yes'
    // With an OpenAPI spec the request surface is known, so positive security is
    // accurate: enable the allow-list checks and ALL parameter checks (including
    // the ones normally held back), plus mandatory HTTP header and illegal
    // content type. Meta-characters are intentionally left off.
    if (a.hasOpenApi === 'yes') {
      for (const k of CHECK_KEYS) {
        if (['allowlist', 'parameters'].includes(GROUP_OF[k])) out[k] = 'yes'
      }
      out.VIOL_MANDATORY_HEADER = 'yes'
      out.VIOL_URL_CONTENT_TYPE = 'yes'
    } else {
      // Without a spec, these allow-list / parameter checks aren't worth
      // suggesting for an API even when a "rarely changes" app has the capacity
      // for them — they're only enabled via the OpenAPI answer on step 2.
      out.VIOL_URL = 'no'
      out.VIOL_PARAMETER = 'no'
      out.VIOL_PARAMETER_DATA_TYPE = 'no'
      out.VIOL_PARAMETER_NUMERIC_VALUE = 'no'
      out.VIOL_PARAMETER_VALUE_LENGTH = 'no'
    }
    // APIs don't serve files or browser redirects — always off (overrides the
    // allow-list file-type enable above).
    out.VIOL_FILETYPE = 'no'
    out.VIOL_REDIRECT = 'no'
  }
  return out
}

function capLabel(c) {
  if (c <= 0) return 'Essentials only'
  if (c <= 4) return 'Lean — low-maintenance checks'
  if (c <= 6) return 'Moderate upkeep'
  if (c <= 8) return 'High coverage'
  return 'Full positive-security model'
}

export default function GuidedTemplateWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [overrides, setOverrides] = useState({})   // manual per-check on/off, keyed by VIOL_*

  const steps = useMemo(() => buildSteps(answers), [answers])
  const curStep = Math.min(step, steps.length)       // clamp if the step list shrank
  const isReview = curStep === steps.length
  const stepDef = isReview ? null : steps[curStep]
  // Suggested selection from the answers, then the user's manual overrides on top.
  const suggested = useMemo(() => answersToChecks(answers), [answers])
  const checks = useMemo(() => {
    const out = { ...suggested }
    for (const k in overrides) out[k] = overrides[k]
    return out
  }, [suggested, overrides])
  const overrideCount = Object.keys(overrides).length
  const capacity = capacityOf(answers)

  // Click a check in the live panel → flip it, recorded as a manual override.
  function toggleCheck(key) {
    setOverrides(prev => {
      const next = { ...prev }
      const current = key in next ? next[key] : suggested[key]
      const flipped = current === 'yes' ? 'no' : 'yes'
      // If the flip matches the suggestion again, drop the override.
      if (flipped === suggested[key]) delete next[key]
      else next[key] = flipped
      return next
    })
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onClose])

  function pick(key, value) {
    setAnswers(prev => {
      const next = { ...prev, [key]: value }
      // Turning file uploads off resets the ICAP answer (and thus Virus).
      if (key === 'hasUploads' && value === 'no') next.hasIcap = 'no'
      return next
    })
  }

  // Going BACK discards the answers given on the step being left, so the checks
  // that step turned on/off revert to the previous step's state. (Forward never
  // resets anything.)
  function goBack() {
    if (curStep === 0) return
    const leaving = steps[curStep]   // undefined on the review step (nothing to reset)
    if (leaving?.questions) {
      setAnswers(prev => {
        const next = { ...prev }
        for (const q of leaving.questions) {
          if (q.key in DEFAULTS) next[q.key] = DEFAULTS[q.key]
        }
        return next
      })
    }
    setStep(Math.max(0, curStep - 1))
  }

  async function create() {
    const name = answers.name.trim()
    if (!name) { setError('Please give the template a name.'); return }
    setSaving(true); setError(null)
    try {
      const res = await createTemplate(name, checks)
      onCreated?.(res)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create the template.')
      setSaving(false)
    }
  }

  const enabledCount = CHECK_KEYS.filter(k => checks[k] === 'yes').length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[88vh] flex flex-col">

        {/* header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Guided Configuration — New Template</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isReview ? 'Name the template and create it.' : `Step ${curStep + 1} of ${steps.length}`}
            </p>
          </div>
          <button onClick={() => !saving && onClose()} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* body: question on the left, live checks panel on the right */}
        <div className="flex-1 overflow-hidden grid grid-cols-5">
          <div className="col-span-2 overflow-y-auto p-5 border-r border-gray-100">
            {isReview
              ? <ReviewStep answers={answers} setAnswers={setAnswers} enabledCount={enabledCount} error={error} />
              : <StepView step={stepDef} answers={answers} pick={pick} setAnswers={setAnswers} />}
          </div>
          <div className="col-span-3 overflow-y-auto bg-gray-50">
            <LivePanel checks={checks} enabledCount={enabledCount} capacity={capacity}
              struck={answers.fpTolerance === 'some' ? FP_SOME_OFF : answers.fpTolerance === 'avoid' ? FP_AVOID_OFF : null}
              onToggle={toggleCheck} overrideCount={overrideCount} onReset={() => setOverrides({})} />
          </div>
        </div>

        {/* footer nav */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <Btn onClick={goBack} disabled={curStep === 0 || saving}>← Back</Btn>
          {!isReview ? (
            <Btn variant="primary" onClick={() => setStep(curStep + 1)} disabled={!stepAnswered(stepDef, answers)}>
              {curStep === steps.length - 1 ? 'Review →' : 'Next →'}
            </Btn>
          ) : (
            <Btn variant="primary" onClick={create} disabled={saving || !answers.name.trim()}>
              {saving ? 'Creating…' : `Create template (${enabledCount} checks)`}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

function stepAnswered(step, answers) {
  if (!step) return true
  return step.questions.every(q => q.type === 'single' ? !!answers[q.key] : true)
}

const toggleArr = (arr, v) => (arr || []).includes(v) ? arr.filter(x => x !== v) : [...(arr || []), v]

function StepView({ step, answers, pick, setAnswers }) {
  return (
    <div className="space-y-5">
      {step.title && <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>}
      {step.questions.map((q, i) => (
        <div key={q.key} className={i > 0 ? 'pt-4 border-t border-gray-100' : ''}>
          {q.key === 'appType' && (
            <div className="mb-4">
              <Input label="Template name" placeholder="e.g. shop-frontend-baseline"
                value={answers.name} onChange={e => setAnswers(a => ({ ...a, name: e.target.value }))} />
            </div>
          )}
          <QuestionBlock q={q} answers={answers} pick={pick} />
        </div>
      ))}
    </div>
  )
}

function QuestionBlock({ q, answers, pick }) {
  const val = answers[q.key]
  return (
    <div>
      <div className="text-sm font-medium text-gray-900">{q.title}</div>
      {q.help && <p className="text-xs text-gray-500 mt-0.5 mb-2">{q.help}</p>}

      {q.type === 'scale' ? (
        <>
          <ScaleBar options={q.options} value={val} onChange={v => pick(q.key, v)} />
          {q.key === 'fpTolerance' && val === 'avoid' && (
            <div className="mt-4 space-y-2">
              {FP_NOTES.map((n, i) => (
                <div key={i} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold text-amber-700 shrink-0">Note {i + 1}</span>
                    <span className="text-[11px] font-semibold text-amber-900">{n.title}</span>
                  </div>
                  {n.body.map((p, j) => (
                    <p key={j} className={`text-[11px] text-amber-800 leading-snug ${j > 0 ? 'mt-1.5' : ''}`}>{p}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      ) : q.type === 'multi' ? (
        <div className="flex flex-nowrap gap-1.5">
          {q.options.map(o => {
            const sel = (val || []).includes(o.value)
            return (
              <button key={o.value} type="button" onClick={() => pick(q.key, toggleArr(val, o.value))}
                className={`px-2 py-1 rounded-md border text-xs whitespace-nowrap transition-colors ${
                  sel ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                {o.label}
              </button>
            )
          })}
        </div>
      ) : q.type === 'bool' ? (
        <div className="flex gap-1.5">
          {q.options.map(o => {
            const sel = val === o.value
            return (
              <button key={o.value} type="button" onClick={() => pick(q.key, o.value)}
                className={`px-2 py-1 rounded-md border text-xs whitespace-nowrap transition-colors ${
                  sel ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                {o.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {q.options.map(o => {
            const sel = val === o.value
            return (
              <button key={String(o.value)} type="button" onClick={() => pick(q.key, o.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <span className="text-sm font-medium text-gray-900">{o.label}</span>
                {o.desc && <div className="text-xs text-gray-500 mt-0.5">{o.desc}</div>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Draggable segmented bar between ordered options.
function ScaleBar({ options, value, onChange }) {
  const idx = Math.max(0, options.findIndex(o => o.value === value))
  return (
    <div className="px-1 pt-3 pb-1">
      <input type="range" min={0} max={options.length - 1} step={1} value={idx}
        onChange={e => onChange(options[Number(e.target.value)].value)}
        className="w-full accent-blue-600 cursor-pointer" />
      <div className="flex justify-between mt-2">
        {options.map((o, i) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`flex-1 text-[11px] ${i === idx ? 'text-blue-700 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}
            style={{ textAlign: i === 0 ? 'left' : i === options.length - 1 ? 'right' : 'center' }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Checkbox-style mark: green tick when enabled, empty box when disabled.
function Mark({ on }) {
  return (
    <span className={`w-3.5 h-3.5 rounded-[2px] flex-shrink-0 inline-flex items-center justify-center ${on ? 'bg-green-500' : 'border border-gray-300 bg-white'}`}>
      {on && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M8 13.4 4.6 10 3.2 11.4 8 16.2l8.8-8.8L15.4 6z" /></svg>}
    </span>
  )
}

// Live right-side panel: every check on its own line with a check/uncheck mark,
// grouped and flowed across two columns. Each line is clickable to manually
// override the suggested selection.
function LivePanel({ checks, enabledCount, capacity, onToggle, overrideCount, onReset, struck }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">Checks enabled</h3>
        {overrideCount > 0
          ? <button onClick={onReset} className="text-[11px] text-blue-600 hover:underline">reset {overrideCount} edit{overrideCount > 1 ? 's' : ''}</button>
          : <span className="text-[11px] text-gray-400">click to toggle</span>}
      </div>
      <div className="flex items-center gap-2 mb-1 text-xs text-gray-600">
        <Badge color="green">{enabledCount} / {CHECK_KEYS.length}</Badge>
      </div>
      <div className="mb-3" />

      <div className="columns-2 gap-5">
        {GROUPS.map(g => {
          const on = g.checks.filter(k => checks[k] === 'yes').length
          return (
            <div key={g.key} className="break-inside-avoid mb-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-0.5 mb-1">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{g.label}</span>
                <span className={`text-[10px] ${on ? 'text-green-600' : 'text-gray-400'}`}>{on}/{g.checks.length}</span>
              </div>
              {g.checks.map(k => {
                const enabled = checks[k] === 'yes'
                const strike = !enabled && struck?.has(k)
                return (
                  <button key={k} type="button" onClick={() => onToggle(k)}
                    title={strike ? `${k} — suppressed by your false-positive tolerance; click to override` : k}
                    className="w-full flex items-center gap-1.5 leading-5 text-left rounded hover:bg-gray-100 px-0.5 -mx-0.5">
                    <Mark on={enabled} />
                    <span className={`text-[11px] truncate ${strike ? 'line-through text-red-500' : enabled ? 'text-gray-700' : 'text-gray-400'}`}>{CHECK_LABELS[k]}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReviewStep({ answers, setAnswers, enabledCount, error }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Name &amp; create</h3>
      <p className="text-xs text-gray-500 mb-4">This template will enable <span className="font-medium text-gray-700">{enabledCount}</span> checks (see the panel on the right).</p>
      <Input label="Template name" placeholder="e.g. shop-frontend-baseline"
        value={answers.name} onChange={e => setAnswers(a => ({ ...a, name: e.target.value }))} />
      {error && <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <dl className="mt-4 text-xs text-gray-600 space-y-1">
        <div className="flex justify-between"><dt className="text-gray-400">Application type</dt><dd>{APP_TYPES.find(o => o.value === answers.appType)?.label}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Importance</dt><dd>{IMPORTANCE.find(o => o.value === answers.importance)?.label}</dd></div>
        {asksContext(answers) && <div className="flex justify-between"><dt className="text-gray-400">Changes</dt><dd>{CHANGE_FREQ.find(o => o.value === answers.changeFreq)?.label}</dd></div>}
        {asksContext(answers) && <div className="flex justify-between"><dt className="text-gray-400">Team process</dt><dd>{answers.teamProcess === 'yes' ? 'Informs & tests' : 'No'}</dd></div>}
        <div className="flex justify-between"><dt className="text-gray-400">False positives</dt><dd>{FP.find(o => o.value === answers.fpTolerance)?.label}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Login pages</dt><dd>{answers.hasLogin === 'yes' ? 'Yes' : 'No'}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">CSRF protection</dt><dd>{answers.hasCsrf === 'yes' ? 'Yes' : 'No'}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">File uploads</dt><dd>{answers.hasUploads === 'yes' ? 'Yes' : 'No'}</dd></div>
        {answers.hasUploads === 'yes' && <div className="flex justify-between"><dt className="text-gray-400">ICAP server</dt><dd>{answers.hasIcap === 'yes' ? 'Yes' : 'No'}</dd></div>}
        <div className="flex justify-between"><dt className="text-gray-400">Sensitive data</dt><dd>{answers.hasSensitiveData === 'yes' ? 'Yes' : 'No'}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Content profiles</dt><dd>{(answers.contentProfiles || []).length ? answers.contentProfiles.join(', ') : 'none'}</dd></div>
      </dl>
    </div>
  )
}
