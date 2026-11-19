"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global root error:", error);
  }, [error]);

  const handleRetry = () => {
    if (typeof retry === "function") retry();
    else reset();
  };

  return (
    <html lang="en" className="dark">
      <body style={{ background: "#080d18", color: "#f8fafc", fontFamily: "system-ui, sans-serif", minHeight: "100vh", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <main style={{ maxWidth: "460px", background: "#0f172a", border: "1px solid rgba(148,163,184,0.22)", borderRadius: "16px", padding: "24px", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 12px" }}>Application Error</h1>
          <p role="alert" style={{ fontSize: "0.875rem", color: "#cbd5e1", margin: "0 0 14px", lineHeight: 1.5 }}>
            The application shell encountered an unexpected interruption. Your local data files were not deleted.
          </p>
          {error?.digest && (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace", margin: "0 0 16px" }}>
              Reference: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={handleRetry} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 14px", cursor: "pointer", fontWeight: 600 }}>
              Retry
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.25)", borderRadius: "8px", padding: "9px 14px", cursor: "pointer" }}>
              Reload browser
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
