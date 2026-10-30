import { useState, useEffect, useMemo } from 'react'
import { Card } from '../components/ui'
import { refThreatCampaigns } from '../api/reference'

// Read-only Threat Campaigns view: policy settings + the campaigns the policy
// configures, enriched (description) from the bundled reference.
function SettingRow({ k, children }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-800 font-medium">{children}</span>
    </div>
  )
}

export default function ThreatCampaignsSection({ policy }) {
  const settings = policy['threat-campaign-settings'] || {}
  const polTCs = policy['threat-campaigns'] || []
  const [ref, setRef] = useState([])

  useEffect(() => { refThreatCampaigns().then(setRef).catch(() => setRef([])) }, [])
  const refMap = useMemo(() => Object.fromEntries(ref.map(t => [t.name, t])), [ref])

  const status = (tc) => tc.isEnabled === false ? 'Disabled' : 'Enforced'
  const statusColor = (st) => st === 'Disabled' ? 'text-red-500' : 'text-green-700'

  return (
    <div className="space-y-3">
      <Card>
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Threat campaign settings</div>
        <div className="px-4 py-2">
          {'isEnabled' in settings && <SettingRow k="Enabled">{settings.isEnabled ? 'Yes' : 'No'}</SettingRow>}
          <SettingRow k="Staging">{settings.threatCampaignStaging ? 'On' : 'Off'}</SettingRow>
          {settings.threatCampaignEnforcementReadinessPeriod != null &&
            <SettingRow k="Enforcement readiness period">{settings.threatCampaignEnforcementReadinessPeriod} days</SettingRow>}
          <SettingRow k="Reference catalog">{ref.length} campaigns bundled</SettingRow>
        </div>
      </Card>

      <Card>
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">
          Threat campaigns <span className="text-gray-400 font-normal">({polTCs.length})</span>
        </div>
        {polTCs.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">No threat-campaign overrides on this policy.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 font-medium w-56">Campaign</th>
                <th className="px-3 py-2 font-medium w-24">Status</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {polTCs.map((tc, i) => {
                const st = status(tc)
                const meta = refMap[tc.name]
                return (
                  <tr key={i} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {tc.name === '*' ? <span className="text-gray-600">All campaigns (wildcard)</span> : tc.name}
                    </td>
                    <td className={`px-3 py-2 font-medium ${statusColor(st)}`}>{st}</td>
                    <td className="px-3 py-2 text-gray-500">{meta?.description || (tc.name === '*' ? 'Applies to every campaign in the catalog.' : '—')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
