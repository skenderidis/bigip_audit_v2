import { useState, useEffect, useRef } from 'react'
import useSubTabStore from '../store/useSubTabStore'
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import f5Logo from '../assets/f5-logo.svg'
import ChangePasswordModal from './ChangePasswordModal'

// Audit for BIGIP — WAF audit first; LTM / DDoS / Bot groups will be added as
// those modules land.
const NAV = [
  {
    group: 'WAF',
    items: [
      { label: 'Security Posture', to: '/waf' },
      { label: 'Templates', to: '/templates' },
    ],
  },
  {
    group: 'BIG-IP',
    items: [
      { label: 'LTM',  to: '/ltm' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { label: 'Violation Catalog', to: '/settings', end: true },
      { label: 'Report Details', to: '/settings/report' },
      { label: 'iHealth Credentials', to: '/settings/ihealth' },
      { label: 'Ignore Diagnostics', to: '/settings/ignore-diagnostics' },
      { label: 'Attack Signatures', to: '/signatures' },
    ],
  },
]

const TITLES = {
  '/waf': 'Security Posture',
  '/settings': 'Violation Catalog',
  '/settings/report': 'Report Details',
  '/settings/ihealth': 'iHealth Credentials',
  '/settings/ignore-diagnostics': 'Ignore Diagnostics',
  '/ltm': 'LTM',
  '/signatures': 'Attack Signatures',
  '/templates': 'Audit Templates',
  '/policies': 'Policies',
}

const WIDE_PAGES = new Set(['/waf', '/policies', '/templates', '/settings', '/ltm'])
// Wide: the WAF/posture pages plus a policy detail page and its sub-pages
// (/policies/:id, /policies/:id/owasp, /policies/:id/risk, …) and the BIG-IP
// device pages, including a device detail page (/ltm/:id).
const isWidePage = (path) =>
  WIDE_PAGES.has(path) ||
  /^\/policies\/[^/]+(\/.*)?$/.test(path) ||
  /^\/ltm\/[^/]+$/.test(path)

function UserMenu({ user, initials, onLogout, onChangePassword }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors">
        <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-semibold">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-medium text-gray-800 leading-tight">{user?.username ?? 'Admin'}</div>
          <div className="text-[10px] text-gray-400 capitalize leading-tight">{user?.role ?? 'admin'}</div>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-900 truncate">{user?.username ?? 'Admin'}</div>
            <div className="text-xs text-gray-400 capitalize truncate">{user?.role ?? 'admin'}</div>
          </div>
          <button onClick={() => { setOpen(false); onChangePassword() }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Change password
          </button>
          <button onClick={() => { setOpen(false); onLogout() }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function linkClass({ isActive }) {
  return `block text-xs px-3 py-1.5 rounded-md transition-colors ${
    isActive ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const subTabContent = useSubTabStore(s => s.content)
  const [showChangePw, setShowChangePw] = useState(false)

  function handleLogout() { logout(); navigate('/login') }

  const initials = user?.username
    ? user.username.split(/[\s._-]/).map(n => n[0]?.toUpperCase()).slice(0, 2).join('')
    : 'AU'

  const title = TITLES[location.pathname] || ''

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="w-52 bg-white border-r border-gray-100 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="flex items-center gap-2.5 px-4 h-12 flex-shrink-0 border-b border-gray-100">
          <img src={f5Logo} alt="F5" className="w-8 h-8 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">Audit for BIGIP</span>
        </div>
        <nav className="flex-1 p-2 space-y-4">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide px-3 mb-1">{group}</div>
              <div className="space-y-0.5">
                {items.map(({ label, to, caption, end }) => (
                  caption ? (
                    // Coming-soon: inert, muted, never highlighted active (these
                    // point at a placeholder route, so a NavLink would light up).
                    <div key={label}
                      className="block text-xs px-3 py-1.5 rounded-md text-gray-400 cursor-default select-none">
                      <span className="flex flex-col leading-tight">
                        <span>{label}</span>
                        <span className="text-[8px] font-semibold text-red-400 uppercase tracking-wide">{caption}</span>
                      </span>
                    </div>
                  ) : (
                    <NavLink key={label} to={to} end={end} className={linkClass}>{label}</NavLink>
                  )
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5">
          <nav className="flex items-center gap-1 text-sm min-w-0">
            <Link to="/waf" className="text-gray-400 hover:text-gray-600 flex-shrink-0">Home</Link>
            {title && <>
              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-700 font-medium truncate">{title}</span>
            </>}
          </nav>
          <UserMenu user={user} initials={initials} onLogout={handleLogout} onChangePassword={() => setShowChangePw(true)} />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {subTabContent && (
            <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">{subTabContent}</div>
          )}
          <div className="flex-1 overflow-y-auto">
            <div className={`${isWidePage(location.pathname) ? 'max-w-[1600px]' : 'max-w-6xl'} px-6 py-6`}>
              {children}
            </div>
          </div>
        </div>
      </div>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}
