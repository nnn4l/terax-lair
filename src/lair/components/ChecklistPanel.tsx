import { useEffect, useState } from "react";
import { useLair } from "@/lair/state";
import {
  appendChecklistItem,
  deleteChecklistItem,
  onChecklistChanged,
  readChecklist,
  toggleChecklistItem,
  watchChecklist,
} from "@/lair/api";
import type { ChecklistItem, ChecklistSection } from "@/lair/types";

const SECTIONS: { key: ChecklistSection; label: string }[] = [
  { key: "now", label: "Now" },
  { key: "next", label: "Next" },
  { key: "later", label: "Later" },
  { key: "done", label: "Done" },
];

export function ChecklistPanel() {
  const workspace = useLair((s) => s.workspace);
  const checklist = useLair((s) => s.checklist);
  const setChecklist = useLair((s) => s.setChecklist);
  const [collapsed, setCollapsed] = useState<Set<ChecklistSection>>(
    new Set(["done"]),
  );
  const [adding, setAdding] = useState<ChecklistSection | null>(null);
  const [addText, setAddText] = useState("");

  useEffect(() => {
    if (!workspace) return;
    void readChecklist(workspace).then(setChecklist);
    void watchChecklist(workspace);
    const unsub = onChecklistChanged(() =>
      readChecklist(workspace).then(setChecklist),
    );
    return () => {
      void unsub.then((fn) => fn());
    };
  }, [workspace, setChecklist]);

  async function handleToggle(lineIdx: number) {
    await toggleChecklistItem(workspace, lineIdx);
    const updated = await readChecklist(workspace);
    setChecklist(updated);
  }

  async function handleDelete(lineIdx: number) {
    await deleteChecklistItem(workspace, lineIdx);
    const updated = await readChecklist(workspace);
    setChecklist(updated);
  }

  async function handleAdd(section: ChecklistSection) {
    const text = addText.trim();
    if (!text) return;
    await appendChecklistItem(workspace, section, text);
    const updated = await readChecklist(workspace);
    setChecklist(updated);
    setAdding(null);
    setAddText("");
  }

  function toggleCollapse(key: ChecklistSection) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!workspace) return null;

  return (
    <div className="flex max-h-[40vh] shrink-0 flex-col border-b border-border/60 bg-card/40 px-2 py-1.5 text-[12px]">
      <div className="mb-1 flex shrink-0 items-center justify-between">
        <span className="font-medium text-muted-foreground">checklist</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
      {SECTIONS.map(({ key, label }) => {
        const items: ChecklistItem[] = checklist?.[key] ?? [];
        const open = !collapsed.has(key);
        return (
          <div key={key} className="mb-1">
            <button
              type="button"
              onClick={() => toggleCollapse(key)}
              className="flex w-full items-center justify-between text-[11px] font-medium text-muted-foreground/80 hover:text-foreground"
            >
              <span>
                {label}
                {items.length > 0 ? (
                  <span className="ml-1 text-muted-foreground/50">
                    ({items.length})
                  </span>
                ) : null}
              </span>
              <span>{open ? "▾" : "▸"}</span>
            </button>

            {open ? (
              <ul className="mt-0.5 space-y-0.5">
                {items.map((item) => (
                  <li
                    key={item.line}
                    className="group flex items-start gap-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => void handleToggle(item.line)}
                      className="mt-0.5 cursor-pointer"
                    />
                    <span
                      className={
                        "flex-1 " +
                        (item.checked
                          ? "line-through text-muted-foreground/50"
                          : "")
                      }
                    >
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.line)}
                      title="delete"
                      aria-label="delete item"
                      className="shrink-0 text-[12px] leading-none text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {adding === key ? (
                  <li className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={addText}
                      onChange={(e) => setAddText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAdd(key);
                        if (e.key === "Escape") {
                          setAdding(null);
                          setAddText("");
                        }
                      }}
                      placeholder="new item..."
                      className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAdd(key)}
                      className="text-[10px] text-primary"
                    >
                      add
                    </button>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      onClick={() => setAdding(key)}
                      className="text-[10px] text-muted-foreground/60 hover:text-primary"
                    >
                      + add
                    </button>
                  </li>
                )}
              </ul>
            ) : null}
          </div>
        );
      })}
      </div>
    </div>
  );
}
