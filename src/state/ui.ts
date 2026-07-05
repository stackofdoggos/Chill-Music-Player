import { create } from 'zustand'

export type TopMenu = 'none' | 'settings' | 'light'

export const useUi = create<{
  activeMenu: TopMenu
  setActiveMenu: (m: TopMenu) => void
  toggleMenu: (m: Exclude<TopMenu, 'none'>) => void
}>((set, get) => ({
  activeMenu: 'none',
  setActiveMenu: (m) => set({ activeMenu: m }),
  toggleMenu: (m) => set({ activeMenu: get().activeMenu === m ? 'none' : m }),
}))
