"use client";

import type { HistoryItem } from "@/lib/history";

const timeFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function HistoryList({
  items,
  onOpen,
  onClear,
}: {
  items: HistoryItem[];
  onOpen: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  if (items.length === 0) {
    return <p className="px-2 pb-1 text-sm text-muted">Questions you ask about this file will show up here, so you can come back to them.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="w-full rounded-md px-2 py-1.5 text-left transition hover:bg-card-hover"
            >
              <span className="line-clamp-2 text-sm">{item.question}</span>
              <span className="font-mono text-[0.65rem] tracking-wide text-muted">{timeFormat.format(new Date(item.askedAt))}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClear} className="self-start px-2 font-mono text-[0.65rem] tracking-wide text-muted transition hover:text-red-300">
        Clear history
      </button>
    </div>
  );
}
