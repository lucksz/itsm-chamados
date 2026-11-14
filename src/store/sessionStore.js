import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const PERSONA_IDS = {
  consultant: 'ae4d6fdf-bd5b-4fe0-879a-f86c41012b99',
  manager: '875d257a-0dff-4428-a233-5332d0e67b86',
  customer: '56d2d480-1bd4-4e12-93cd-61db0bdf21e6',
}

export const useSessionStore = create(persist(
  (set) => ({
    userId: PERSONA_IDS.consultant,
    setUserId: (userId) => set({ userId }),
  }),
  { name: 'itsm-demo-session-v1', partialize: (state) => ({ userId: state.userId }) },
))
