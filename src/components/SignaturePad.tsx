import React, { useRef, useState, useEffect, useCallback } from "react";
import { X, RotateCcw, Check, PenTool } from "lucide-react";
import { useDialogFocus } from "../lib/useDialogFocus";

interface SignaturePadProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => void | Promise<unknown>;
}

export default function SignaturePad({ isOpen, onClose, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

  useDialogFocus(containerRef, isOpen, onClose);

  const setupCanvasSize = useCallback((preserveExisting: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    let snapshot: HTMLCanvasElement | null = null;
    if (preserveExisting && canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
    }

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(200 * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#10233f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, rect.width, 200);
    } else {
      ctx.clearRect(0, 0, rect.width, 200);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      setupCanvasSize(false);
      setHasDrawn(false);
      setSaving(false);
    });
    const canvas = canvasRef.current;
    const observer = typeof ResizeObserver === "function" && canvas
      ? new ResizeObserver(() => setupCanvasSize(true))
      : null;
    if (observer && canvas) observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [isOpen, setupCanvasSize]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!coords || !ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!coords || !ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e?.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || saving) return;
    setSaving(true);
    canvas.toBlob(async (blob) => {
      try {
        if (blob) await onSave(blob);
      } finally {
        setSaving(false);
      }
    }, "image/png");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-dialog-title"
        className="ui-panel ui-controls w-full max-w-lg p-4 sm:p-6 relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="signature-dialog-title" className="text-base font-bold text-white flex items-center gap-2">
            <PenTool className="w-4 h-4 text-blue-300" /> Draw your signature
          </h3>
          <button type="button" aria-label="Close signature pad" onClick={onClose} className="ui-button ui-button--quiet">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mb-4">
          Sign above the line using your mouse, trackpad, or touchscreen.
        </p>

        <div className="relative w-full h-[200px] bg-white rounded-xl border border-slate-300 overflow-hidden select-none">
          <div className="absolute inset-x-0 bottom-12 border-b border-dashed border-[#d8dee8] pointer-events-none flex justify-center">
            <span className="text-xs text-slate-600 -mt-4 bg-white/80 px-2 rounded">sign above the line</span>
          </div>

          <canvas
            ref={canvasRef}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            className="w-full h-full cursor-crosshair touch-none"
          />
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 mt-6">
          <button
            type="button"
            onClick={clearCanvas}
            className="ui-button ui-button--secondary"
            disabled={!hasDrawn || saving}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="ui-button ui-button--quiet">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasDrawn || saving}
              className="ui-button ui-button--primary"
            >
              <Check className="w-4 h-4" /> {saving ? "Saving…" : "Save signature"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
