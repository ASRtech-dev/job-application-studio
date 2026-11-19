import React from "react";
import { Save } from "lucide-react";

interface SaveSectionButtonProps {
  label?: string;
  section?: string;
  dirty?: boolean;
  saving: boolean;
  onSave: () => void;
}

/**
 * Shared footer save button used across application editor and master CV form tabs.
 */
export function SaveSectionButton({ label, section, dirty, saving, onSave }: SaveSectionButtonProps) {
  const buttonLabel = label || (dirty === false ? `All saved (${section || "profile"})` : `Save ${section || "changes"}`);
  return (
    <div className="pt-4 border-t border-[var(--ui-border)] flex justify-end">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="ui-button ui-button--primary flex items-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <><span aria-hidden="true" className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white" />Saving…</>
        ) : (
          <>
            <Save className="w-3.5 h-3.5 text-white" aria-hidden="true" /> {buttonLabel}
          </>
        )}
      </button>
    </div>
  );
}
