import type { QueueItem } from "@/lair/types";

export interface NumberedQueueRow {
  id: string;
  item: QueueItem;
  number: string;
  depth: number;
}

export function numberQueueItems(items: QueueItem[]): NumberedQueueRow[] {
  const rows: NumberedQueueRow[] = [];

  function visit(children: QueueItem[], prefix: number[], depth: number) {
    children.forEach((item, index) => {
      const path = [...prefix, index + 1];
      rows.push({
        id: item.id,
        item,
        number: path.join("."),
        depth,
      });
      visit(item.children, path, depth + 1);
    });
  }

  visit(items, [], 0);
  return rows;
}
