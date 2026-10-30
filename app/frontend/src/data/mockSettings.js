export const users = [
  { id: 1, username: 'admin',   email: 'admin@company.com',   role: 'admin',    status: 'active',   lastLogin: '2026-06-08T09:00:00Z', mfaEnabled: true },
  { id: 2, username: 'jsmith',  email: 'jsmith@company.com',  role: 'operator', status: 'active',   lastLogin: '2026-06-08T08:00:00Z', mfaEnabled: false },
  { id: 3, username: 'mwilson', email: 'mwilson@company.com', role: 'operator', status: 'active',   lastLogin: '2026-06-06T10:00:00Z', mfaEnabled: false },
  { id: 4, username: 'lbrown',  email: 'lbrown@company.com',  role: 'viewer',   status: 'active',   lastLogin: '2026-05-30T14:00:00Z', mfaEnabled: false },
  { id: 5, username: 'svc-ci',  email: 'ci@company.com',      role: 'api',      status: 'active',   lastLogin: '2026-06-08T06:00:00Z', mfaEnabled: true },
  { id: 6, username: 'tlee',    email: 'tlee@company.com',    role: 'viewer',   status: 'inactive', lastLogin: '2026-04-10T09:00:00Z', mfaEnabled: false },
]

export const roles = [
  { value: 'admin',    label: 'Admin',    description: 'Full access — manage devices, policies, users' },
  { value: 'operator', label: 'Operator', description: 'Deploy and edit policies, cannot manage users' },
  { value: 'viewer',   label: 'Viewer',   description: 'Read-only access to all resources' },
  { value: 'api',      label: 'API',      description: 'Service account for automation/CI' },
]

export const deviceConnections = [
  {
    id: 'bigip-us-01',
    name: 'bigip-us-01',
    ip: '10.10.1.101',
    port: 443,
    dc: 'us-east',
    username: 'admin',
    status: 'online',
    sslVerify: true,
    lastSeen: '2026-06-08T10:28:00Z',
    version: 'BIG-IP 17.1.1',
  },
  {
    id: 'bigip-eu-02',
    name: 'bigip-eu-02',
    ip: '10.20.1.102',
    port: 443,
    dc: 'eu-west',
    username: 'admin',
    status: 'online',
    sslVerify: true,
    lastSeen: '2026-06-08T10:25:00Z',
    version: 'BIG-IP 17.0.0',
  },
  {
    id: 'bigip-ap-01',
    name: 'bigip-ap-01',
    ip: '10.30.1.50',
    port: 443,
    dc: 'ap-south',
    username: 'admin',
    status: 'offline',
    sslVerify: false,
    lastSeen: '2026-06-05T08:00:00Z',
    version: 'BIG-IP 16.1.4',
  },
  {
    id: 'bigip-us-02',
    name: 'bigip-us-02',
    ip: '10.10.1.102',
    port: 443,
    dc: 'us-west',
    username: 'admin',
    status: 'online',
    sslVerify: true,
    lastSeen: '2026-06-08T10:27:00Z',
    version: 'BIG-IP 17.1.1',
  },
]

export const generalSettings = {
  appName: 'WAF Manager',
  syncIntervalMinutes: 15,
  sessionTimeoutMinutes: 480,
  mfaRequired: false,
  notificationsEmail: 'waf-alerts@company.com',
  retentionDays: 90,
}
