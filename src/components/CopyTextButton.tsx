"use client";

import { useEffect, useId, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import type { ToastVariant } from "@/components/Toast";

interface CopyTextButtonProps {
  /** Exact text to copy; it is never altered. */
  getText: () => string;
  label: string;
  successMessage: string;
  className?: string;
  disabled?: boolean;
  onNotify?: (message: string, variant?: ToastVariant) => void;
}

/**
 * Copy button with an honest result. If the browser refuses the copy, the exact text
 * appears in a selected read-only field so the user can copy it with Ctrl+C.
 */
export function CopyTextButton({ getText, label, successMessage, className, disabled, onNotify }: CopyTextButtonProps) {
  const [manualText, setManualText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldId = useId();
  useEffect(() => {
    if (manualText !== null) { fieldRef.current?.focus(); fieldRef.current?.select(); }
  }, [manualText]);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  return (
    <span className="inline-flex max-w-full flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        className={className}
        onClick={async () => {
          const text = getText();
          setBusy(true);
          const outcome = await copyText(text);
          setBusy(false);
          if (outcome === "copied") {
            setManualText(null);
            setJustCopied(true);
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = setTimeout(() => setJustCopied(false), 1800);
            onNotify?.(successMessage, "success");
          } else {
            setJustCopied(false);
            setManualText(text);
            onNotify?.("Your browser blocked clipboard access. Select the text below and copy it with Ctrl+C.", "error");
          }
        }}
      >
        {justCopied ? "✓ Copied" : label}
      </button>
      {manualText !== null && (
        <span className="flex w-full min-w-0 sm:min-w-[16rem] flex-col gap-1 text-left">
          <label htmlFor={fieldId} className="text-xs text-amber-200">Manual copy (exact text):</label>
          <textarea id={fieldId} ref={fieldRef} readOnly value={manualText} rows={4} onFocus={(event) => event.currentTarget.select()} className="w-full rounded border border-amber-500/40 bg-[var(--ui-inset)] p-2 text-xs text-white" />
          <button type="button" onClick={() => setManualText(null)} className="self-end text-xs text-slate-300 underline">Close</button>
        </span>
      )}
    </span>
  );
}
