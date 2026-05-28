import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Ambient {
  uningested_count: number;
  wiki_edits_today: number;
  log_entries_pending: number;
}

export function AmbientStrip() {
  const [data, setData] = useState<Ambient | null>(null);

  useEffect(() => {
    invoke<Ambient>("lair_dashboard_ambient")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;
  const parts: string[] = [];
  if (data.uningested_count > 0) parts.push(`${data.uningested_count} uningested`);
  if (data.wiki_edits_today > 0) parts.push(`${data.wiki_edits_today} wiki edits today`);
  if (data.log_entries_pending > 0) parts.push("log entry pending");
  if (parts.length === 0) return null;

  return (
    <footer className="border-t border-border/40 px-6 py-3 text-[11px] text-muted-foreground">
      vault: {parts.join(" · ")}
    </footer>
  );
}
