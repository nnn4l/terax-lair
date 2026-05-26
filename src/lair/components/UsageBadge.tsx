import type { Usage } from "@/lair/types";

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function UsageBadge({ usage }: { usage: Usage }) {
  const cost =
    usage.cost_usd > 0 ? ` · $${usage.cost_usd.toFixed(3)}` : "";
  return (
    <span
      title={`${usage.tokens_in} in · ${usage.tokens_out} out · $${usage.cost_usd.toFixed(4)}`}
      className="text-[10px] text-muted-foreground/60 tabular-nums"
    >
      {fmt(usage.tokens_in)} in · {fmt(usage.tokens_out)} out{cost}
    </span>
  );
}
