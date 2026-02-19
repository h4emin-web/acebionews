import { useState, useEffect } from "react";

type Props = {
  text?: string;
};

export const PillLoader = ({ text = "로딩 중..." }: Props) => {
  const [phase, setPhase] = useState<"shake" | "explode">("shake");
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; angle: number; color: string; size: number; delay: number }[]
  >([]);

  useEffect(() => {
    const shakeTimer = setTimeout(() => {
      setPhase("explode");
      // Generate particles
      const colors = [
        "hsl(var(--primary))",
        "hsl(var(--accent))",
        "hsl(var(--pharma-amber))",
        "hsl(var(--pharma-rose))",
        "hsl(var(--pharma-violet))",
        "hsl(var(--pharma-green))",
      ];
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        angle: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
        delay: Math.random() * 0.15,
      }));
      setParticles(newParticles);
    }, 1200);

    const resetTimer = setTimeout(() => {
      setPhase("shake");
      setParticles([]);
    }, 2600);

    return () => {
      clearTimeout(shakeTimer);
      clearTimeout(resetTimer);
    };
  }, [phase === "shake"]);

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Pill */}
        <div
          className={`relative z-10 transition-all duration-300 ${
            phase === "shake" ? "animate-pill-shake" : "animate-pill-pop scale-0 opacity-0"
          }`}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="16" width="32" height="16" rx="8" fill="hsl(var(--primary))" />
            <rect x="24" y="16" width="16" height="16" rx="0" fill="hsl(var(--accent))" />
            <rect x="32" y="16" width="8" height="16" rx="8" fill="hsl(var(--accent))" style={{ clipPath: "inset(0 0 0 0)" }} />
            {/* Shine */}
            <ellipse cx="18" cy="21" rx="6" ry="2" fill="white" opacity="0.4" />
          </svg>
        </div>

        {/* Particles */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute animate-particle pointer-events-none"
            style={{
              "--px": `${p.x}px`,
              "--py": `${p.y}px`,
              "--pr": `${p.angle}deg`,
              animationDelay: `${p.delay}s`,
              width: p.size,
              height: p.size,
              borderRadius: p.size > 8 ? "2px" : "50%",
              backgroundColor: p.color,
              left: "50%",
              top: "50%",
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
            } as React.CSSProperties}
          />
        ))}

        {/* Flash ring */}
        {phase === "explode" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary/40 animate-ping-once" />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-4">{text}</p>
    </div>
  );
};
