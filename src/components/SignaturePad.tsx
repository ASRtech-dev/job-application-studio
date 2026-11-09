import React, { useRef, useState, useEffect } from "react";
import { X, RotateCcw, Check, PenTool } from "lucide-react";

interface SignaturePadProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

export default function SignaturePad({ isOpen, onClose, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Initial canvas sizes and scale for HDPI screens
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set layout dimensions based on actual client container width
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    
    // Smooth drawing parameters
    ctx.strokeStyle = "#10233f"; // Navy ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  }, [isOpen]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
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
    if (!canvas || !hasDrawn) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, "image/png");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        ref={containerRef}
        className="w-full max-w-lg rounded-2xl border border-[#1f2937] bg-[#0e162d] p-6 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute -left-16 -top-16 w-32 h-32 bg-[#6d8ead]/15 rounded-full blur-2xl"></div>
        
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PenTool className="w-4 h-4 text-[#6d8ead]" /> Draw Your Signature
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white bg-[#10233f]/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#6b7280] mb-4">
          Use your mouse, trackpad, or touchscreen to sign inside the baseline grid below.
        </p>

        {/* Drawing Canvas */}
        <div className="relative w-full h-[200px] bg-white rounded-xl border border-[#1f2937]/40 overflow-hidden select-none">
          {/* Baseline guidelines */}
          <div className="absolute inset-x-0 bottom-12 border-b border-dashed border-[#d8dee8] pointer-events-none flex justify-center">
            <span className="text-[9px] text-[#9ca3af] -mt-4 bg-white/80 px-2 rounded">sign on the line</span>
          </div>

          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full cursor-crosshair touch-none"
          />
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10233f]/50 hover:bg-[#10233f] text-[#6d8ead] border border-[#6d8ead]/10 font-semibold text-xs transition-all"
            disabled={!hasDrawn}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#1f2937]/20 text-[#6b7280] font-semibold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasDrawn}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#10233f] to-[#1d3d6b] hover:from-[#152d50] hover:to-[#244e88] text-white font-semibold text-xs shadow-md transition-all active:scale-95 disabled:opacity-40"
            >
              <Check className="w-4 h-4" /> Save Signature
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
