import { useState, useEffect, useMemo } from 'react'
import { Card } from '../components/ui'
import { refCharacterSets } from '../api/reference'

// Read-only Character Sets view. Shows the policy's own character-sets when it
// has them, otherwise the bundled global defaults. Each type renders as a grid
// of metachars, green = allowed, red = disallowed (like the editor's page).

// 0x41 -> "A"; control chars / space / DEL shown as hex for clarity.
function label(metachar) {
  const n = typeof metachar === 'string' && metachar.startsWith('0x') ? parseInt(metachar, 16) : Number(metachar)
  if (!Number.isFinite(n)) return String(metachar)
  if (n < 0x21 || n === 0x7f) return metachar          // non-printable → hex
  return String.fromCharCode(n)
}

function CharGrid({ members }) {
  return (
    <div className="flex flex-wrap gap-1">
      {members.map((m, i) => (
        <span key={i} title={`${m.metachar} — ${m.isAllowed ? 'allowed' : 'disallowed'}`}
          className={`inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1 rounded text-[11px] font-mono border ${
            m.isAllowed ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {label(m.metachar)}
        </span>
      ))}
    </div>
  )
}

export default function CharacterSetsSection({ policy }) {
  const policyTypes = policy['character-sets']   // array of {characterSetType, characterSet[]} | undefined
  const [defaults, setDefaults] = useState(null)
  const [open, setOpen] = useState({})

  useEffect(() => {
    if (!Array.isArray(policyTypes)) refCharacterSets().then(setDefaults).catch(() => setDefaults(null))
  }, [policyTypes])

  const usingPolicy = Array.isArray(policyTypes) && policyTypes.length > 0
  const types = useMemo(() => usingPolicy ? policyTypes : (defaults?.types || []), [usingPolicy, policyTypes, defaults])

  if (!usingPolicy && defaults === null) {
    return <Card><div className="p-4 text-sm text-gray-400">Loading character-set defaults…</div></Card>
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        {usingPolicy
          ? 'Character sets defined on this policy.'
          : 'This policy has no character-set overrides — showing the bundled global defaults.'}
      </div>
      {types.map((t, i) => {
        const members = t.characterSet || []
        const allowed = members.filter(m => m.isAllowed).length
        const expanded = open[t.characterSetType] ?? (i === 0)
        return (
          <Card key={t.characterSetType || i}>
            <button type="button"
              onClick={() => setOpen(o => ({ ...o, [t.characterSetType]: !expanded }))}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <span className="text-sm font-semibold text-gray-900">{t.characterSetType}</span>
              <span className="text-xs text-gray-400">
                {allowed} allowed · {members.length - allowed} disallowed {expanded ? '▾' : '▸'}
              </span>
            </button>
            {expanded && <div className="p-4"><CharGrid members={members} /></div>}
          </Card>
        )
      })}
    </div>
  )
}
