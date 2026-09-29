"use client";

import { useRef, useState } from "react";

export const MAX_FILE_MB = 50;

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  disabled?: boolean;
}

export default function Uploader({ onFile, onSample, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`w-full cursor-pointer rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <p className="text-lg font-medium">Drop a CSV file here</p>
        <p className="mt-1 text-sm text-zinc-500">or click to browse · up to {MAX_FILE_MB} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <button
        type="button"
        onClick={onSample}
        disabled={disabled}
        className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-60 dark:text-indigo-400"
      >
        No file handy? Try sample sales data →
      </button>
    </div>
  );
}
