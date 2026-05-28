import { create } from "zustand";
import { mockChatTransport } from "@/lair/chat/transports/mockTransport";
import type {
  AgentState,
  ChatMessage,
  ChatRunCard,
  ChatScope,
  ChatTransport,
  ChatType,
  LairChatSession,
} from "@/lair/chat/types";

interface EnsureChatInput {
  id: string;
  title: string;
  type: ChatType;
  scope: ChatScope;
}

interface LairChatStore {
  chats: LairChatSession[];
  activeChatId: string | null;
  ensureChat: (input: EnsureChatInput) => string;
  setActiveChat: (id: string) => void;
  activeChat: () => LairChatSession | undefined;
  sendMessage: (
    chatId: string,
    content: string,
    transport?: ChatTransport,
  ) => Promise<void>;
  stopChat: (chatId: string) => void;
}

const controllers = new Map<string, AbortController>();

function now(): number {
  return Date.now();
}

function id(prefix: string): string {
  return `${prefix}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function updateChat(
  chats: LairChatSession[],
  chatId: string,
  update: (chat: LairChatSession) => LairChatSession,
): LairChatSession[] {
  return chats.map((chat) => (chat.id === chatId ? update(chat) : chat));
}

export const useLairChat = create<LairChatStore>((set, get) => ({
  chats: [],
  activeChatId: null,
  ensureChat: (input) => {
    const existing = get().chats.find((chat) => chat.id === input.id);
    if (existing) {
      set({ activeChatId: existing.id });
      return existing.id;
    }
    const ts = now();
    const chat: LairChatSession = {
      id: input.id,
      title: input.title,
      type: input.type,
      scope: input.scope,
      createdAt: ts,
      updatedAt: ts,
      agentState: { kind: "idle" },
      messages: [],
      runCards: [],
    };
    set((state) => ({
      chats: [...state.chats, chat],
      activeChatId: chat.id,
    }));
    return chat.id;
  },
  setActiveChat: (chatId) => {
    if (get().chats.some((chat) => chat.id === chatId)) {
      set({ activeChatId: chatId });
    }
  },
  activeChat: () => {
    const { chats, activeChatId } = get();
    return chats.find((chat) => chat.id === activeChatId);
  },
  sendMessage: async (chatId, rawContent, transport = mockChatTransport) => {
    const content = rawContent.trim();
    if (!content) return;
    const chat = get().chats.find((item) => item.id === chatId);
    if (!chat) return;

    controllers.get(chatId)?.abort();
    const controller = new AbortController();
    controllers.set(chatId, controller);

    const ts = now();
    const userMessage: ChatMessage = {
      id: id("msg"),
      role: "user",
      content,
      createdAt: ts,
      status: "complete",
    };
    const assistantMessage: ChatMessage = {
      id: id("msg"),
      role: "assistant",
      content: "",
      createdAt: ts,
      status: "streaming",
    };
    const runCard: ChatRunCard = {
      id: id("run"),
      messageId: assistantMessage.id,
      type: "thinking",
      status: "running",
      title: "Thinking",
      detail: "Preparing response.",
      createdAt: ts,
      updatedAt: ts,
    };

    set((state) => ({
      chats: updateChat(state.chats, chatId, (item) => ({
        ...item,
        updatedAt: ts,
        agentState:
          item.agentState.kind === "locked"
            ? item.agentState
            : { kind: "orchestrating" },
        messages: [...item.messages, userMessage, assistantMessage],
        runCards: [...item.runCards, runCard],
      })),
    }));

    const events = {
      appendAssistant: (chunk: string) =>
        set((state) => ({
          chats: updateChat(state.chats, chatId, (item) => ({
            ...item,
            updatedAt: now(),
            messages: item.messages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: message.content + chunk }
                : message,
            ),
          })),
        })),
      updateRunCard: (cardId: string, patch: Partial<ChatRunCard>) =>
        set((state) => ({
          chats: updateChat(state.chats, chatId, (item) => ({
            ...item,
            updatedAt: now(),
            runCards: item.runCards.map((card) =>
              card.id === cardId ? { ...card, ...patch, updatedAt: now() } : card,
            ),
          })),
        })),
      setAgentState: (agentState: AgentState) =>
        set((state) => ({
          chats: updateChat(state.chats, chatId, (item) => ({
            ...item,
            agentState,
            updatedAt: now(),
          })),
        })),
    };

    try {
      await transport.run(
        {
          chat,
          userMessage,
          assistantMessage,
          runCard,
        },
        events,
        controller.signal,
      );
      set((state) => ({
        chats: updateChat(state.chats, chatId, (item) => ({
          ...item,
          messages: item.messages.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, status: controller.signal.aborted ? "stopped" : "complete" }
              : message,
          ),
          runCards: item.runCards.map((card) =>
            card.id === runCard.id && controller.signal.aborted
              ? { ...card, status: "stopped", updatedAt: now() }
              : card,
          ),
          updatedAt: now(),
        })),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        chats: updateChat(state.chats, chatId, (item) => ({
          ...item,
          agentState: { kind: "error", message },
          messages: item.messages.map((entry) =>
            entry.id === assistantMessage.id
              ? { ...entry, content: message, status: "error" }
              : entry,
          ),
          runCards: item.runCards.map((card) =>
            card.id === runCard.id
              ? { ...card, status: "error", title: "Error", detail: message, updatedAt: now() }
              : card,
          ),
          updatedAt: now(),
        })),
      }));
    } finally {
      if (controllers.get(chatId) === controller) controllers.delete(chatId);
    }
  },
  stopChat: (chatId) => {
    controllers.get(chatId)?.abort();
  },
}));
