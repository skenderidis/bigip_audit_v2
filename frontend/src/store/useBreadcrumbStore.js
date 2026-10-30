import { create } from 'zustand'

const useBreadcrumbStore = create((set) => ({
  deviceName: null,
  policyName: null,
  setDeviceName: (name) => set({ deviceName: name }),
  setPolicyName: (name) => set({ policyName: name }),
  clear: () => set({ deviceName: null, policyName: null }),
}))

export default useBreadcrumbStore
