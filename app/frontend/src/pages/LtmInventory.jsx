import { useEffect, useState } from 'react'
import { Card } from '../components/ui'
import AuditTable from '../components/AuditTable'

// Inventory tables for a device audit: the virtual servers and the components
// pulled from the QKView (pools, profiles, SSL certs, self-IPs, modules,
// iRules) — the data that used to live in the Excel sheets, rendered as
// searchable / sortable / paginated tables. Clicking a virtual server or a
// pool opens a drawer with its profiles, iRules, members and raw config.

// F5 uses the literal "none" as an empty sentinel in list fields.
const clean = (v) =>
  (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).filter(
    (x) => x && String(x).toLowerCase() !== 'none')

const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v])
const leaf = (name) => (name ? String(name).split('/').filter(Boolean).pop() : '')
const mono = 'font-mono text-[11px]'

const Chk = ({ on }) =>
  on ? <span className="text-teal-600 font-semibold">✓</span>
     : <span className="text-gray-300">·</span>

function Section({ title, count, children }) {
  return (
    <Card className="mb-4">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {count != null && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium tabular-nums">{count}</span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </Card>
  )
}

const chk = (key, header) => ({
  key, header, align: 'center', sortable: true,
  sortValue: (r) => (r[key] ? 1 : 0),
  cell: (r) => <Chk on={r[key]} />,
})

// ---- detail drawer ---------------------------------------------------------
function Drawer({ title, subtitle, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={onClose}>
      <div className="h-full w-full max-w-xl bg-white shadow-xl flex flex-col animate-[slideIn_.15s_ease-out]"
        onMouseDown={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            {subtitle && <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">{subtitle}</div>}
            <h3 className="text-sm font-semibold text-gray-900 leading-snug font-mono break-all">{title}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  if (children == null || children === '' || (Array.isArray(children) && !children.length)) return null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">{label}</div>
      <div className="text-[13px] text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}

function KVGrid({ pairs }) {
  const rows = pairs.filter(([, v]) => v != null && v !== '' && String(v).toLowerCase() !== 'none')
  if (!rows.length) return null
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
      {rows.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{k}</dt>
          <dd className="text-[13px] text-gray-800 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Chips({ items, title }) {
  const list = clean(items)
  if (!list.length) return <div className="text-[13px] text-gray-400">None</div>
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((x, i) => (
        <span key={i} className={`${mono} px-1.5 py-0.5 rounded bg-gray-100 text-gray-700`}
          title={title ? String(x) : undefined}>{title ? leaf(x) : x}</span>
      ))}
    </div>
  )
}

function RawConfig({ raw }) {
  if (!raw) {
    return (
      <div className="text-[12px] text-gray-400 italic">
        Raw configuration will appear here after the next QKView pull.
      </div>
    )
  }
  return (
    <pre className="font-mono text-[11px] text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto">
      {raw}
    </pre>
  )
}

const COVERAGE = [
  ['has_http', 'HTTP'], ['has_client_ssl', 'Client SSL'], ['has_server_ssl', 'Server SSL'],
  ['has_tcp', 'TCP'], ['has_udp', 'UDP'], ['has_compression', 'Compression'],
  ['has_web_acceleration', 'Web Accel'], ['has_bot', 'Bot'], ['has_dos', 'DoS'], ['has_asm', 'ASM'],
]

function VsDrawer({ row, onClose }) {
  const enabled = COVERAGE.filter(([k]) => row[k]).map(([, label]) => label)
  return (
    <Drawer title={row.name} subtitle="Virtual Server" onClose={onClose}>
      <KVGrid pairs={[
        ['Partition', row.partition],
        ['Destination', row.destination],
        ['Default Pool', row.pool && row.pool !== 'none' ? leaf(row.pool) : null],
        ['ASM Policy', row.asm_policy ? leaf(row.asm_policy) : null],
        ['Persistence', clean(row.persist).map(leaf).join(', ')],
        ['Fallback Persistence', row['fallback-persistence'] && row['fallback-persistence'] !== 'none' ? leaf(row['fallback-persistence']) : null],
      ]} />
      {enabled.length > 0 && (
        <Field label="Enabled Features">
          <div className="flex flex-wrap gap-1.5">
            {enabled.map((x, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">{x}</span>)}
          </div>
        </Field>
      )}
      <Field label={`Profiles (${clean(row.profiles).length})`}><Chips items={row.profiles} title /></Field>
      <Field label={`iRules (${clean(row.rules).length})`}><Chips items={row.rules} title /></Field>
      {clean(row.policies).length > 0 && (
        <Field label={`Policies (${clean(row.policies).length})`}><Chips items={row.policies} title /></Field>
      )}
      {clean(row['security-log-profiles']).length > 0 && (
        <Field label="Security Log Profiles"><Chips items={row['security-log-profiles']} title /></Field>
      )}
      <Field label="Configuration"><RawConfig raw={row.raw} /></Field>
    </Drawer>
  )
}

function ProfileDrawer({ row, subtitle, onClose }) {
  return (
    <Drawer title={row.name} subtitle={subtitle} onClose={onClose}>
      <KVGrid pairs={[['Partition', row.partition]]} />
      <Field label="Configuration"><RawConfig raw={row.raw} /></Field>
    </Drawer>
  )
}

function PoolDrawer({ row, onClose }) {
  const members = arr(row.members)
  const down = (m) => (m.state || '').toLowerCase() !== 'up' || (m.session || '').includes('disabled')
  return (
    <Drawer title={row.pool} subtitle="Pool" onClose={onClose}>
      <KVGrid pairs={[
        ['Partition', row.partition],
        ['Load Balancing', row['load-balancing-mode']],
        ['Monitor', row.monitor],
        ['Members', row.member_count],
      ]} />
      <Field label={`Members (${members.length})`}>
        {members.length ? (
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr><th className="text-left px-2.5 py-1.5 font-medium">Member</th>
                    <th className="text-left px-2.5 py-1.5 font-medium">Address</th>
                    <th className="text-left px-2.5 py-1.5 font-medium">State</th></tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className={`px-2.5 py-1.5 ${mono}`}>{leaf(m.name)}</td>
                    <td className={`px-2.5 py-1.5 ${mono} text-gray-500`}>{m.address || '—'}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={down(m) ? 'text-rose-600 font-medium' : 'text-teal-600'}>{m.state || '—'}</span>
                      {m.session && m.session !== 'monitor-enabled' && <span className="text-gray-400"> · {m.session}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-[13px] text-gray-400">No members.</div>}
      </Field>
      <Field label="Configuration"><RawConfig raw={row.raw} /></Field>
    </Drawer>
  )
}

export default function LtmInventory({ content }) {
  const c = content || {}
  const [drawer, setDrawer] = useState(null)   // { kind:'vs'|'pool', row }

  // Virtual servers: coverage matrix (virtual_details) merged with ltm_virtuals
  // for profiles / rules / policies / persistence / raw config.
  const lvBy = Object.fromEntries((c.ltm_virtuals || []).map((v) => [v.virtual, v]))
  const vsRows = (c.virtual_details || []).map((d) => {
    const lv = lvBy[d.virtual] || {}
    return {
      ...lv,          // profiles, rules, policies, persist, raw, destination, pool, …
      ...d,           // has_* coverage flags, partition, asm_policy
      name: d.virtual,
      destination: lv.destination || null,
      pool: lv.pool || null,
      n_profiles: clean(lv.profiles).length,
      n_rules: clean(lv.rules).length,
      n_policies: clean(lv.policies).length,
    }
  })

  // One unified profiles table (type + name) across every profile kind.
  const PROF_TYPES = [
    ['HTTP', 'http'], ['HTTP/2', 'http2'], ['TCP', 'tcp_profiles'], ['UDP', 'udp_profiles'],
    ['Client SSL', 'client_ssl'], ['Server SSL', 'server_ssl'],
    ['Compression', 'compression'], ['Web Acceleration', 'web_acceleration'],
  ]
  const profRows = []
  for (const [label, key] of PROF_TYPES)
    for (const p of c[key] || [])
      profRows.push({ type: label, name: typeof p === 'string' ? p : (p.profile || p.name || '') })

  const certRows = c.ssl_certs || []
  const poolRows = c.ltm_pools || []
  const botRows = c.bot_profiles || []
  const dosRows = c.dos_profiles || []
  const selfRows = c.self_ips || []
  const modRows = c.sys_provision || []
  const ruleRows = (c.irule_names || []).map((n) => ({ name: typeof n === 'string' ? n : (n.name || '') }))

  return (
    <div>
      <Section title="Virtual Servers" count={vsRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="name"
          onRowClick={(r) => setDrawer({ kind: 'vs', row: r })}
          columns={[
            { key: 'name', header: 'Virtual Server', cell: (r) => <span className={mono} title={r.name}>{r.name}</span> },
            { key: 'partition', header: 'Partition' },
            { key: 'destination', header: 'Destination', cell: (r) => r.destination ? <span className={mono}>{r.destination}</span> : <span className="text-gray-300">—</span> },
            { key: 'pool', header: 'Pool', cell: (r) => (r.pool && r.pool !== 'none') ? <span className={mono}>{leaf(r.pool)}</span> : <span className="text-gray-300">—</span> },
            { key: 'asm_policy', header: 'ASM Policy', cell: (r) => (r.asm_policy) ? <span className={mono} title={r.asm_policy}>{leaf(r.asm_policy)}</span> : <span className="text-gray-300">—</span> },
            { key: 'n_profiles', header: 'Profiles', align: 'right' },
            { key: 'n_rules', header: 'iRules', align: 'right' },
            chk('has_http', 'HTTP'),
            chk('has_client_ssl', 'C-SSL'),
            chk('has_server_ssl', 'S-SSL'),
            chk('has_tcp', 'TCP'),
            chk('has_udp', 'UDP'),
            chk('has_compression', 'Compr'),
            chk('has_web_acceleration', 'WebAcc'),
            chk('has_bot', 'Bot'),
            chk('has_dos', 'DoS'),
            chk('has_asm', 'ASM'),
          ]}
          rows={vsRows} emptyText="No virtual servers." />
      </Section>

      <Section title="Pools" count={poolRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="pool"
          onRowClick={(r) => setDrawer({ kind: 'pool', row: r })}
          columns={[
            { key: 'pool', header: 'Pool', cell: (r) => <span className={mono}>{r.pool}</span> },
            { key: 'partition', header: 'Partition' },
            { key: 'member_count', header: 'Members', align: 'right',
              sortValue: (r) => r.member_count ?? 0,
              cell: (r) => {
                const n = r.member_count
                if (n == null) return <span className="text-gray-300">—</span>
                const down = (r.members || []).filter((m) => (m.state || '').toLowerCase() !== 'up' || (m.session || '').includes('disabled')).length
                return <span className="tabular-nums">{n}{down ? <span className="text-rose-600"> ({down} down)</span> : ''}</span>
              } },
            { key: 'load-balancing-mode', header: 'Load Balancing' },
            { key: 'monitor', header: 'Monitor' },
          ]}
          rows={poolRows} emptyText="No pools." />
      </Section>

      <Section title="Bot-Defense Profiles" count={botRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="name"
          onRowClick={(r) => setDrawer({ kind: 'profile', row: r, subtitle: 'Bot-Defense Profile' })}
          columns={[
            { key: 'name', header: 'Profile', cell: (r) => <span className={mono} title={r.name}>{leaf(r.name)}</span> },
            { key: 'partition', header: 'Partition' },
          ]}
          rows={botRows} emptyText="No Bot-Defense profiles." />
      </Section>

      <Section title="DoS Profiles" count={dosRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="name"
          onRowClick={(r) => setDrawer({ kind: 'profile', row: r, subtitle: 'DoS Profile' })}
          columns={[
            { key: 'name', header: 'Profile', cell: (r) => <span className={mono} title={r.name}>{leaf(r.name)}</span> },
            { key: 'partition', header: 'Partition' },
          ]}
          rows={dosRows} emptyText="No DoS profiles." />
      </Section>

      <Section title="Profiles" count={profRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="type"
          columns={[
            { key: 'type', header: 'Type' },
            { key: 'name', header: 'Profile', cell: (r) => <span className={mono}>{r.name}</span> },
          ]}
          rows={profRows} emptyText="No profiles." />
      </Section>

      <Section title="SSL Certificates" count={certRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="days_to_expiry" defaultSortDir="asc"
          columns={[
            { key: 'certificate', header: 'Certificate',
              sortValue: (r) => leaf(r.certificate),
              cell: (r) => <span className={mono} title={r.certificate}>{leaf(r.certificate)}</span> },
            { key: 'not_after', header: 'Expires' },
            { key: 'days_to_expiry', header: 'Days Left', align: 'right',
              cell: (r) => {
                const d = r.days_to_expiry
                if (d == null) return <span className="text-gray-300">—</span>
                const cls = d < 0 ? 'text-rose-600 font-semibold' : d < 30 ? 'text-amber-600 font-medium' : 'text-gray-600'
                return <span className={`tabular-nums ${cls}`}>{d < 0 ? `expired ${-d}d` : d}</span>
              } },
            { key: 'usages', header: 'Used By', sortable: false,
              sortValue: (r) => arr(r.usages).length,
              cell: (r) => {
                const u = arr(r.usages)
                if (!u.length) return <span className="text-gray-300">unused</span>
                return (
                  <span className="text-[11px] text-gray-600">
                    {u.slice(0, 3).map((x, i) => (
                      <span key={i} className="inline-block mr-2">
                        {x.type}{x.profile && x.profile !== 'None' ? ` · ${leaf(x.profile)}` : ''}
                      </span>
                    ))}
                    {u.length > 3 && <span className="text-gray-400">+{u.length - 3}</span>}
                  </span>
                )
              } },
          ]}
          rows={certRows} emptyText="No certificates." />
      </Section>

      <Section title="Self IPs" count={selfRows.length}>
        <AuditTable pageSize={25} density="compact" searchable={false} defaultSortKey="self_ip"
          columns={[
            { key: 'self_ip', header: 'Self IP' },
            { key: 'address', header: 'Address' },
            { key: 'vlan', header: 'VLAN' },
            { key: 'traffic-group', header: 'Traffic Group' },
            { key: 'allow-service', header: 'Allow Service',
              cell: (r) => arr(r['allow-service']).join(', ') || '—' },
          ]}
          rows={selfRows} emptyText="No self IPs." />
      </Section>

      <Section title="Provisioned Modules" count={modRows.length}>
        <AuditTable pageSize={25} density="compact" searchable={false} defaultSortKey="module"
          columns={[
            { key: 'module', header: 'Module' },
            { key: 'level', header: 'Provision Level' },
          ]}
          rows={modRows} emptyText="No modules provisioned." />
      </Section>

      <Section title="iRules" count={ruleRows.length}>
        <AuditTable pageSize={25} density="compact" defaultSortKey="name"
          columns={[
            { key: 'name', header: 'iRule', cell: (r) => <span className={mono}>{r.name}</span> },
          ]}
          rows={ruleRows} emptyText="No iRules." />
      </Section>

      {drawer?.kind === 'vs' && <VsDrawer row={drawer.row} onClose={() => setDrawer(null)} />}
      {drawer?.kind === 'pool' && <PoolDrawer row={drawer.row} onClose={() => setDrawer(null)} />}
      {drawer?.kind === 'profile' && <ProfileDrawer row={drawer.row} subtitle={drawer.subtitle} onClose={() => setDrawer(null)} />}
    </div>
  )
}
