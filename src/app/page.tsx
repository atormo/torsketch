"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { Download, InfoBox } from "pixelarticons/react";

const SCREEN_COLOR = "#d2d0c4";
const LINE_COLOR = "#6d6e68";
const LINE_WIDTH = 2.2;
const TURN_TO_PIXELS = 0.72;

type Axis = "horizontal" | "vertical";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface EtchKnobProps {
  axis: Axis;
  rotation: number;
  onTurn: (delta: number) => void;
}

function EtchKnob({ axis, rotation, onTurn }: EtchKnobProps) {
  const knobRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{
    pointerId: number;
    centerX: number;
    centerY: number;
    lastAngle: number;
  } | null>(null);

  const getAngle = (clientX: number, clientY: number) => {
    const current = gesture.current;
    if (!current) return 0;
    return Math.atan2(clientY - current.centerY, clientX - current.centerX) * (180 / Math.PI);
  };

  const startTurning = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    gesture.current = {
      pointerId: event.pointerId,
      centerX,
      centerY,
      lastAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const turn = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;

    const angle = getAngle(event.clientX, event.clientY);
    let delta = angle - current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    current.lastAngle = angle;
    onTurn(delta);
  };

  const stopTurning = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const useKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    let delta = 0;

    if (axis === "horizontal") {
      if (event.key === "ArrowLeft") delta = -18;
      if (event.key === "ArrowRight") delta = 18;
    } else {
      if (event.key === "ArrowUp") delta = -18;
      if (event.key === "ArrowDown") delta = 18;
    }

    if (delta === 0) return;
    event.preventDefault();
    onTurn(delta);
  };

  const label = axis === "horizontal"
    ? "Horizontal drawing dial. Turn it or use the left and right arrow keys."
    : "Vertical drawing dial. Turn it or use the up and down arrow keys.";
  const counterclockwiseLabel = axis === "horizontal" ? "Left" : "Up";
  const clockwiseLabel = axis === "horizontal" ? "Right" : "Down";
  const counterclockwisePathId = `etch-${axis}-counterclockwise`;
  const clockwisePathId = `etch-${axis}-clockwise`;

  return (
    <button
      ref={knobRef}
      type="button"
      data-no-shake
      aria-label={label}
      title={axis === "horizontal" ? "Draw left and right" : "Draw up and down"}
      className="etch-knob relative shrink-0 rounded-full"
      onPointerDown={startTurning}
      onPointerMove={turn}
      onPointerUp={stopTurning}
      onPointerCancel={stopTurning}
      onKeyDown={useKeyboard}
    >
      <span
        className="etch-knob-rotor pointer-events-none absolute inset-0"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg
          className="etch-knob-guide absolute inset-0 size-full"
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <path id={counterclockwisePathId} d="M 12 49 A 38 38 0 0 1 46 12" />
            <path id={clockwisePathId} d="M 54 12 A 38 38 0 0 1 88 49" />
          </defs>
          <text>
            <textPath href={`#${counterclockwisePathId}`} startOffset="50%" textAnchor="middle">
              {counterclockwiseLabel}
            </textPath>
          </text>
          <text>
            <textPath href={`#${clockwisePathId}`} startOffset="50%" textAnchor="middle">
              {clockwiseLabel}
            </textPath>
          </text>
        </svg>
        <span className="etch-knob-cap absolute inset-[13%] rounded-full" />
        <span className="etch-knob-mark absolute left-1/2 top-[12%] -translate-x-1/2" />
      </span>
    </button>
  );
}

export default function TorSketchPage() {
  const [booted, setBooted] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [leftRotation, setLeftRotation] = useState(0);
  const [rightRotation, setRightRotation] = useState(0);
  const [eraseStatus, setEraseStatus] = useState("");
  const reduceMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const screenSize = useRef({ width: 0, height: 0 });
  const eraseProgress = useRef(0);
  const hasDrawing = useRef(false);
  const shakeGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    direction: number;
  } | null>(null);

  const shellXOffset = useMotionValue(0);
  const shellYOffset = useMotionValue(0);
  const shellRotateOffset = useMotionValue(0);
  const shellX = useSpring(shellXOffset, { stiffness: 460, damping: 30, mass: 0.5 });
  const shellY = useSpring(shellYOffset, { stiffness: 520, damping: 32, mass: 0.55 });
  const shellRotate = useSpring(shellRotateOffset, { stiffness: 420, damping: 26, mass: 0.45 });

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), reduceMotion ? 0 : 1400);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!infoOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setInfoOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [infoOpen]);

  useEffect(() => {
    if (!booted) return;
    const canvas = canvasRef.current;
    const screen = screenRef.current;
    if (!canvas || !screen) return;

    const resizeCanvas = () => {
      const width = Math.max(1, Math.round(screen.clientWidth));
      const height = Math.max(1, Math.round(screen.clientHeight));
      const previous = screenSize.current;
      if (width === previous.width && height === previous.height) return;

      const snapshot = document.createElement("canvas");
      if (previous.width > 0 && previous.height > 0) {
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = SCREEN_COLOR;
      context.fillRect(0, 0, width, height);
      if (snapshot.width > 0 && snapshot.height > 0) {
        context.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, height);
      }

      const cursor = cursorRef.current;
      cursorRef.current = cursor && previous.width > 0 && previous.height > 0
        ? {
            x: clamp((cursor.x / previous.width) * width, 2, width - 2),
            y: clamp((cursor.y / previous.height) * height, 2, height - 2),
          }
        : { x: width / 2, y: height / 2 };
      screenSize.current = { width, height };
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(screen);
    resizeCanvas();
    return () => observer.disconnect();
  }, [booted]);

  const moveStylus = useCallback((axis: Axis, deltaDegrees: number) => {
    if (!Number.isFinite(deltaDegrees) || Math.abs(deltaDegrees) < 0.01) return;

    if (axis === "horizontal") {
      setLeftRotation((rotation) => rotation + deltaDegrees);
    } else {
      setRightRotation((rotation) => rotation + deltaDegrees);
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const { width, height } = screenSize.current;
    if (!canvas || !context || width === 0 || height === 0) return;

    const current = cursorRef.current ?? { x: width / 2, y: height / 2 };
    const distance = deltaDegrees * TURN_TO_PIXELS;
    const next = axis === "horizontal"
      ? { x: clamp(current.x + distance, 2, width - 2), y: current.y }
      : { x: current.x, y: clamp(current.y + distance, 2, height - 2) };

    if (next.x === current.x && next.y === current.y) return;

    context.beginPath();
    context.moveTo(current.x, current.y);
    context.lineTo(next.x, next.y);
    context.strokeStyle = LINE_COLOR;
    context.lineWidth = LINE_WIDTH;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    cursorRef.current = next;
    hasDrawing.current = true;
    eraseProgress.current = 0;
    setEraseStatus("");
  }, []);

  const turnHorizontal = useCallback(
    (delta: number) => moveStylus("horizontal", delta),
    [moveStylus],
  );
  const turnVertical = useCallback(
    (delta: number) => moveStylus("vertical", delta),
    [moveStylus],
  );

  const fadeDrawing = useCallback((amount: number) => {
    const context = canvasRef.current?.getContext("2d");
    const { width, height } = screenSize.current;
    if (!context || width === 0 || height === 0) return;

    context.save();
    context.globalAlpha = amount;
    context.fillStyle = SCREEN_COLOR;
    context.fillRect(0, 0, width, height);
    context.restore();
  }, []);

  const clearDrawing = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    const { width, height } = screenSize.current;
    if (!context || width === 0 || height === 0) return;
    context.fillStyle = SCREEN_COLOR;
    context.fillRect(0, 0, width, height);
    hasDrawing.current = false;
    eraseProgress.current = 0;
    setEraseStatus("Drawing erased");
  }, []);

  const startShaking = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-no-shake]")) return;

    shakeGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      direction: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const shake = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = shakeGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const now = performance.now();
    const deltaX = event.clientX - gesture.lastX;
    const deltaY = event.clientY - gesture.lastY;
    const elapsed = Math.max(1, now - gesture.lastTime);
    const speed = Math.abs(deltaY) / elapsed;

    if (!reduceMotion) {
      const travelX = event.clientX - gesture.startX;
      const travelY = event.clientY - gesture.startY;
      const verticalImpulse = clamp(deltaY * 0.09, -2.6, 2.6);

      shellXOffset.set(clamp(travelX * 0.18 - verticalImpulse * 1.35 + deltaX * 0.12, -8, 8));
      shellYOffset.set(clamp(travelY * 0.28 + deltaY * 0.22, -26, 26));
      shellRotateOffset.set(clamp(travelX * 0.025 - verticalImpulse * 0.78, -2.2, 2.2));
    }

    if (Math.abs(deltaY) < 3) {
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.lastTime = now;
      return;
    }

    const direction = Math.sign(deltaY);
    if (hasDrawing.current && gesture.direction !== 0 && direction !== gesture.direction && speed > 0.22) {
      const increment = clamp(0.08 + speed * 0.035, 0.09, 0.16);
      eraseProgress.current = clamp(eraseProgress.current + increment, 0, 1);
      fadeDrawing(clamp(0.12 + speed * 0.035, 0.13, 0.24));

      if (eraseProgress.current >= 0.96) {
        clearDrawing();
      } else {
        setEraseStatus(`Erasing drawing: ${Math.round(eraseProgress.current * 100)}%`);
      }
    }

    gesture.direction = direction;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    gesture.lastTime = now;
  };

  const stopShaking = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (shakeGesture.current?.pointerId !== event.pointerId) return;
    shakeGesture.current = null;
    shellXOffset.set(0);
    shellYOffset.set(0);
    shellRotateOffset.set(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const downloadDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "torsketch.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-cover bg-center p-3 md:p-4"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 0 0.7px, transparent 0.8px), url('/torsketch-hills.png')",
        backgroundSize: "4px 4px, cover",
        backgroundPosition: "0 0, center",
        backgroundRepeat: "repeat, no-repeat",
      }}
    >
      <style>{`
        @keyframes letter-fill {
          from { clip-path: inset(100% 0 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }

        .boot-letter {
          font-family: var(--font-display);
          font-synthesis: none;
          font-weight: 400;
          text-transform: uppercase;
        }
        .etch-action {
          display: inline-flex;
          width: 56px;
          height: 56px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 10px;
          background: #f7f5ed;
          color: #171717;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(0,0,0,0.1);
          transition: transform 150ms ease-out, box-shadow 150ms ease-out;
        }
        .etch-action:hover {
          box-shadow: 0 11px 28px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.1);
        }
        .etch-action:active { transform: scale(0.96); }
        .etch-action:focus-visible {
          outline: 3px solid #fff;
          outline-offset: 3px;
        }

        .etch-brand-strip {
          display: flex;
          width: 56px;
          height: 360px;
          align-items: flex-start;
          justify-content: center;
          color: #fff;
        }
        .etch-brand-word {
          font-family: var(--font-display);
          font-size: 48px;
          font-synthesis: none;
          font-weight: 400;
          line-height: 1;
          white-space: nowrap;
          text-transform: uppercase;
          writing-mode: vertical-rl;
          text-shadow:
            0 2px 0 rgba(0, 0, 0, 0.52),
            0 7px 16px rgba(0, 0, 0, 0.68),
            0 16px 34px rgba(0, 0, 0, 0.38);
        }

        .etch-shell { cursor: grab; touch-action: none; }
        .etch-shell:active { cursor: grabbing; }
        [data-no-shake] { cursor: default; }

        .etch-knob {
          width: clamp(92px, 11vw, 140px);
          aspect-ratio: 1;
          border: 0;
          background: #e5e1d4;
          cursor: grab;
          touch-action: none;
          box-shadow:
            0 10px 24px rgba(0,0,0,0.62),
            0 0 0 4px rgba(91,25,22,0.42),
            inset 0 2px 2px rgba(255,255,255,0.95),
            inset 0 -5px 8px rgba(88,84,74,0.34);
        }
        .etch-knob:active { cursor: grabbing; }
        .etch-knob:focus-visible {
          outline: 4px solid rgba(255,255,255,0.92);
          outline-offset: 6px;
        }
        .etch-knob-guide {
          color: #66645e;
        }
        .etch-knob-guide text {
          fill: currentColor;
          font-family: var(--font-interface);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .etch-knob-cap {
          background: radial-gradient(circle at 38% 32%, #fffdf5 0%, #dedacc 72%, #c1bcad 100%);
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.18);
        }
        .etch-knob-mark {
          width: 8%;
          height: 22%;
          min-width: 6px;
          border-radius: 999px;
          background: #8e8b81;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.5);
        }

        @media (max-width: 767px) {
          .etch-action { width: 48px; height: 48px; }
          .etch-brand-strip { width: 48px; height: 180px; }
          .etch-brand-word { font-size: 27px; }
          .etch-knob { width: clamp(82px, 24vw, 102px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .boot-letter { animation: none !important; clip-path: none !important; }
          .etch-action { transition-duration: 0.01ms; }
        }
      `}</style>

      <AnimatePresence>
        {!booted ? (
          <motion.div
            key="boot"
            className="absolute inset-0 flex items-center justify-center bg-black"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
          >
            <div className="flex" aria-label="TorSketch">
              {"TorSketch".split("").map((letter, index) => (
                <span
                  key={`${letter}-${index}`}
                  className="boot-letter inline-block text-white"
                  style={{
                    fontSize: "clamp(52px, 13vw, 132px)",
                    animation: `letter-fill 0.1s ${index * 0.055}s ease-out forwards`,
                    clipPath: "inset(100% 0 0 0)",
                  }}
                  aria-hidden="true"
                >
                  {letter}
                </span>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            className="relative mx-auto grid size-full max-w-[1344px] grid-cols-2 grid-rows-[180px_minmax(0,1fr)] gap-y-3 md:grid-cols-[56px_minmax(0,1200px)_56px] md:grid-rows-1 md:gap-x-4 md:gap-y-0"
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
          >
            <div className="z-20 col-start-1 row-start-1 flex items-start justify-start">
              <div className="etch-brand-strip" aria-label="TorSketch">
                <span className="etch-brand-word" aria-hidden="true">TorSketch</span>
              </div>
            </div>

            <motion.div
              className="etch-shell relative col-span-2 row-start-2 flex min-h-0 flex-col rounded-[30px] px-3 pb-4 pt-3 md:col-span-1 md:col-start-2 md:row-start-1 md:px-6 md:pb-5 md:pt-5"
              style={{
                x: reduceMotion ? 0 : shellX,
                y: reduceMotion ? 0 : shellY,
                rotate: reduceMotion ? 0 : shellRotate,
                background: "linear-gradient(158deg, #e43736 0%, #c61d1d 54%, #d52a29 100%)",
                boxShadow: "0 28px 90px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -4px 0 rgba(0,0,0,0.24)",
              }}
              onPointerDown={startShaking}
              onPointerMove={shake}
              onPointerUp={stopShaking}
              onPointerCancel={stopShaking}
            >
              <div
                ref={screenRef}
                data-no-shake
                className="relative min-h-0 flex-1 overflow-hidden rounded-[12px]"
                style={{
                  background: SCREEN_COLOR,
                  boxShadow: "0 0 0 5px #171717, 0 0 0 9px rgba(0,0,0,0.3), inset 0 0 42px rgba(70,70,64,0.22)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 size-full"
                  role="img"
                  aria-label="TorSketch drawing surface"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.018) 3px 4px)",
                    boxShadow: "inset 0 0 54px rgba(58,58,52,0.28)",
                  }}
                />
              </div>

              <div className="flex shrink-0 items-end justify-between px-1 pt-4 md:px-2 md:pt-5">
                <EtchKnob axis="horizontal" rotation={leftRotation} onTurn={turnHorizontal} />
                <EtchKnob axis="vertical" rotation={rightRotation} onTurn={turnVertical} />
              </div>

              <p className="sr-only" aria-live="polite">{eraseStatus}</p>
            </motion.div>

            <div className="relative z-20 col-start-2 row-start-1 flex flex-col items-end justify-start gap-2 md:col-start-3">
              <button
                type="button"
                className="etch-action"
                aria-label="Download drawing"
                title="Download drawing"
                onClick={downloadDrawing}
              >
                <Download width={30} height={30} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="etch-action"
                aria-label="How to use TorSketch"
                aria-expanded={infoOpen}
                aria-controls="torsketch-info"
                title="How to use TorSketch"
                onClick={() => setInfoOpen((open) => !open)}
              >
                <InfoBox width={30} height={30} aria-hidden="true" />
              </button>

              <AnimatePresence initial={false}>
                {infoOpen && (
                  <motion.aside
                    id="torsketch-info"
                    className="absolute right-0 top-[calc(100%+10px)] w-[min(330px,calc(100vw-24px))] rounded-lg bg-[#f7f5ed] p-5 text-[#171717] shadow-2xl md:right-[calc(100%+12px)] md:top-0"
                    initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : -4 }}
                    transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
                    aria-label="How to use TorSketch"
                  >
                    <h1 className="mb-3 text-balance text-lg font-semibold">Draw like a real TeleSketch</h1>
                    <ol className="list-decimal space-y-2 pl-5 text-pretty text-sm leading-6">
                      <li>Turn the left dial to draw left and right.</li>
                      <li>Turn the right dial to draw up and down.</li>
                      <li>Grab any red part and shake it quickly up and down to erase.</li>
                    </ol>
                    <p className="mt-4 text-left text-xs text-black/60">
                      made by{" "}
                      <a
                        href="https://tormo.at"
                        className="font-medium text-black underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        target="_blank"
                        rel="noreferrer"
                      >
                        tormo.at
                      </a>
                    </p>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
