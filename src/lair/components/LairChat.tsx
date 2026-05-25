import { useEffect, useRef, useState } from "react";
import { sendMessage, onCardUpdate, onStreamChunk } from "@/lair/api";
import { useLair } from "@/lair/state";
import { AgentDropdown } from "@/lair/components/AgentDropdown";
import { Card } from "@/lair/components/Card";
import { PhaseDropdown } from "@/lair/components/PhaseDropdown";

export function LairChat() {
  const cards = useLair((state) => state.cards);
  const upsertCard = useLair((state) => state.upsertCard);
  const appendChunk = useLair((state) => state.appendChunk);
  const workspace = useLair((state) => state.workspace);
  const phase = useLair((state) => state.phase);
  const agentChoice = useLair((state) => state.agentChoice);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const canSend = text.trim().length > 0 && !sending;

  useEffect(() => {
    const cardUpdate = onCardUpdate((event) => upsertCard(event.card));
    const streamChunk = onStreamChunk((event) =>
      appendChunk(event.card_id, event.chunk),
    );
    return () => {
      void cardUpdate.then((unlisten) => unlisten());
      void streamChunk.then((unlisten) => unlisten());
    };
  }, [appendChunk, upsertCard]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [cards]);

  async function submit() {
    const prompt = text.trim();
    if (!prompt || sending) return;
    if (!workspace) {
      window.alert("Set a workspace first");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        prompt,
        agent_choice: agentChoice,
        phase,
        workspace,
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-3 py-2">
        <PhaseDropdown />
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {workspace || "no workspace"}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {cards.length === 0 ? (
          <p className="mt-8 text-center text-[12px] text-muted-foreground">
            no messages yet
          </p>
        ) : (
          cards.map((card) => <Card key={card.id} card={card} />)
        )}
      </div>

      <div className="border-t border-border/60 bg-card/60 p-3">
        <textarea
          className="min-h-20 w-full resize-none rounded-md border border-border bg-background p-2 text-[13px] outline-none focus:ring-1 focus:ring-ring"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="type message..."
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <AgentDropdown />
          <button
            type="button"
            className="h-8 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
            onClick={() => void submit()}
            disabled={!canSend}
          >
            {sending ? "sending..." : "send"}
          </button>
        </div>
      </div>
    </div>
  );
}
