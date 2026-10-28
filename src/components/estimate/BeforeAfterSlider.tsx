import { useRef, type ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface BeforeAfterSliderProps {
  split: number;
  onSplit: (value: number) => void;
  min: number;
  max: number;
  ariaLabel: string;
  ariaValueText: string;
  beforeLabel: string;
  afterLabel: string;
  stageClassName: string;
  dividerClassName: string;
  handleClassName: string;
  rangeClassName: string;
  rangeInputClassName: string;
  enabled?: boolean;
  children: ReactNode;
}

export function BeforeAfterSlider({
  split,
  onSplit,
  min,
  max,
  ariaLabel,
  ariaValueText,
  beforeLabel,
  afterLabel,
  stageClassName,
  dividerClassName,
  handleClassName,
  rangeClassName,
  rangeInputClassName,
  enabled = true,
  children,
}: BeforeAfterSliderProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragActiveRef = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    const percentage = Math.round(((clientX - bounds.left) / bounds.width) * 100);
    onSplit(Math.max(min, Math.min(max, percentage)));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    pointerStartRef.current = null;
    dragActiveRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may already have released capture after cancelling a touch gesture.
      }
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType !== "touch" && event.button !== 0)) return;
    activePointerIdRef.current = event.pointerId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    dragActiveRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Movement still works while the pointer remains over the comparison image.
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    if (!dragActiveRef.current) {
      const start = pointerStartRef.current;
      if (!start) return;
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      const horizontal = Math.abs(deltaX);
      const vertical = Math.abs(deltaY);
      if (vertical >= 8 && vertical > horizontal) {
        finishPointer(event);
        return;
      }
      if (horizontal < 6 || horizontal <= vertical * 1.1) return;
      dragActiveRef.current = true;
    }
    updateFromClientX(event.clientX);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === event.pointerId && dragActiveRef.current) updateFromClientX(event.clientX);
    finishPointer(event);
  };

  return (
    <>
      <div
        ref={stageRef}
        onPointerDown={enabled ? onPointerDown : undefined}
        onPointerMove={enabled ? onPointerMove : undefined}
        onPointerUp={enabled ? onPointerUp : undefined}
        onPointerCancel={enabled ? finishPointer : undefined}
        onLostPointerCapture={enabled ? finishPointer : undefined}
        className={stageClassName}
      >
        {children}
        {enabled && (
          <div className={`pointer-events-none absolute inset-y-0 w-0.5 bg-white ${dividerClassName}`} style={{ left: `${split}%` }}>
            <span className={handleClassName}>↔</span>
          </div>
        )}
      </div>
      {enabled && (
        <label className={rangeClassName}>
          <span className="shrink-0">{beforeLabel}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={split}
            onChange={(event) => onSplit(Number(event.target.value))}
            aria-label={ariaLabel}
            aria-valuetext={ariaValueText}
            className={rangeInputClassName}
          />
          <span className="shrink-0">{afterLabel}</span>
        </label>
      )}
    </>
  );
}
