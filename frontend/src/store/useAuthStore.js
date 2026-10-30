import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('waf_token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('waf_token')
        set({ user: null, token: null })
      },
    }),
    { name: 'waf-auth' }
  )
)

export default useAuthStore
