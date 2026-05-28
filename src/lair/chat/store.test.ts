import { beforeEach, describe, expect, it } from "vitest";
import { mockChatTransport } from "@/lair/chat/transports/mockTransport";
import { useLairChat } from "@/lair/chat/store";

describe("useLairChat", () => {
  beforeEach(() => {
    useLairChat.setState({
      activeChatId: null,
      chats: [],
    });
  });

  it("creates one chat per id and makes it active", () => {
    const first = useLairChat.getState().ensureChat({
      id: "dashboard",
      title: "Dashboard",
      type: "dashboard",
      scope: { kind: "dashboard" },
    });
    const second = useLairChat.getState().ensureChat({
      id: "dashboard",
      title: "Dashboard",
      type: "dashboard",
      scope: { kind: "dashboard" },
    });

    expect(first).toBe("dashboard");
    expect(second).toBe("dashboard");
    expect(useLairChat.getState().chats).toHaveLength(1);
    expect(useLairChat.getState().activeChatId).toBe("dashboard");
  });

  it("creates assistant placeholder and run card before transport completes", async () => {
    const chatId = useLairChat.getState().ensureChat({
      id: "simple",
      title: "Simple task",
      type: "simple",
      scope: { kind: "workspace", repoPath: "C:/repo" },
    });

    const pending = useLairChat
      .getState()
      .sendMessage(chatId, "Plan the work", mockChatTransport);

    const running = useLairChat.getState().chats[0];
    expect(running.messages).toHaveLength(2);
    expect(running.messages[1]?.role).toBe("assistant");
    expect(running.messages[1]?.status).toBe("streaming");
    expect(running.runCards).toHaveLength(1);
    expect(running.runCards[0]?.status).toBe("running");

    await pending;

    const complete = useLairChat.getState().chats[0];
    expect(complete.messages[1]?.content).toContain("Mock response");
    expect(complete.messages[1]?.status).toBe("complete");
    expect(complete.runCards[0]?.status).toBe("complete");
    expect(complete.agentState.kind).toBe("locked");
  });
});
