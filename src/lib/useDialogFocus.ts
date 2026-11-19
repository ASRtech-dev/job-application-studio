"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';

/**
 * Same focus contract as the Prompt and CRM dialogs: initial focus inside, Tab and
 * Shift+Tab contained, Escape closes (unless `canClose` is false while an operation
 * is pending), and focus returns to the opener when the dialog unmounts or closes.
 */
export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  canClose = true,
  restoreFocusRef?: RefObject<boolean>
): void {
  const closeRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  const restoreRef = useRef(restoreFocusRef);
  useEffect(() => {
    closeRef.current = onClose;
    canCloseRef.current = canClose;
    restoreRef.current = restoreFocusRef;
  }, [onClose, canClose, restoreFocusRef]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.getClientRects().length > 0);
    const focusFirst = () => {
      const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]");
      (preferred && preferred.getClientRects().length > 0 ? preferred : items()[0] || dialog).focus();
    };
    dialog.focus();
    const frame = requestAnimationFrame(focusFirst);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (canCloseRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (!dialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    // Buttons can disappear while saving or after an error: re-home focus inside.
    const containFocus = () => { if (!dialog.contains(document.activeElement)) dialog.focus(); };
    const observer = new MutationObserver(containFocus);
    observer.observe(dialog, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", containFocus);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", containFocus);
      if ((restoreRef.current?.current ?? true) && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [dialogRef, open]);
}
