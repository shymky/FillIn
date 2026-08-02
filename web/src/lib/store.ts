"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Card, Settings } from "./types";
import { mockCards } from "./mock-data";

type CardStore = {
  cards: Card[];
  addCard: (card: Card) => void;
  updateCard: (id: string, patch: Partial<Card>) => void;
  removeCard: (id: string) => void;
  replaceAll: (cards: Card[]) => void;
  duplicateCard: (id: string) => void;
};

export const useCardStore = create<CardStore>()(
  persist(
    (set) => ({
      cards: mockCards,
      addCard: (card) => set((s) => ({ cards: [card, ...s.cards] })),
      updateCard: (id, patch) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCard: (id) =>
        set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
      replaceAll: (cards) => set({ cards }),
      duplicateCard: (id) =>
        set((s) => {
          const card = s.cards.find((c) => c.id === id);
          if (!card) return s;
          const now = new Date().toISOString();
          const copy: Card = {
            ...card,
            id: `dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: now,
            updatedAt: now,
          };
          const idx = s.cards.findIndex((c) => c.id === id);
          const next = [...s.cards];
          next.splice(idx + 1, 0, copy);
          return { cards: next };
        }),
    }),
    {
      name: "fillin2-cards",
      version: 3,
      migrate: (persisted) => {
        const existing: Card[] =
          (persisted as { cards?: Card[] } | undefined)?.cards ?? [];
        const existingIds = new Set(existing.map((c) => c.id));
        const toAdd = mockCards.filter((c) => !existingIds.has(c.id));
        return { cards: [...toAdd, ...existing] };
      },
    },
  ),
);

const defaultSettings: Settings = {
  clozeRate: 0.4,
  pronunciationTolerance: 0.6,
  ttsVoice: "en-US-JennyNeural",
  sttLang: "en-US",
  ollamaModel: "llama3.2",
  difficulty: "normal",
  listeningRepeat: 3,
  accentColor: "#2F8459",
  accentColorDark: "#3FA26E",
  ttsRate: 1.0,
};

type SettingsStore = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      reset: () => set({ settings: defaultSettings }),
    }),
    {
      name: "fillin2-settings",
      version: 2,
      migrate: (persisted) => {
        const s = (persisted as { settings?: Partial<Settings> } | undefined)
          ?.settings;
        return { settings: { ...defaultSettings, ...(s ?? {}) } };
      },
    },
  ),
);

export type SessionFilter = "all" | "due" | "unmastered" | "new";
export type SessionLimit = 5 | 10 | 20 | 50 | 100 | "endless";
export type ListeningMode = "en_only" | "ja_en";
export type ListeningRepeat = 1 | 2 | 3 | 5 | 10 | "endless";

export type SessionConfig = {
  tag: string;
  filter: SessionFilter;
  limit: SessionLimit;
  shuffle: boolean;
  /** Listening-only: whether to precede each English playback with Japanese */
  listeningMode?: ListeningMode;
  /** Listening-only: repeat count per card */
  listeningRepeat?: ListeningRepeat;
  /** Listening-only: blur English text until EN phase plays */
  hideEnglish?: boolean;
  /** Listening-only: blur Japanese text until JA phase plays */
  hideJapanese?: boolean;
  /** Listening-only: seconds of silence between JA and EN (0 = off) */
  delayBeforeEnglish?: number;
  /** Listening-only: loop the whole playlist after the last card */
  listeningLoopPlaylist?: boolean;
  /** Listening-only: loop the current card (card-loop button initial state) */
  listeningCardLoop?: boolean;
  /** Listening-only: fraction of words to hide (0 = off, 25/50/75/100) */
  listeningHidePercent?: number;
  /** Listening-only: how to apply word hiding */
  listeningHideMode?: "fixed" | "progressive" | "reveal";
  /** Listening-only (ja_en): play Japanese on every repeat or only the first */
  jaPlayMode?: "every" | "first_only";
};

const defaultQuizSession: SessionConfig = {
  tag: "__all__",
  filter: "all",
  limit: 20,
  shuffle: true,
};

const defaultListeningSession: SessionConfig = {
  tag: "__all__",
  filter: "all",
  limit: "endless",
  shuffle: true,
  listeningMode: "en_only",
  listeningRepeat: 3,
  hideEnglish: false,
  hideJapanese: false,
  delayBeforeEnglish: 0,
  listeningLoopPlaylist: false,
  listeningCardLoop: false,
  listeningHidePercent: 0,
  listeningHideMode: "fixed",
  jaPlayMode: "every",
};

type SessionStore = {
  quiz: SessionConfig;
  listening: SessionConfig;
  setQuiz: (patch: Partial<SessionConfig>) => void;
  setListening: (patch: Partial<SessionConfig>) => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      quiz: defaultQuizSession,
      listening: defaultListeningSession,
      setQuiz: (patch) => set((s) => ({ quiz: { ...s.quiz, ...patch } })),
      setListening: (patch) =>
        set((s) => ({ listening: { ...s.listening, ...patch } })),
    }),
    {
      name: "fillin2-session",
      version: 3,
      migrate: (persisted) => {
        const s = persisted as {
          quiz?: Partial<SessionConfig>;
          listening?: Partial<SessionConfig>;
        } | undefined;
        return {
          quiz: { ...defaultQuizSession, ...(s?.quiz ?? {}) },
          listening: { ...defaultListeningSession, ...(s?.listening ?? {}) },
        };
      },
    },
  ),
);

// Non-persisted: active listening session state.
// Lives in zustand (not React useState) so it survives route navigation/caching.
type ListeningSessionStore = {
  sessionIds: string[] | null;
  sessionTag: string;
  setSession: (ids: string[], tag: string) => void;
  clearSession: () => void;
};

export const useListeningSessionStore = create<ListeningSessionStore>()((set) => ({
  sessionIds: null,
  sessionTag: "__all__",
  setSession: (ids, tag) => set({ sessionIds: ids, sessionTag: tag }),
  clearSession: () => set({ sessionIds: null, sessionTag: "__all__" }),
}));

// Cross-store subscription: runs even when ListeningPage is unmounted.
// Whenever cards change, auto-append new IDs that match the active session's tag.
useCardStore.subscribe((state, prevState) => {
  if (state.cards === prevState.cards) return;
  const session = useListeningSessionStore.getState();
  if (!session.sessionIds) return;
  const sessionSet = new Set(session.sessionIds);
  const tag = session.sessionTag;
  const newIds = state.cards
    .filter((c) => !sessionSet.has(c.id))
    .filter((c) => tag === "__all__" || c.tags.includes(tag))
    .map((c) => c.id);
  if (newIds.length === 0) return;
  useListeningSessionStore.setState({ sessionIds: [...session.sessionIds, ...newIds] });
});

type UiStore = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "fillin2-ui" },
  ),
);
