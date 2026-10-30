import api from './client'

export const changePassword = (current_password, new_password) =>
  api.post('/api/auth/change-password', { current_password, new_password }).then(r => r.data)
