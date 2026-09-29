"use client";

import { useRef, useState } from "react";
import { btnPrimary, sectionLabel } from "@/lib/ui";

export const MAX_FILE_MB = 50;

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  loading: string | null; // file name while loading
  error: string | null;
}

// The start card: drop a CSV, browse for one, or use the sample data.
export default function Uploader({ onFile, onSample, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const disabled = loading !== null;

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5 shadow-[0_0_40px_rgba(79,142,255,0.08)] sm:p-6">
      <p className={sectionLabel}>{"// start here"}</p>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        aria-label="Upload a CSV file"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
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
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-accent bg-accent/10" : "border-line-strong hover:border-accent/60 hover:bg-card-hover"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium">{loading ? `Loading ${loading}…` : "Drop a CSV file here"}</p>
        <p className="text-sm text-muted">{loading ? "Profiling columns in your browser" : `or click to browse · up to ${MAX_FILE_MB} MB`}</p>
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
        className={btnPrimary}
      >
        Try it with sample sales data
      </button>
      <p className="text-center text-xs text-muted">2,400 orders from a fictional store, with a few data problems left in on purpose.</p>
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
