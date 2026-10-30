import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { Btn } from './ui'
import { changePassword } from '../api/account'

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (next !== confirm) { toast.error('New passwords do not match'); return }
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setSaving(true)
    try {
      await changePassword(current, next)
      toast.success('Password changed')
      onClose()
    } catch (e) {
      const d = e.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full text-sm px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300'

  return (
    <Modal title="Change password" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
          <input type="password" className={field} value={current} autoComplete="current-password"
            onChange={e => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
          <input type="password" className={field} value={next} autoComplete="new-password"
            onChange={e => setNext(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
          <input type="password" className={field} value={confirm} autoComplete="new-password"
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || !current || !next || !confirm}>
            {saving ? 'Saving…' : 'Change password'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
