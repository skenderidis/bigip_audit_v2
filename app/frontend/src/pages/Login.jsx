import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import api from '../api/client'
import { mockLogin } from '../api/mockAuth'
import useAuthStore from '../store/useAuthStore'
import f5Logo from '../assets/f5-logo.svg'

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = username.trim() !== '' && password !== '' && !loading

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/auth/login', { username, password })
      const { access_token, user } = res.data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.username}`)
      navigate('/')
    } catch (err) {
      // Backend unreachable — fall back to mock credentials for frontend dev
      if (!err.response) {
        const mock = mockLogin(username, password)
        if (mock) {
          setAuth(mock.user, mock.access_token)
          toast.success(`Welcome back, ${mock.user.username}`)
          navigate('/')
          return
        }
        setError('Invalid username or password')
        return
      }
      const detail = err.response?.data?.detail
      setError(detail || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-4">
          <img src={f5Logo} alt="F5" className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Audit for BIGIP</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

        <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-500 mb-1">Username</label>
              <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                autoComplete="username" />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1">Password</label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                autoComplete="current-password" />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button type="submit" disabled={!canSubmit}
              className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-gray-400 text-xs mt-6">Audit for BIGIP v2.1.0 · Restricted access</p>
      </div>
    </div>
  )
}
