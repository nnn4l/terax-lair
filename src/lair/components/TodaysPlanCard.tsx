import { useEffect, useState } from "react";
import { join, homeDir } from "@tauri-apps/api/path";
import { Streamdown } from "streamdown";
import { native, type ReadResult } from "@/modules/ai/lib/native";

const VAULT_REL = "obsidian-vault";

function todayStamp(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function contentFromReadResult(result: ReadResult): string | null {
  return result.kind === "text" ? result.content : null;
}

export function TodaysPlanCard() {
  const [content, setContent] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const stamp = todayStamp();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const home = await homeDir();
        const path = await join(
          home,
          VAULT_REL,
          "output",
          "daily-plans",
          `${stamp}.md`,
        );
        const result = await native.readFile(path);
        const text = contentFromReadResult(result);
        if (!alive) return;
        if (text === null) {
          setMissing(true);
        } else {
          setContent(text);
        }
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [stamp]);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Today&apos;s plan
        </h3>
        <span className="text-[10.5px] text-muted-foreground/70">{stamp}</span>
      </div>
      {missing ? (
        <div className="rounded-md border border-dashed border-border/60 p-3 text-[11px] text-muted-foreground">
          No plan for today. Build via /plan in vault.
        </div>
      ) : content ? (
        <div className="flex-1 overflow-y-auto pr-1 text-[12px] leading-relaxed text-foreground/90 [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-muted-foreground [&_h3]:mt-1.5 [&_h3]:text-[12px] [&_h3]:font-semibold [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]">
          <Streamdown>{content}</Streamdown>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Loading</p>
      )}
    </aside>
  );
}
