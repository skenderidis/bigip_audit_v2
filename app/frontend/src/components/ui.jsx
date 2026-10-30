// Shared primitive components used across all pages

import f5Logo from '../assets/f5-logo.svg'
import nginxLogo from '../assets/nginx-logo.png'
import xcLogo from '../assets/xc-logo.png'

export const SourceLogo = ({ kind, size = 22 }) => {
  const isNim = kind === 'nim'
  const isXc = kind === 'xc'
  const src = isXc ? xcLogo : isNim ? nginxLogo : f5Logo
  const label = isNim ? 'NGINX (NIM)' : isXc ? 'F5 Distributed Cloud (XC)' : 'BIG-IP'
  return (
    <img src={src} alt={label} title={label}
      style={{ height: size, width: 'auto', maxWidth: size * 2 }}
      className="inline-block flex-shrink-0 object-contain" />
  )
}

export const Badge = ({ color = 'gray', children }) => {
  const map = {
    green:  'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red:    'bg-red-100 text-red-800',
    blue:   'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    gray:   'bg-gray-100 text-gray-600',
    ok:     'bg-green-100 text-green-800',
    warn:   'bg-yellow-100 text-yellow-800',
    info:   'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${map[color] ?? map.gray}`}>
      {children}
    </span>
  )
}

// Operational-effort meter: 5 bricks, the first `level` lit with an escalating
// colour (brick #5 is red). Higher = more upkeep as the application changes.
const EFFORT_ON = ['bg-emerald-500', 'bg-lime-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500']
const EFFORT_LABEL = { 1: 'Very low', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Very high' }

// Dark tooltip shown directly above the hovered element (needs a `group relative` parent).
const TipBox = ({ children }) => (
  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 text-white text-[10px] px-2 py-1 shadow-lg font-normal normal-case">
    {children}
  </span>
)

export const EffortBricks = ({ level = 0 }) => {
  const tip = `Operational effort: ${EFFORT_LABEL[level] || '—'} (${level}/5)`
  return (
    <span className="group relative inline-flex items-end gap-0.5 align-middle" title={tip}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={`w-1.5 h-3.5 rounded-[1px] ${i < level ? EFFORT_ON[i] : 'bg-gray-200'}`} />
      ))}
      <TipBox>{tip}</TipBox>
    </span>
  )
}

// Learning-effort gauge: a compact semi-circular speedometer (same SVG as the
// Risk/Accuracy badges on the waf-manager Signatures view) with the needle at
// one of five positions. Higher = more tuning/learning needed (green → red).
// 'manual' is off the auto-learn scale → shown as a tune/sliders icon instead.
// Icon only, no text label.
const LEARN_LABEL = { low: 'Low', 'low-med': 'Low-Med', med: 'Med', 'med-high': 'Med-High', high: 'High', manual: 'Manual' }
// Needle swings across the 180° arc: Low sits at 5% of the sweep, High at 85%
// (angle = -90 + pct*180). The three mid levels are evenly spaced between.
const LEARN_ANGLE = { low: -81, 'low-med': -45, med: -9, 'med-high': 27, high: 63 }
export const LearnGauge = ({ level }) => {
  const label = LEARN_LABEL[level] || 'N/A'
  const tip = level === 'manual' ? 'Learning effort: Manual (not auto-learned)' : `Learning effort: ${label}`
  const green = '#10b981', amber = '#f59e0b', red = '#ef4444'
  const svg = level === 'manual' ? (
    <svg width="46" height="26" viewBox="0 0 40 24" aria-label="Manual configuration">
      <g stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
        <line x1="9" y1="9" x2="31" y2="9" />
        <line x1="9" y1="16" x2="31" y2="16" />
      </g>
      <circle cx="16" cy="9" r="3.2" fill="#475569" />
      <circle cx="25" cy="16" r="3.2" fill="#475569" />
    </svg>
  ) : (
    <svg width="46" height="26" viewBox="0 0 40 24" aria-label={`Learning effort ${label}`}>
      <path d="M 4 20 A 16 16 0 0 1 12 6.14" stroke={green} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 12 6.14 A 16 16 0 0 1 28 6.14" stroke={amber} strokeWidth="4" fill="none" />
      <path d="M 28 6.14 A 16 16 0 0 1 36 20" stroke={red} strokeWidth="4" fill="none" strokeLinecap="round" />
      {LEARN_ANGLE[level] != null && (
        <g transform={`translate(20 20) rotate(${LEARN_ANGLE[level]})`}>
          <line x1="0" y1="0" x2="0" y2="-14" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="2.2" fill="#111827" />
        </g>
      )}
    </svg>
  )
  return (
    <span className="group relative inline-flex" title={tip}>
      {svg}
      <TipBox>{tip}</TipBox>
    </span>
  )
}

// Small info icon with a hover tooltip. `title` is also set so the explanation
// is never lost if the styled card is clipped by a scroll container.
export const InfoTip = ({ text, width = 'w-72', down = false }) => (
  <span className="group relative inline-flex align-middle ml-1" title={text}>
    <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className={`pointer-events-none absolute left-5 ${down ? 'top-0' : 'bottom-0'} z-50 hidden group-hover:block ${width} rounded-md bg-gray-900 text-white text-[11px] leading-snug px-2.5 py-2 shadow-lg whitespace-normal font-normal normal-case`}>
      {text}
    </span>
  </span>
)

export const Btn = ({ variant = 'secondary', size = 'md', onClick, disabled, children, className = '', type = 'button' }) => {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md cursor-pointer border transition-colors'
  const sizes = { sm: 'text-xs px-2.5 py-1', md: 'text-sm px-3 py-1.5', lg: 'text-sm px-4 py-2' }
  const variants = {
    primary:   'bg-gray-900 text-white border-gray-900 hover:bg-gray-800',
    secondary: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
    success:   'bg-green-600 text-white border-green-600 hover:bg-green-700',
    danger:    'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    ghost:     'bg-transparent text-gray-500 border-transparent hover:bg-gray-100',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant] ?? variants.secondary} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}>
      {children}
    </button>
  )
}

export const Toggle = ({ on, onClick, disabled = false }) => (
  <div onClick={disabled ? undefined : onClick}
    title={disabled ? 'Read-only' : undefined}
    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${on ? 'bg-green-600' : 'bg-gray-200'}`}>
    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </div>
)

export const Input = ({ label, hint, type = 'text', placeholder, value, onChange, className = '', name, readOnly }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-xs font-medium text-gray-500">{label}</label>}
    <input type={type} name={name} placeholder={placeholder} defaultValue={value} onChange={onChange} readOnly={readOnly}
      className={`text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 w-full ${readOnly ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`} />
    {hint && <span className="text-xs text-gray-400">{hint}</span>}
  </div>
)

export const Select = ({ label, children, className = '', value, onChange, disabled }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-xs font-medium text-gray-500">{label}</label>}
    <select defaultValue={value} onChange={onChange} disabled={disabled}
      className={`text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none w-full ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
      {children}
    </select>
  </div>
)

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}>{children}</div>
)

export const SectionHeader = ({ icon, title, sub, action, onClick, collapsed }) => (
  <div
    className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${onClick ? 'cursor-pointer select-none hover:bg-gray-50' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-2">
      {icon && <span className="text-gray-400">{icon}</span>}
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        {sub && !collapsed && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {action && <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>{action}</div>}
      {onClick && <span className="text-gray-400 text-s mt-0.5">{collapsed ? '▸' : '▾'}</span>}
    </div>
  </div>
)

export const PageHeader = ({ title, sub, actions }) => (
  <div className="flex items-start justify-between mb-6">
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)
