import type { NarrationLine as NarrationLineData } from "@/lair/types";

export function NarrationLine({ line }: { line: NarrationLineData }) {
  return (
    <p className="my-1 px-1 text-[11px] italic text-muted-foreground/70">
      {line.text}
    </p>
  );
}
