import { create } from 'zustand'

export const useDraftStore = create((set) => ({
  drafts: {},
  internalNotes: {},
  setDraft: (key, value) => set((state) => ({ drafts: { ...state.drafts, [key]: value } })),
  clearDraft: (key) => set((state) => {
    const drafts = { ...state.drafts }
    delete drafts[key]
    return { drafts }
  }),
  setInternalNote: (key, value) => set((state) => ({ internalNotes: { ...state.internalNotes, [key]: value } })),
  clearAll: () => set({ drafts: {}, internalNotes: {} }),
}))
