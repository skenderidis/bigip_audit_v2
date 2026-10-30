import { create } from 'zustand'

const useSubTabStore = create((set) => ({
  content: null,
  setSubTab: (content) => set({ content }),
  clearSubTab: () => set({ content: null }),
}))

export default useSubTabStore
