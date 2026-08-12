"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

const CANVAS_BG = "#f5f3ee";
const BRUSH_STEP = 10;

const PALETTE = [
  "#000000", "#ffffff", "#808080",
  "#e63946", "#457b9d", "#f4d35e",
  "#f4a261", "#4caf50", "#9c27b0",
  "#ff6b9d", "#2a9d8f", "#a0522d",
];

type Tool = "pen" | "eraser";

const INTERFACE_FONT = { fontFamily: "var(--font-interface)" } as const;

// Bresenham integer line — visits every grid cell between two points
function bresenham(
  x0: number, y0: number, x1: number, y1: number,
  cb: (x: number, y: number) => void
) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
}

// ─── Dial ──────────────────────────────────────────────────────────────────────

interface DialProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onRotate: (delta: number) => void;
  textLeft?: boolean;
}

// Arc geometry constants
const ARC_R = 50;
const ARC_C = 2 * Math.PI * ARC_R;         // ≈ 314.16
const ARC_SWEEP_DEG = 270;
const ARC_TRACK = (ARC_SWEEP_DEG / 360) * ARC_C; // ≈ 235.62
const ARC_GAP   = ARC_C - ARC_TRACK;              // ≈ 78.54

function Dial({ label, value, unit, min, max, onRotate, textLeft }: DialProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const center = useRef<{ x: number; y: number } | null>(null);
  const lastAngle = useRef<number | null>(null);
  const dragging = useRef(false);

  const getKnobAngle = (cx: number, cy: number) => {
    if (!center.current) return 0;
    return Math.atan2(cy - center.current.y, cx - center.current.x) * (180 / Math.PI);
  };

  const pointerDown = (cx: number, cy: number) => {
    const rect = knobRef.current!.getBoundingClientRect();
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    lastAngle.current = getKnobAngle(cx, cy);
    dragging.current = true;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || lastAngle.current === null) return;
      const a = getKnobAngle(e.clientX, e.clientY);
      let d = a - lastAngle.current;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle.current = a;
      onRotate(d);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current || lastAngle.current === null) return;
      const t = e.touches[0];
      const a = getKnobAngle(t.clientX, t.clientY);
      let d = a - lastAngle.current;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle.current = a;
      onRotate(d);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [onRotate]);

  // Derive rotation and arc fill from value
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const knobAngle = -135 + t * 270;
  const activeLen = t * ARC_TRACK;

  const textBlock = (
    <div className="leading-tight" style={{ minWidth: 56, textAlign: textLeft ? "right" : "left" }}>
      <span style={{ ...INTERFACE_FONT, display: "block", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)" }}>
        {label}
      </span>
      <span style={{ ...INTERFACE_FONT, fontSize: 17, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>
        {value}{unit}
      </span>
    </div>
  );

  return (
    <div className="flex flex-row items-center gap-3 flex-shrink-0">
      {textLeft && textBlock}
      {/* Wrapper so SVG arc can be positioned outside the rotating knob */}
      <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
        {/* Arc SVG — static, does not rotate */}
        <svg
          width={108} height={108}
          style={{ position: "absolute", top: -8, left: -8, pointerEvents: "none" }}
        >
          {/* Grey track: full 270° sweep */}
          <circle
            cx={54} cy={54} r={ARC_R}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${ARC_TRACK} ${ARC_GAP}`}
            transform="rotate(135, 54, 54)"
          />
          {/* White active arc: 0 → current value */}
          {activeLen > 1 && (
            <circle
              cx={54} cy={54} r={ARC_R}
              fill="none"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${activeLen} ${ARC_C - activeLen}`}
              transform="rotate(135, 54, 54)"
            />
          )}
        </svg>
        {/* Knob — rotates with value */}
        <div
          ref={knobRef}
          onMouseDown={(e) => { e.preventDefault(); pointerDown(e.clientX, e.clientY); }}
          onTouchStart={(e) => { const t = e.touches[0]; pointerDown(t.clientX, t.clientY); }}
          className="rounded-full cursor-grab active:cursor-grabbing relative"
          style={{
            width: 92, height: 92,
            background: "radial-gradient(circle at 35% 30%, #5a5a5a 0%, #1a1a1a 70%)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.85), 0 0 0 4px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 0 rgba(0,0,0,0.5)",
            transform: `rotate(${knobAngle}deg)`,
            touchAction: "none",
          }}
        >
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full"
            style={{ width: 6, height: 22, background: "linear-gradient(to bottom, #fff 0%, rgba(255,255,255,0.35) 100%)" }}
          />
        </div>
      </div>
      {!textLeft && textBlock}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TormiSketchPage() {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [pixelMode, setPixelMode] = useState(false);
  const [opacity, setOpacity] = useState(100);
  const [noBackground, setNoBackground] = useState(false);
  const [sent, setSent] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<HTMLCanvasElement>(null); // current in-progress stroke
  const containerRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const lastGridPos = useRef<{ x: number; y: number } | null>(null);
  const brushAccum = useRef(0);
  const opacityAccum = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cssSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Init both canvases — runs when booted turns true (container becomes visible)
  useEffect(() => {
    if (!booted) return;
    const canvas = canvasRef.current;
    const pending = pendingRef.current;
    const container = containerRef.current;
    if (!canvas || !pending || !container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = container.offsetWidth;
    const H = container.offsetHeight;
    cssSize.current = { w: W, h: H };
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.scale(dpr, dpr); ctx.fillStyle = CANVAS_BG; ctx.fillRect(0, 0, W, H); }
    pending.width = W * dpr; pending.height = H * dpr;
    const pCtx = pending.getContext("2d");
    if (pCtx) pCtx.scale(dpr, dpr);
  }, [booted]);

  // Analog TV static noise — throttled to 24fps (authentic TV look, avoids competing with entry animation)
  useEffect(() => {
    const canvas = staticRef.current;
    if (!canvas) return;
    const W = 180, H = 100;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    let lastTime = 0;
    const INTERVAL = 1000 / 24;
    const drawNoise = (time: number) => {
      raf = requestAnimationFrame(drawNoise);
      if (time - lastTime < INTERVAL) return;
      lastTime = time;
      const imgData = ctx.createImageData(W, H);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() > 0.965 ? Math.round(Math.random() * 170 + 85) : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = v > 0 ? 190 : 0;
      }
      ctx.putImageData(imgData, 0, 0);
    };
    raf = requestAnimationFrame(drawNoise);
    return () => cancelAnimationFrame(raf);
  }, []);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── startDraw: draw initial point / pixel ──────────────────────────────────
  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    const pending = pendingRef.current;
    if (!canvas || !pending) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e, canvas);
    lastPos.current = pos;

    if (tool === "eraser") {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = CANVAS_BG;
      if (pixelMode) {
        const gx = Math.floor(pos.x / brushSize);
        const gy = Math.floor(pos.y / brushSize);
        ctx.fillRect(gx * brushSize, gy * brushSize, brushSize, brushSize);
        lastGridPos.current = { x: gx, y: gy };
      } else {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushSize * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const pCtx = pending.getContext("2d");
      if (!pCtx) return;
      pCtx.clearRect(0, 0, cssSize.current.w, cssSize.current.h);
      pCtx.fillStyle = color;
      if (pixelMode) {
        const gx = Math.floor(pos.x / brushSize);
        const gy = Math.floor(pos.y / brushSize);
        pCtx.fillRect(gx * brushSize, gy * brushSize, brushSize, brushSize);
        lastGridPos.current = { x: gx, y: gy };
      } else {
        pCtx.beginPath();
        pCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
        pCtx.fill();
      }
    }
  }, [tool, color, brushSize, pixelMode]);

  // ── draw: extend stroke to current position ────────────────────────────────
  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const pending = pendingRef.current;
    if (!canvas || !pending) return;
    e.preventDefault();
    const pos = getPos(e, canvas);

    if (tool === "eraser") {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = CANVAS_BG;
      if (pixelMode) {
        const gx1 = Math.floor(pos.x / brushSize);
        const gy1 = Math.floor(pos.y / brushSize);
        const gx0 = lastGridPos.current?.x ?? Math.floor(lastPos.current!.x / brushSize);
        const gy0 = lastGridPos.current?.y ?? Math.floor(lastPos.current!.y / brushSize);
        bresenham(gx0, gy0, gx1, gy1, (gx, gy) => {
          ctx.fillRect(gx * brushSize, gy * brushSize, brushSize, brushSize);
        });
        lastGridPos.current = { x: gx1, y: gy1 };
      } else {
        ctx.beginPath();
        ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = CANVAS_BG;
        ctx.lineWidth = brushSize * 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    } else {
      const pCtx = pending.getContext("2d");
      if (!pCtx) return;
      if (pixelMode) {
        const gx1 = Math.floor(pos.x / brushSize);
        const gy1 = Math.floor(pos.y / brushSize);
        const gx0 = lastGridPos.current?.x ?? Math.floor(lastPos.current!.x / brushSize);
        const gy0 = lastGridPos.current?.y ?? Math.floor(lastPos.current!.y / brushSize);
        pCtx.fillStyle = color;
        bresenham(gx0, gy0, gx1, gy1, (gx, gy) => {
          pCtx.fillRect(gx * brushSize, gy * brushSize, brushSize, brushSize);
        });
        lastGridPos.current = { x: gx1, y: gy1 };
      } else {
        pCtx.beginPath();
        pCtx.moveTo(lastPos.current!.x, lastPos.current!.y);
        pCtx.lineTo(pos.x, pos.y);
        pCtx.strokeStyle = color;
        pCtx.lineWidth = brushSize;
        pCtx.lineCap = "round";
        pCtx.lineJoin = "round";
        pCtx.stroke();
      }
    }

    lastPos.current = pos;
  }, [tool, color, brushSize, pixelMode]);

  // ── endDraw: flatten pending canvas to main at chosen opacity ──────────────
  const endDraw = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    lastGridPos.current = null;

    const canvas = canvasRef.current;
    const pending = pendingRef.current;
    if (!canvas || !pending || tool === "eraser") return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(pending, 0, 0, cssSize.current.w, cssSize.current.h);
      ctx.globalAlpha = 1;
    }
    const pCtx = pending.getContext("2d");
    if (pCtx) pCtx.clearRect(0, 0, cssSize.current.w, cssSize.current.h);
  }, [tool, opacity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", endDraw);
    };
  }, [startDraw, draw, endDraw, booted]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const pending = pendingRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = cssSize.current;
    if (ctx) { ctx.fillStyle = CANVAS_BG; ctx.fillRect(0, 0, w, h); }
    if (pending) {
      const pCtx = pending.getContext("2d");
      if (pCtx) pCtx.clearRect(0, 0, w, h);
    }
  }, []);

  const handleClearClick = useCallback(() => {
    if (clearPending) {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      setClearPending(false);
      clearCanvas();
    } else {
      setClearPending(true);
      clearTimer.current = setTimeout(() => setClearPending(false), 2200);
    }
  }, [clearPending, clearCanvas]);

  const downloadDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    const pending = pendingRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "tormisketch.png";
    try {
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width; tmp.height = canvas.height;
      const tCtx = tmp.getContext("2d");
      if (tCtx) {
        tCtx.drawImage(canvas, 0, 0);
        if (pending) { tCtx.globalAlpha = opacity / 100; tCtx.drawImage(pending, 0, 0); tCtx.globalAlpha = 1; }
        if (noBackground) {
          // CANVAS_BG = #f5f3ee → rgb(245, 243, 238) — not in palette, safe to remove
          const imgData = tCtx.getImageData(0, 0, tmp.width, tmp.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] === 245 && d[i + 1] === 243 && d[i + 2] === 238) d[i + 3] = 0;
          }
          tCtx.putImageData(imgData, 0, 0);
        }
      }
      link.href = tmp.toDataURL("image/png");
    } catch {
      link.href = canvas.toDataURL("image/png");
    }
    link.click();
  }, [opacity, noBackground]);

  const sendToTormius = useCallback(() => {
    downloadDrawing();
    setSent(true);
    setTimeout(() => {
      window.open(
        "mailto:at@tormius.com?subject=I made a drawing for you&body=Hey Tormius! I made a drawing on your site. Find it attached :)%0A%0AHave a nice day",
        "_blank"
      );
    }, 500);
    setTimeout(() => setSent(false), 4000);
  }, [downloadDrawing]);

  const handleSizeDial = useCallback((delta: number) => {
    brushAccum.current += delta;
    const steps = Math.trunc(brushAccum.current / BRUSH_STEP);
    if (steps !== 0) {
      brushAccum.current -= steps * BRUSH_STEP;
      setBrushSize((prev) => Math.max(1, Math.min(40, prev + steps)));
    }
  }, []);

  const handleOpacityDial = useCallback((delta: number) => {
    opacityAccum.current += delta;
    const steps = Math.trunc(opacityAccum.current / BRUSH_STEP);
    if (steps !== 0) {
      opacityAccum.current -= steps * BRUSH_STEP;
      setOpacity((prev) => Math.max(5, Math.min(100, prev + steps * 5)));
    }
  }, []);


  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px", borderRadius: 12,
    background: active ? "white" : "rgba(255,255,255,0.1)",
    color: active ? "black" : "rgba(255,255,255,0.55)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    cursor: "pointer", transition: "background 0.15s, color 0.15s",
  });

  const mobileTool = (active: boolean): React.CSSProperties => ({
    padding: "8px 10px", borderRadius: 10,
    background: active ? "white" : "rgba(255,255,255,0.1)",
    color: active ? "black" : "rgba(255,255,255,0.55)",
    display: "flex", alignItems: "center",
    cursor: "pointer", transition: "background 0.15s, color 0.15s", flexShrink: 0,
  });

  const miniCtrlBtn: React.CSSProperties = {
    ...INTERFACE_FONT, width: 28, height: 28, borderRadius: 8,
    background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 17, fontWeight: 700, cursor: "pointer", flexShrink: 0, border: "none",
  };

  return (
    <>
      <style>{`
        @keyframes scan-drift {
          from { transform: translateY(-100%); }
          to   { transform: translateY(600%); }
        }
        @keyframes letter-fill {
          from { clip-path: inset(100% 0 0 0); }
          to   { clip-path: inset(0% 0 0 0); }
        }
        .tsk-btn {
          font-family: var(--font-interface);
          font-size: 13px;
          font-weight: 500;
          padding: 9px 20px 10px;
          border-radius: 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: opacity 0.15s;
          border: none;
          text-decoration: none;
          white-space: nowrap;
          line-height: 1;
        }
        .tsk-btn-white { background: white; color: black; }
        .tsk-btn-send-idle { background: white; color: black; border: none; }
        .tsk-btn-send-done { background: transparent; color: white; border: 1px solid rgba(255,255,255,0.35); }
        @media (max-width: 767px) {
          .tsk-btn {
            font-size: 11px;
            padding: 6px 13px 7px;
            gap: 4px;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[999] overflow-hidden select-none flex items-center justify-center"
        style={{
          backgroundImage: "url('/tormisketch-hills.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <AnimatePresence mode="wait">
          {!booted && (
            <motion.div
              key="boot"
              className="absolute inset-0 flex flex-col items-center justify-center gap-8"
              style={{ background: "#000" }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              {/* Letter-by-letter fill */}
              <div style={{ display: "flex" }}>
                {"TORMISKETCH".split("").map((letter, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 400,
                      fontSize: 52,
                      color: "white",
                      display: "inline-block",
                      clipPath: "inset(100% 0 0 0)",
                      animation: `letter-fill 0.1s ${i * 0.055}s ease-out forwards`,
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {booted && (
        <motion.div
          key="app"
          className="relative flex flex-col w-full h-full px-3 pt-3 pb-2.5 md:px-[22px] md:pt-4 md:pb-[14px]"
          style={{
            maxWidth: "min(96vw, 1200px)", maxHeight: "96vh",
            background: "linear-gradient(158deg, #e03434 0%, #c21c1c 52%, #d32828 100%)",
            borderRadius: 30,
            boxShadow: "0 32px 100px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,160,160,0.09), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -3px 0 rgba(0,0,0,0.3)",
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between flex-shrink-0 mb-4 md:mb-5">
            <a href="https://tormius.com" className="tsk-btn tsk-btn-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/iconarrow.png" alt="" width={13} height={13} style={{ filter: "brightness(0)", transform: "rotate(180deg)" }} />
              <span className="hidden md:inline"> back to home</span><span className="md:hidden"> back</span>
            </a>
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* transparent bg — desktop only */}
              <div className="hidden md:flex items-center gap-1.5">
                <label
                  style={{
                    display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                    ...INTERFACE_FONT, fontSize: 11, fontWeight: 500,
                    color: noBackground ? "white" : "rgba(255,255,255,0.45)",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={noBackground}
                    onChange={(e) => setNoBackground(e.target.checked)}
                    style={{ accentColor: "white", cursor: "pointer", width: 13, height: 13 }}
                  />
                  transparent background
                </label>
              </div>
              {/* save */}
              <button onClick={downloadDrawing} className="tsk-btn tsk-btn-white">
                save
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/iconarrow.png" alt="" width={13} height={13} style={{ filter: "brightness(0)", transform: "rotate(90deg)" }} />
              </button>
              {/* send */}
              <button
                onClick={sendToTormius}
                className={`tsk-btn ${sent ? "tsk-btn-send-done" : "tsk-btn-send-idle"}`}
              >
                {sent ? "check email ✓" : (
                  <>
                    send drawing to tormius
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/iconarrow.png" alt="" width={13} height={13} style={{ filter: "brightness(0)", transform: "rotate(-45deg)" }} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 min-h-0 mb-2.5 md:mb-3">
            <div
              ref={containerRef}
              className="relative w-full h-full overflow-hidden"
              style={{
                borderRadius: 10, background: CANVAS_BG,
                boxShadow: "0 0 0 5px #0b0b0b, 0 0 0 9px rgba(0,0,0,0.32)",
              }}
            >
              {/* Main committed canvas */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: tool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
              />

              {/* Pending stroke canvas — CSS opacity = live opacity preview */}
              <canvas
                ref={pendingRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ opacity: opacity / 100 }}
              />

              {/* Analog static noise */}
              <canvas
                ref={staticRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ imageRendering: "pixelated", opacity: 0.045, zIndex: 8, mixBlendMode: "screen" }}
              />
              <div
                className="absolute inset-x-0 pointer-events-none"
                style={{
                  height: "22%",
                  background: "linear-gradient(to bottom, transparent 0%, rgba(220,220,220,0.055) 50%, transparent 100%)",
                  animation: "scan-drift 5s linear infinite", zIndex: 9,
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.018) 3px, rgba(0,0,0,0.018) 4px)",
                  zIndex: 10,
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)",
                  zIndex: 10,
                }}
              />
            </div>
          </div>

          {/* Controls bar — DESKTOP */}
          <div className="hidden md:flex items-center flex-shrink-0 gap-6">
            {/* LEFT: Size dial */}
            <Dial label="size" value={brushSize} unit="px" min={1} max={40} onRotate={handleSizeDial} />

            {/* CENTER: tools + pixel selector + colors */}
            <div className="flex-1 flex flex-col items-center gap-3">
              {/* Row 1: pen / erase / pixel / clear — single row */}
              <div className="flex items-center gap-2">
                <button aria-label="Use pen" onClick={() => setTool("pen")} style={toolBtnStyle(tool === "pen")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/iconpen.png" alt="" width={28} height={28} style={{ filter: tool === "pen" ? "brightness(0)" : "brightness(0) invert(1)", opacity: tool === "pen" ? 1 : 0.55 }} />
                  <span style={{ ...INTERFACE_FONT, fontSize: 9, fontWeight: 600 }}>pen</span>
                </button>
                <button aria-label="Use eraser" onClick={() => setTool("eraser")} style={toolBtnStyle(tool === "eraser")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/iconerase.png" alt="" width={28} height={28} style={{ filter: tool === "eraser" ? "brightness(0)" : "brightness(0) invert(1)", opacity: tool === "eraser" ? 1 : 0.55 }} />
                  <span style={{ ...INTERFACE_FONT, fontSize: 9, fontWeight: 600 }}>erase</span>
                </button>
                {/* thin divider */}
                <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                <button aria-label="Toggle pixel mode" aria-pressed={pixelMode} onClick={() => setPixelMode((v) => !v)} style={toolBtnStyle(pixelMode)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/iconpixel.png" alt="" width={28} height={28} style={{ filter: pixelMode ? "brightness(0)" : "brightness(0) invert(1)", opacity: pixelMode ? 1 : 0.55 }} />
                  <span style={{ ...INTERFACE_FONT, fontSize: 9, fontWeight: 600 }}>pixel</span>
                </button>
                <button
                  aria-label={clearPending ? "Confirm clear drawing" : "Clear drawing"}
                  onClick={handleClearClick}
                  style={{
                    ...toolBtnStyle(false),
                    background: clearPending ? "rgba(255,210,0,0.95)" : "rgba(255,255,255,0.1)",
                    color: clearPending ? "#000" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/iconclear.png" alt="" width={28} height={28} style={{ filter: clearPending ? "brightness(0)" : "brightness(0) invert(1)", opacity: clearPending ? 1 : 0.55 }} />
                  <span style={{ ...INTERFACE_FONT, fontSize: 9, fontWeight: 600 }}>{clearPending ? "sure?" : "clear"}</span>
                </button>
              </div>

              {/* Row 2: color palette — single line */}
              <div className="flex items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    aria-label={`Use ${c} color`}
                    aria-pressed={color === c && tool !== "eraser"}
                    onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                    className="rounded-full flex-shrink-0 transition-transform hover:scale-110"
                    style={{
                      width: 22, height: 22,
                      backgroundColor: c,
                      outline: color === c && tool !== "eraser"
                        ? "2.5px solid #fff"
                        : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT: Opacity dial */}
            <Dial label="opac" value={opacity} unit="%" min={5} max={100} onRotate={handleOpacityDial} textLeft />
          </div>

          {/* Controls bar — MOBILE */}
          <div className="flex md:hidden flex-col flex-shrink-0 gap-2">
            {/* Row 1: tools */}
            <div className="flex items-center justify-center gap-1.5">
              <button aria-label="Use pen" onClick={() => setTool("pen")} style={mobileTool(tool === "pen")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/iconpen.png" alt="" width={22} height={22} style={{ filter: tool === "pen" ? "brightness(0)" : "brightness(0) invert(1)", opacity: tool === "pen" ? 1 : 0.55 }} />
              </button>
              <button aria-label="Use eraser" onClick={() => setTool("eraser")} style={mobileTool(tool === "eraser")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/iconerase.png" alt="" width={22} height={22} style={{ filter: tool === "eraser" ? "brightness(0)" : "brightness(0) invert(1)", opacity: tool === "eraser" ? 1 : 0.55 }} />
              </button>
              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
              <button aria-label="Toggle pixel mode" aria-pressed={pixelMode} onClick={() => setPixelMode((v) => !v)} style={mobileTool(pixelMode)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/iconpixel.png" alt="" width={22} height={22} style={{ filter: pixelMode ? "brightness(0)" : "brightness(0) invert(1)", opacity: pixelMode ? 1 : 0.55 }} />
              </button>
              <button
                aria-label={clearPending ? "Confirm clear drawing" : "Clear drawing"}
                onClick={handleClearClick}
                style={{
                  ...mobileTool(false),
                  background: clearPending ? "rgba(255,210,0,0.95)" : "rgba(255,255,255,0.1)",
                  color: clearPending ? "#000" : "rgba(255,255,255,0.55)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/iconclear.png" alt="" width={22} height={22} style={{ filter: clearPending ? "brightness(0)" : "brightness(0) invert(1)", opacity: clearPending ? 1 : 0.55 }} />
              </button>
            </div>

            {/* Row 2: color palette */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  aria-label={`Use ${c} color`}
                  aria-pressed={color === c && tool !== "eraser"}
                  onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 24, height: 24,
                    backgroundColor: c,
                    outline: color === c && tool !== "eraser" ? "2.5px solid #fff" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>

            {/* Row 3: size + opacity mini controls */}
            <div className="flex items-center justify-center gap-6">
              {/* Size */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button style={miniCtrlBtn} onClick={() => setBrushSize((s) => Math.max(1, s - 1))}>−</button>
                <div style={{ textAlign: "center", minWidth: 40 }}>
                  <span style={{ ...INTERFACE_FONT, display: "block", fontSize: 8, fontWeight: 500, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)" }}>size</span>
                  <span style={{ ...INTERFACE_FONT, fontSize: 15, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>{brushSize}px</span>
                </div>
                <button style={miniCtrlBtn} onClick={() => setBrushSize((s) => Math.min(40, s + 1))}>+</button>
              </div>
              {/* Opacity */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button style={miniCtrlBtn} onClick={() => setOpacity((o) => Math.max(5, o - 5))}>−</button>
                <div style={{ textAlign: "center", minWidth: 40 }}>
                  <span style={{ ...INTERFACE_FONT, display: "block", fontSize: 8, fontWeight: 500, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)" }}>opac</span>
                  <span style={{ ...INTERFACE_FONT, fontSize: 15, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>{opacity}%</span>
                </div>
                <button style={miniCtrlBtn} onClick={() => setOpacity((o) => Math.min(100, o + 5))}>+</button>
              </div>
            </div>
          </div>

          {/* TORMISKETCH nameplate */}
          <div className="flex items-center gap-3 flex-shrink-0 mt-2.5 md:mt-3">
            <div
              className="rounded-full flex-shrink-0"
              style={{
                width: 34, height: 34,
                background: "radial-gradient(circle at 35% 30%, #383838 0%, #0a0a0a 72%)",
                boxShadow: "0 3px 12px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            />
            <div
              className="flex-1 flex items-center justify-center rounded"
              style={{
                padding: "10px 0 4px", background: "rgba(0,0,0,0.33)",
                boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.055)",
              }}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(14px, 2.1vw, 25px)", color: "rgba(255,255,255,0.86)", textShadow: "0 1px 3px rgba(0,0,0,0.55)", textWrap: "balance" }}>
                TORMISKETCH
              </span>
            </div>
            <div
              className="rounded-full flex-shrink-0"
              style={{
                width: 34, height: 34,
                background: "radial-gradient(circle at 35% 30%, #383838 0%, #0a0a0a 72%)",
                boxShadow: "0 3px 12px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            />
          </div>
        </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
