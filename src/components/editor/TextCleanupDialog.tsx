"use client";

import { useRef, useState } from "react";
import type { CleanupProposal } from "@/lib/textCleanup";
import { useDialogFocus } from "@/lib/useDialogFocus";

interface TextCleanupDialogProps {
  proposal: CleanupProposal;
  onCancel: () => void;
  onAccept: (acceptedIds: string[]) => void;
  onGoToManual?: () => void;
}

/** Before/after review of wording proposals. Nothing changes until the user accepts. */
export function TextCleanupDialog({ proposal, onCancel, onAccept, onGoToManual }: TextCleanupDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>(() => proposal.changes.map((change) => change.id));
  const restoreFocusRef = useRef(true);
  useDialogFocus(dialogRef, true, onCancel, true, restoreFocusRef);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="ui-controls fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="text-cleanup-title" aria-describedby="text-cleanup-help" tabIndex={-1} className="ui-panel max-h-[92vh] w-full min-w-0 max-w-3xl overflow-y-auto rounded-xl p-4 text-slate-100 sm:p-5">
        <h2 id="text-cleanup-title" className="text-lg font-semibold">Review wording changes</h2>
        <p id="text-cleanup-help" className="mt-1 text-xs text-slate-300">
          Only targeted wording replacements are proposed in flagged fields. No items are deleted, reordered, or truncated. You can undo after applying.
        </p>

        {proposal.changes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-200">No safe automatic replacements available. Review the flagged items below manually.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {proposal.changes.map((change) => (
              <li key={change.id} className="ui-inset rounded-lg border border-slate-700 p-3">
                <label className="flex items-start gap-2 text-sm font-semibold" htmlFor={`cleanup-${change.id}`}>
                  <input id={`cleanup-${change.id}`} type="checkbox" checked={selected.includes(change.id)} onChange={() => toggle(change.id)} className="mt-1" />
                  {change.label}
                </label>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <p><span className="block font-semibold text-rose-300">Before</span>{change.before}</p>
                  <p><span className="block font-semibold text-emerald-300">After</span>{change.after}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {proposal.manualReview.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-amber-200">Items requiring manual review</h3>
              {onGoToManual && (
                <button
                  type="button"
                  onClick={() => {
                    restoreFocusRef.current = false;
                    onGoToManual();
                  }}
                  className="ui-button ui-button--secondary text-xs"
                >
                  Go to text fields
                </button>
              )}
            </div>
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-200">
              {proposal.manualReview.map((item, index) => <li key={`${item.label}-${index}`}>{item.label}: {item.terms.join(", ")}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-autofocus={proposal.changes.length === 0 ? "" : undefined}
            onClick={onCancel}
            className="ui-button ui-button--secondary"
          >
            {proposal.changes.length === 0 ? "Close" : "Cancel"}
          </button>
          {proposal.changes.length > 0 && (
            <button type="button" data-autofocus onClick={() => onAccept(selected)} disabled={selected.length === 0} className="ui-button ui-button--primary">
              Apply {selected.length} {selected.length === 1 ? "change" : "changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
