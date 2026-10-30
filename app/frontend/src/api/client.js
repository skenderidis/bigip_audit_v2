import axios from 'axios'

// Same-origin by default: the browser calls /api on whatever host/port served
// the page, and the Vite dev server proxies /api to the backend (vite.config.js).
// Only the frontend port needs to be reachable. Set VITE_API_URL to a
// fully-qualified URL to bypass the proxy.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('waf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || ''
    const isLoginRequest  = url.includes('/api/auth/login')
    const isDeviceProbe   = url.includes('/api/devices/test-connection') || url.includes('/api/devices/list-policies')
    if (err.response?.status === 401 && !isLoginRequest && !isDeviceProbe) {
      localStorage.removeItem('waf_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
