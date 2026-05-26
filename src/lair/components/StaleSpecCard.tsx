import { useMemo, useState } from "react";
import * as api from "@/lair/api";
import { useLair } from "@/lair/state";
import type { StaleReport } from "@/lair/types";

interface Props {
  reports: StaleReport[];
  specFile: string;
}

export function StaleSpecCard({ reports, specFile }: Props) {
  const initial = useMemo(() => new Set(reports.map((report) => report.item_id)), [reports]);
  const [accepted, setAccepted] = useState<Set<string>>(initial);
  const [expanded, setExpanded] = useState(false);
  const setQueue = useLair((state) => state.setQueue);
  const setStaleReports = useLair((state) => state.setStaleReports);

  async function applyResync() {
    await api.queueResync([...accepted]);
    const items = await api.queueGet();
    if (items) setQueue(items);
    setStaleReports([], null);
  }

  function toggle(id: string) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (reports.length === 0) return null;

  const shortName = specFile.replace(/\\/g, "/").split("/").pop() ?? specFile;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-2 text-[12px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-amber-500">
          Spec changed: {shortName}. {reports.length} items affected.
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-amber-500 hover:bg-amber-500/10"
        >
          {expanded ? "collapse" : "re-sync"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-1">
          {reports.map((report) => (
            <label
              key={report.item_id}
              className="flex cursor-pointer items-start gap-2 text-[11px]"
            >
              <input
                type="checkbox"
                checked={accepted.has(report.item_id)}
                onChange={() => toggle(report.item_id)}
                className="mt-0.5 size-3 shrink-0"
              />
              <span>
                <span className="text-foreground">{report.spec_section}</span>
                <span className="ml-2 text-muted-foreground">{report.diff_summary}</span>
              </span>
            </label>
          ))}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void applyResync()}
              className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-medium text-background"
            >
              apply ({accepted.size})
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
