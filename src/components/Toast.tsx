"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

/**
 * Stateful hook for managing non-blocking toast notifications.
 */
export function useToast(defaultDurationMs = 4500) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", durationMs?: number) => {
      const id = Date.now() + Math.floor(Math.random() * 10000);
      const effectiveDuration = durationMs ?? (variant === "error" ? Math.max(defaultDurationMs, 6000) : defaultDurationMs);
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
      if (effectiveDuration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, effectiveDuration);
      }
    },
    [defaultDurationMs]
  );

  return { toasts, showToast, dismissToast };
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; icon: React.ReactNode }
> = {
  success: {
    container: "bg-[#0b1f1a]/95 border-emerald-500/40 text-emerald-200",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  },
  error: {
    container: "bg-[#241016]/95 border-rose-500/40 text-rose-200",
    icon: <XCircle className="w-4 h-4 text-rose-400 shrink-0" />,
  },
  warning: {
    container: "bg-[#221a0b]/95 border-amber-500/40 text-amber-200",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  },
  info: {
    container: "bg-[#0e1b33]/95 border-[#6d8ead]/40 text-slate-100",
    icon: <Info className="w-4 h-4 text-[#6d8ead] shrink-0" />,
  },
};

/**
 * Floating bottom-right toast stack replacing native blocking window.alert() popups.
 */
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss(toasts[toasts.length - 1].id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toasts, onDismiss]);

  const politeToasts = toasts.filter((t) => t.variant !== "error");
  const alertToasts = toasts.filter((t) => t.variant === "error");

  const renderItem = (toast: ToastMessage) => {
    const style = VARIANT_STYLES[toast.variant];
    return (
      <div
        key={toast.id}
        className={`ui-toast pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-medium ${style.container}`}
      >
        {style.icon}
        <span className="flex-1 min-w-0 break-words leading-relaxed">{toast.message}</span>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="ui-button ui-button--quiet shrink-0 min-w-9 min-h-9 text-slate-300 hover:text-white"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
      <div aria-live="polite" aria-atomic="true" className="flex flex-col gap-2">
        {politeToasts.map(renderItem)}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="flex flex-col gap-2">
        {alertToasts.map(renderItem)}
      </div>
    </div>
  );
}
