"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PageError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  const handleRetry = () => {
    if (typeof retry === "function") retry();
    else reset();
  };

  return (
    <main className="ui-shell flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <div className="ui-panel max-w-lg rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-white">Could not display this view</h1>
        <p role="alert" className="text-sm text-slate-300">
          An unexpected error occurred while loading or rendering this page. Your locally saved data remains intact.
        </p>
        {error?.digest && (
          <p className="text-xs font-mono text-slate-400">Internal reference: {error.digest}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button type="button" onClick={handleRetry} className="ui-button ui-button--primary">
            Retry view
          </button>
          <button type="button" onClick={() => window.location.reload()} className="ui-button ui-button--secondary">
            Reload app
          </button>
          <Link href="/" className="ui-button ui-button--quiet">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
