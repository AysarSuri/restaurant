import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Offset = { x: number; y: number };

/**
 * Pointer-drag offset for floating panels (keyboard / numeric pad dialogs).
 * Drag from a handle only — keys/buttons stay clickable.
 */
export function usePanelDrag(active: boolean) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const dragging = useRef(false);
  const start = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 });

  useEffect(() => {
    if (active) setOffset({ x: 0, y: 0 });
  }, [active]);

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      start.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [offset.x, offset.y]
  );

  const onHandlePointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.pointerX;
    const dy = e.clientY - start.current.pointerY;
    const nextX = start.current.originX + dx;
    const nextY = start.current.originY + dy;
    const maxX = Math.max(40, window.innerWidth * 0.45);
    const maxY = Math.max(40, window.innerHeight * 0.45);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    });
  }, []);

  const onHandlePointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    offset,
    handleProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerUp,
      onPointerCancel: onHandlePointerUp,
    },
  };
}
