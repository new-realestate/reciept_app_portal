import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

/** A point as a fraction of the pad's width/height, so strokes survive resizes. */
interface Point {
  x: number;
  y: number;
  /** Pointer pressure, 0..1 (mouse reports 0.5 while pressed). */
  p: number;
}
type Stroke = Point[];

export interface SignaturePadHandle {
  undo: () => void;
  clear: () => void;
  /** False until something long enough to be a signature has been drawn. */
  hasSignature: () => boolean;
  /** The drawing as a transparent PNG cropped to the ink, or null when empty. */
  toPngBlob: () => Promise<Blob | null>;
}

const INK = "#111827";
/** Pad width (CSS px) at which strokes use BASE_LINE_WIDTH; wider/narrower pads scale the line. */
const REFERENCE_WIDTH = 600;
const BASE_LINE_WIDTH = 2.4;
/** Anything shorter (in reference px) is a tap or a slip, not a signature. */
const MIN_INK_LENGTH = 40;
const EXPORT_MAX_WIDTH = 600;

function strokeWidth(stroke: Stroke, padWidth: number): number {
  const avg = stroke.reduce((sum, pt) => sum + pt.p, 0) / stroke.length;
  // Mouse (0.5) draws at the base width; a stylus pressed harder draws a little thicker.
  return BASE_LINE_WIDTH * (padWidth / REFERENCE_WIDTH) * (0.75 + avg * 0.5);
}

/** Draws strokes onto `ctx` in a coordinate space `w` x `h` (already transformed by the caller). */
function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    const pts = stroke.map((pt) => ({ x: pt.x * w, y: pt.y * h }));
    const width = strokeWidth(stroke, w);
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    // Quadratic curves through the midpoints give a smooth, pen-like line.
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

function inkLength(strokes: Stroke[], w: number, h: number): number {
  let total = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      total += Math.hypot((stroke[i].x - stroke[i - 1].x) * w, (stroke[i].y - stroke[i - 1].y) * h);
    }
  }
  return total;
}

/**
 * Canvas for drawing a handwritten signature with a mouse, finger or stylus.
 * The pad keeps a 3:1 aspect ratio; strokes are stored relative to its size and
 * redrawn on resize, so rotating a phone or resizing the window never distorts them.
 */
export function SignaturePad({
  ref,
  onChange,
  describedBy,
}: {
  ref?: Ref<SignaturePadHandle>;
  /** Called with the number of strokes after every change. */
  onChange?: (strokeCount: number) => void;
  describedBy?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = canvas;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawStrokes(ctx, strokesRef.current, w, h);
  }, []);

  const changed = useCallback(() => {
    const count = strokesRef.current.length;
    setStrokeCount(count);
    onChange?.(count);
  }, [onChange]);

  // Size the backing store to the element (times the pixel ratio, for crisp lines) and redraw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  function pointFrom(e: PointerEvent | React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === "mouse" || !e.pressure ? 0.5 : e.pressure;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      p: pressure,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, [pointFrom(e)]];
    redraw();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    // Coalesced events keep fast strokes smooth on high-frequency pens and touchscreens.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) stroke.push(pointFrom(ev));
    redraw();
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    changed();
  }

  useImperativeHandle(
    ref,
    () => ({
      undo() {
        strokesRef.current = strokesRef.current.slice(0, -1);
        redraw();
        changed();
      },
      clear() {
        strokesRef.current = [];
        redraw();
        changed();
      },
      hasSignature() {
        return inkLength(strokesRef.current, REFERENCE_WIDTH, REFERENCE_WIDTH / 3) >= MIN_INK_LENGTH;
      },
      async toPngBlob() {
        const strokes = strokesRef.current;
        if (!strokes.length) return null;
        // Lay the strokes out at a fixed size, crop to the ink, and scale down to the export width.
        const w = REFERENCE_WIDTH * 2;
        const h = w / 3;
        const xs = strokes.flat().map((pt) => pt.x * w);
        const ys = strokes.flat().map((pt) => pt.y * h);
        const pad = BASE_LINE_WIDTH * 4 + 8;
        const minX = Math.max(0, Math.min(...xs) - pad);
        const minY = Math.max(0, Math.min(...ys) - pad);
        const cropW = Math.min(w, Math.max(...xs) + pad) - minX;
        const cropH = Math.min(h, Math.max(...ys) + pad) - minY;
        const scale = Math.min(1, EXPORT_MAX_WIDTH / cropW);

        const out = document.createElement("canvas");
        out.width = Math.max(1, Math.round(cropW * scale));
        out.height = Math.max(1, Math.round(cropH * scale));
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
        drawStrokes(ctx, strokes, w, h); // transparent background
        return new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
      },
    }),
    [redraw, changed],
  );

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        className="signature-pad__canvas"
        aria-label="Signature drawing area"
        aria-describedby={describedBy}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onContextMenu={(e) => e.preventDefault()}
      />
      <span className="signature-pad__baseline" aria-hidden />
      {strokeCount === 0 && (
        <span className="signature-pad__placeholder" aria-hidden>
          Sign here using your finger or mouse
        </span>
      )}
    </div>
  );
}
