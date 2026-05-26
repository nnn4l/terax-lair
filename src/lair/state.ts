import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AgentChoice,
  CardData,
  ChecklistData,
  AutopilotMode,
  ModelInfo,
  NarrationLine,
  Phase,
  QueueItem,
  StaleReport,
  Turn,
  LairSession,
} from "@/lair/types";

interface LairState {
  cards: CardData[];
  narrations: NarrationLine[];
  turns: Turn[];
  sessions: LairSession[];
  activeSessionId: string | null;
  currentTurnId: string | null;
  phase: Phase;
  agentChoice: AgentChoice;
  workspace: string;
  claudeModel: string | null;
  codexModel: string | null;
  claudeEffort: string | null;
  codexEffort: string | null;
  checklist: ChecklistData | null;
  queue: QueueItem[];
  cursor: { itemId: string | null; pinned: boolean };
  autopilot: {
    mode: AutopilotMode;
    paused: boolean;
    stopOnFailure: boolean;
  };
  staleReports: StaleReport[];
  staleSpecFile: string | null;
  models: ModelInfo[];
  modelsFetchedAt: number;

  upsertCard: (card: CardData, turnId?: string) => void;
  appendChunk: (id: string, chunk: string) => void;
  clearCards: () => void;
  setPhase: (phase: Phase) => void;
  setAgentChoice: (agentChoice: AgentChoice) => void;
  setWorkspace: (workspace: string) => void;
  setClaudeModel: (model: string | null) => void;
  setCodexModel: (model: string | null) => void;
  setClaudeEffort: (effort: string | null) => void;
  setCodexEffort: (effort: string | null) => void;
  addNarration: (line: NarrationLine) => void;
  setChecklist: (data: ChecklistData) => void;
  setQueue: (queue: QueueItem[]) => void;
  setCursor: (itemId: string | null, pinned?: boolean) => void;
  setAutopilotMode: (mode: AutopilotMode) => void;
  setAutopilotPaused: (paused: boolean) => void;
  setStopOnFailure: (stopOnFailure: boolean) => void;
  setStaleReports: (reports: StaleReport[], specFile?: string | null) => void;
  setModels: (models: ModelInfo[]) => void;
  newSession: (title?: string) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  startTurn: (prompt: string) => string;
  attachCardIds: (turnId: string, ids: string[]) => void;
}

function createId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateSession(
  state: LairState,
  sessionId: string | null,
  patch: (session: LairSession) => LairSession,
): LairSession[] {
  if (!sessionId) return state.sessions;
  return state.sessions.map((session) =>
    session.id === sessionId ? patch(session) : session,
  );
}

function titleFromPrompt(prompt: string): string {
  const oneLine = prompt.replace(/\s+/g, " ").trim();
  return oneLine.length > 34 ? `${oneLine.slice(0, 34)}...` : oneLine;
}

export const useLair = create<LairState>()(
  persist(
    (set) => ({
      cards: [],
      narrations: [],
      turns: [],
      sessions: [],
      activeSessionId: null,
      currentTurnId: null,
      phase: "implement",
      agentChoice: "codex",
      workspace: "",
      claudeModel: null,
      codexModel: null,
      claudeEffort: null,
      codexEffort: null,
      checklist: null,
      queue: [],
      cursor: { itemId: null, pinned: false },
      autopilot: { mode: "task", paused: false, stopOnFailure: true },
      staleReports: [],
      staleSpecFile: null,
      models: [],
      modelsFetchedAt: 0,

      upsertCard: (card, turnId) =>
        set((state) => {
          const idx = state.cards.findIndex((c) => c.id === card.id);
          const cards = idx === -1 ? [...state.cards, card] : [...state.cards];
          if (idx !== -1) cards[idx] = card;
          const turns = turnId
            ? state.turns.map((t) =>
                t.id === turnId && !t.cardIds.includes(card.id)
                  ? { ...t, cardIds: [...t.cardIds, card.id] }
                  : t,
              )
            : state.turns;
          const sessions = updateSession(
            { ...state, cards, turns },
            state.activeSessionId,
            (session) => ({
              ...session,
              cards,
              turns,
              turnIds: turns.map((t) => t.id),
              updatedAt: Date.now(),
            }),
          );
          return { cards, turns, sessions };
        }),

      appendChunk: (id, chunk) =>
        set((state) => {
          const idx = state.cards.findIndex((c) => c.id === id);
          if (idx === -1) return state;
          const cards = [...state.cards];
          cards[idx] = {
            ...cards[idx],
            raw_output: cards[idx].raw_output + chunk,
          };
          const sessions = updateSession(
            { ...state, cards },
            state.activeSessionId,
            (session) => ({ ...session, cards, updatedAt: Date.now() }),
          );
          return { cards, sessions };
        }),

      clearCards: () =>
        set((state) => ({
          cards: [],
          narrations: [],
          turns: [],
          currentTurnId: null,
          sessions: updateSession(state, state.activeSessionId, (session) => ({
            ...session,
            cards: [],
            narrations: [],
            turns: [],
            turnIds: [],
            updatedAt: Date.now(),
          })),
        })),
      setPhase: (phase) =>
        set((state) => ({
          phase,
          sessions: updateSession(state, state.activeSessionId, (session) => ({
            ...session,
            phase,
            updatedAt: Date.now(),
          })),
        })),
      setAgentChoice: (agentChoice) =>
        set((state) => ({
          agentChoice,
          sessions: updateSession(state, state.activeSessionId, (session) => ({
            ...session,
            agentChoice,
            updatedAt: Date.now(),
          })),
        })),
      setWorkspace: (workspace) =>
        set((state) => ({
          workspace,
          sessions: updateSession(state, state.activeSessionId, (session) => ({
            ...session,
            workspace,
            updatedAt: Date.now(),
          })),
        })),
      setClaudeModel: (claudeModel) => set({ claudeModel }),
      setCodexModel: (codexModel) => set({ codexModel }),
      setClaudeEffort: (claudeEffort) => set({ claudeEffort }),
      setCodexEffort: (codexEffort) => set({ codexEffort }),
      addNarration: (line) =>
        set((state) => {
          const turns = state.currentTurnId
            ? state.turns.map((t) =>
                t.id === state.currentTurnId
                  ? { ...t, narrationIds: [...t.narrationIds, line.id] }
                  : t,
              )
            : state.turns;
          const narrations = [...state.narrations, line];
          const sessions = updateSession(
            { ...state, narrations, turns },
            state.activeSessionId,
            (session) => ({
              ...session,
              narrations,
              turns,
              updatedAt: Date.now(),
            }),
          );
          return { narrations, turns, sessions };
        }),
      setChecklist: (checklist) => set({ checklist }),
      setQueue: (queue) => set({ queue }),
      setCursor: (itemId, pinned) =>
        set((state) => ({
          cursor: { itemId, pinned: pinned ?? state.cursor.pinned },
        })),
      setAutopilotMode: (mode) =>
        set((state) => ({ autopilot: { ...state.autopilot, mode } })),
      setAutopilotPaused: (paused) =>
        set((state) => ({ autopilot: { ...state.autopilot, paused } })),
      setStopOnFailure: (stopOnFailure) =>
        set((state) => ({
          autopilot: { ...state.autopilot, stopOnFailure },
        })),
      setStaleReports: (staleReports, staleSpecFile = null) =>
        set({ staleReports, staleSpecFile }),
      setModels: (models) =>
        set({ models, modelsFetchedAt: Date.now() }),
      newSession: (title) => {
        const now = Date.now();
        const id = createId("s");
        set((state) => {
          const session: LairSession = {
            id,
            title: title ?? "New chat",
            createdAt: now,
            updatedAt: now,
            workspace: state.workspace,
            phase: state.phase,
            agentChoice: state.agentChoice,
            turnIds: [],
            turns: [],
            cards: [],
            narrations: [],
            worktreePath: null,
          };
          return {
            sessions: [...state.sessions, session],
            activeSessionId: id,
            currentTurnId: null,
            turns: [],
            cards: [],
            narrations: [],
          };
        });
        return id;
      },
      switchSession: (id) =>
        set((state) => {
          const session = state.sessions.find((s) => s.id === id);
          if (!session) return state;
          return {
            activeSessionId: id,
            workspace: session.workspace,
            phase: session.phase,
            agentChoice: session.agentChoice,
            turns: session.turns,
            cards: session.cards,
            narrations: session.narrations,
            currentTurnId: session.turns[session.turns.length - 1]?.id ?? null,
          };
        }),
      deleteSession: (id) =>
        set((state) => {
          const sessions = state.sessions.filter((s) => s.id !== id);
          const next = sessions[0] ?? null;
          return {
            sessions,
            activeSessionId: next?.id ?? null,
            workspace: next?.workspace ?? state.workspace,
            phase: next?.phase ?? state.phase,
            agentChoice: next?.agentChoice ?? state.agentChoice,
            turns: next?.turns ?? [],
            cards: next?.cards ?? [],
            narrations: next?.narrations ?? [],
            currentTurnId: next?.turns[(next?.turns.length ?? 0) - 1]?.id ?? null,
          };
        }),
      renameSession: (id, title) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? { ...session, title: title.trim() || "New chat" }
              : session,
          ),
        })),
      startTurn: (prompt) => {
        const id = createId("t");
        set((state) => ({
          turns: [
            ...state.turns,
            {
              id,
              prompt,
              startedAt: Date.now(),
              cardIds: [],
              narrationIds: [],
            },
          ],
          currentTurnId: id,
          sessions: updateSession(state, state.activeSessionId, (session) => {
            const turns = [
              ...state.turns,
              {
                id,
                prompt,
                startedAt: Date.now(),
                cardIds: [],
                narrationIds: [],
              },
            ];
            return {
              ...session,
              title:
                session.title === "New chat"
                  ? titleFromPrompt(prompt)
                  : session.title,
              turns,
              turnIds: turns.map((t) => t.id),
              updatedAt: Date.now(),
            };
          }),
        }));
        return id;
      },
      attachCardIds: (turnId, ids) =>
        set((state) => {
          const turns = state.turns.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  cardIds: [...new Set([...t.cardIds, ...ids])],
                }
              : t,
          );
          return {
            turns,
            sessions: updateSession(
              { ...state, turns },
              state.activeSessionId,
              (session) => ({
                ...session,
                turns,
                updatedAt: Date.now(),
              }),
            ),
          };
        }),
    }),
    {
      name: "lair-state",
      partialize: (state) => ({
        cards: state.cards,
        narrations: state.narrations,
        turns: state.turns,
        currentTurnId: state.currentTurnId,
        phase: state.phase,
        agentChoice: state.agentChoice,
        workspace: state.workspace,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        claudeModel: state.claudeModel,
        codexModel: state.codexModel,
        claudeEffort: state.claudeEffort,
        codexEffort: state.codexEffort,
        models: state.models,
        modelsFetchedAt: state.modelsFetchedAt,
      }),
    },
  ),
);
