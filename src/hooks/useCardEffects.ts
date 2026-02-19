import { useRef, useCallback, useState } from "react";

type Ripple = { x: number; y: number; id: number };

export function useCardEffects() {
  const ref = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  let rippleId = useRef(0);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) scale3d(1.02, 1.02, 1.02)`;
    el.style.boxShadow = `${-x * 12}px ${y * 12}px 24px hsl(var(--border) / 0.35)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "";
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = ++rippleId.current;
    setRipples((prev) => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
  }, []);

  return { ref, ripples, handlePointerMove, handlePointerLeave, handleClick };
}
