import { useState, useEffect, useRef } from 'react'
import { listTemplates, saveTemplate, deleteTemplate } from '../api/templates'
import GuidedTemplateWizard from '../components/GuidedTemplateWizard'
import { CHECK_LABELS, GROUPS, CHECK_EXPLAIN, CHECK_EFFORT, CHECK_LEARNING } from '../lib/auditChecks'
import { downloadAsmPolicy } from '../lib/asmPolicy'
import { InfoTip, EffortBricks, LearnGauge } from '../components/ui'

// Audit Templates v2 — same presets as the Templates page, but every
// blocking-settings check is organised into groups (Cookies, Parameters,
// Content profiles, WebSocket, …) so a template reads as a handful of areas.

const BUILTIN = ['level1', 'level2', 'level3']

function Switch({ on, onClick }) {
  return (
    <button onClick={onClick} type="button" aria-pressed={on}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function GroupRows({ group, columns, data, isCollapsed, onToggleGroup, groupOnCount, setGroup, toggle }) {
  return (
    <>
      {/* group header row */}
      <tr className="bg-gray-50/70 border-b border-gray-200">
        <td className="px-3 py-1.5">
          <button onClick={onToggleGroup} className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900">
            <span className="text-gray-400 w-3 inline-block">{isCollapsed ? '▸' : '▾'}</span>
            {group.label}
            <span className="text-gray-400 font-normal">({group.checks.length})</span>
          </button>
        </td>
        <td className="px-4 py-1.5" />
        <td className="px-4 py-1.5" />
        {columns.map(key => {
          const on = groupOnCount(key, group)
          const all = on === group.checks.length
          const none = on === 0
          return (
            <td key={key} className="px-4 py-1.5 text-center">
              <button onClick={() => setGroup(key, group, !all)}
                title={all ? 'Turn area off' : 'Turn area on'}
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  all ? 'bg-green-100 text-green-700' : none ? 'bg-gray-100 text-gray-400' : 'bg-amber-100 text-amber-700'}`}>
                {on}/{group.checks.length}
              </button>
            </td>
          )
        })}
      </tr>
      {/* check rows */}
      {!isCollapsed && group.checks.map(check => (
        <tr key={check} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
          <td className="px-4 py-2 pl-8 text-gray-800">
            <span className="inline-flex items-center">{CHECK_LABELS[check]}<InfoTip text={CHECK_EXPLAIN[check]} /></span>
          </td>
          <td className="px-4 py-2 text-center"><EffortBricks level={CHECK_EFFORT[check]} /></td>
          <td className="px-4 py-2 text-center"><div className="flex justify-center"><LearnGauge level={CHECK_LEARNING[check]} /></div></td>
          {columns.map(key => (
            <td key={key} className="px-4 py-2 text-center">
              <Switch on={data[key]?.[check] === 'yes'} onClick={() => toggle(key, check)} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function TemplateV2() {
  const [data, setData] = useState(null)
  const [dirty, setDirty] = useState(new Set())
  const [banner, setBanner] = useState(null)
  const [wizard, setWizard] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())   // group keys that are collapsed
  const bannerTimer = useRef(null)

  const load = () => listTemplates().then(setData).catch(() => setData({}))
  useEffect(() => { load() }, [])
  useEffect(() => () => clearTimeout(bannerTimer.current), [])

  const columns = data
    ? [...BUILTIN.filter(k => data[k]), ...Object.keys(data).filter(k => !BUILTIN.includes(k))]
    : []

  function flash(msg) {
    setBanner(msg)
    clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 1500)
  }

  function toggleGroup(key) {
    setCollapsed(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  function toggle(key, check) {
    setData(d => ({ ...d, [key]: { ...d[key], [check]: d[key][check] === 'yes' ? 'no' : 'yes' } }))
    setDirty(s => new Set(s).add(key))
  }

  // Flip every check in a group on/off for one template at once.
  function setGroup(key, group, value) {
    setData(d => {
      const next = { ...d[key] }
      for (const c of group.checks) next[c] = value ? 'yes' : 'no'
      return { ...d, [key]: next }
    })
    setDirty(s => new Set(s).add(key))
  }

  async function save(key) {
    try {
      const saved = await saveTemplate(key, data[key])
      setData(d => ({ ...d, [key]: saved }))
      setDirty(s => { const n = new Set(s); n.delete(key); return n })
      flash(`Saved ${name(key)}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Save failed')
    }
  }

  async function remove(key) {
    if (!window.confirm(`Delete template "${name(key)}"? This cannot be undone.`)) return
    try {
      await deleteTemplate(key)
      setData(d => { const n = { ...d }; delete n[key]; return n })
      setDirty(s => { const n = new Set(s); n.delete(key); return n })
      flash(`Deleted ${name(key)}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed')
    }
  }

  function onCreated(res) {
    setData(d => ({ ...d, [res.key]: res.template }))
    flash(`Created ${res.template.name}`)
  }

  const name = (key) => (data?.[key]?.name) || key
  const groupOnCount = (key, group) => group.checks.filter(c => data?.[key]?.[c] === 'yes').length

  return (
    <div className="max-w-[1600px]">
      {wizard && <GuidedTemplateWizard onClose={() => setWizard(false)} onCreated={onCreated} />}

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Checks grouped by area. Toggle an area header to collapse it, or flip a whole area per template.</p>
        </div>
        <button onClick={() => setWizard(true)}
          className="text-sm px-3 py-1.5 rounded-md font-medium bg-gray-900 text-white hover:bg-gray-700 inline-flex items-center gap-1.5 whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New template (guided)
        </button>
      </div>

      {banner && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{banner}</div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        {data === null ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 font-medium">Check</th>
                <th className="px-4 py-2 font-medium text-center w-28">
                  <span className="inline-flex items-center">Operational effort<InfoTip text="How much ongoing upkeep this check needs as the application changes (new URLs, parameters, functionality). 5 bricks = constant upkeep; brick #5 is red." down /></span>
                </th>
                <th className="px-4 py-2 font-medium text-center w-32">
                  <span className="inline-flex items-center">Learning effort<InfoTip text="How much tuning / traffic-learning the check needs before it is accurate (building allow-lists, schemas, login flows). Low → High." down /></span>
                </th>
                {columns.map(key => (
                  <th key={key} className="px-4 py-2 font-medium text-center w-32">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{name(key)}</span>
                      <button onClick={() => downloadAsmPolicy(name(key), data[key])} title="Download ASM policy JSON"
                        className="text-gray-300 hover:text-gray-700 leading-none">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                        </svg>
                      </button>
                      {!BUILTIN.includes(key) && (
                        <button onClick={() => remove(key)} title="Delete template"
                          className="text-gray-300 hover:text-rose-500 leading-none">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(group => {
                const isCollapsed = collapsed.has(group.key)
                return (
                  <GroupRows key={group.key} group={group} columns={columns} data={data}
                    isCollapsed={isCollapsed} onToggleGroup={() => toggleGroup(group.key)}
                    groupOnCount={groupOnCount} setGroup={setGroup} toggle={toggle} />
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {columns.map(key => {
          const isDirty = dirty.has(key)
          return (
            <button key={key} onClick={() => save(key)} disabled={!isDirty}
              className={`text-sm px-3 py-1.5 rounded-md font-medium ${
                isDirty ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              Save {name(key)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
