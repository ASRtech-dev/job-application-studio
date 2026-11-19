"use client";

import { useRef } from "react";
import type { ReviewItem } from "@/lib/finalReview";
import { useDialogFocus } from "@/lib/useDialogFocus";

const TONES: Record<ReviewItem["severity"], { label: string; className: string }> = {
  warning: { label: "Review", className: "border-amber-500/40 bg-amber-500/10 text-amber-100" },
  pending: { label: "Pending", className: "border-sky-500/40 bg-sky-500/10 text-sky-100" },
  info: { label: "Info", className: "border-slate-600 bg-slate-800/40 text-slate-200" },
  ok: { label: "Ready", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" },
};
const ORDER: ReviewItem["severity"][] = ["warning", "pending", "info", "ok"];

/**
 * Practical pre-send checklist. It does not send anything and does not decide whether to
 * apply: registering the send stays a separate, manual step in the CRM activity dialog.
 */
export function FinalReviewDialog({ items, onClose, onGoTo }: { items: ReviewItem[]; onClose: () => void; onGoTo: (item: ReviewItem) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(true);
  useDialogFocus(dialogRef, true, onClose, true, restoreFocusRef);
  const sorted = [...items].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  return (
    <div className="ui-controls fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="final-review-title" aria-describedby="final-review-help" tabIndex={-1} className="ui-panel max-h-[92vh] w-full min-w-0 max-w-2xl overflow-y-auto rounded-xl p-4 text-slate-100 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="final-review-title" className="text-lg font-semibold">Final review before sending</h2>
          <button type="button" onClick={onClose} className="ui-button ui-button--secondary">Close</button>
        </div>
        <p id="final-review-help" className="mb-4 text-xs text-slate-300">
          Actionable checks to review, not a hiring probability. You decide whether to apply. Reviewing or exporting does not record a submission — log that separately in Activity.
        </p>
        <ul className="space-y-2">
          {sorted.map((item) => (
            <li key={item.id} className={`rounded-lg border p-3 text-sm ${TONES[item.severity].className}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p><span className="font-semibold">{TONES[item.severity].label} · {item.field}:</span> {item.message}</p>
                {item.severity !== "ok" && (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary text-xs"
                    onClick={() => {
                      restoreFocusRef.current = false;
                      onGoTo(item);
                    }}
                  >
                    Go to {item.field}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
