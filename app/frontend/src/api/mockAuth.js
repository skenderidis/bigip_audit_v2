// Mock credentials for frontend-only development (no backend required)
const MOCK_USERS = [
  { username: 'admin', password: 'Admin1234!', role: 'admin', email: 'admin@company.com' },
]

export function mockLogin(username, password) {
  const user = MOCK_USERS.find(u => u.username === username && u.password === password)
  if (!user) return null
  return {
    access_token: 'mock-token-' + Date.now(),
    user: { id: 1, username: user.username, email: user.email, role: user.role, mfa_enabled: false },
  }
}
