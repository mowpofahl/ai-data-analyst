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
    return <p className="text-sm text-zinc-500">Questions you ask about this file will show up here, so you can come back to them.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <span className="line-clamp-2 text-sm">{item.question}</span>
              <span className="text-xs text-zinc-500">{timeFormat.format(new Date(item.askedAt))}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClear} className="self-start px-2 text-xs text-zinc-500 hover:text-red-600 hover:underline">
        Clear history
      </button>
    </div>
  );
}
