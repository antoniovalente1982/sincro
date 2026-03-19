import React from "react";
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";

// ====== CONSTANTS ======
const GOLD = "#c9a84c";
const DARK_GREEN = "#182f20";
const FPS = 30;

// ====== FUTURISTIC SCAN LINE ======
const ScanLine: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const y = (frame * 8) % (height + 200) - 100;

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${GOLD}40, ${GOLD}80, ${GOLD}40, transparent)`,
        zIndex: 50,
        filter: "blur(1px)",
      }}
    />
  );
};

// ====== PARTICLE FIELD ======
const ParticleField: React.FC = () => {
  const frame = useCurrentFrame();
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: ((i * 137.5 + frame * (0.3 + i * 0.05)) % 1080),
    y: ((i * 89.3 + frame * (0.5 + i * 0.03)) % 1920),
    size: 2 + (i % 3),
    opacity: 0.2 + (Math.sin(frame * 0.05 + i) + 1) * 0.15,
  }));

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: GOLD,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${GOLD}`,
            zIndex: 4,
          }}
        />
      ))}
    </>
  );
};

// ====== CONCEPT FLASH — glitch + zoom punch at each concept ======
const ConceptFlash: React.FC<{ trigger: number }> = ({ trigger }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - trigger;

  if (localFrame < 0 || localFrame > 8) return null;

  const flashOpacity = interpolate(localFrame, [0, 2, 8], [0.6, 0.3, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle, ${GOLD}${Math.round(flashOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        zIndex: 40,
        mixBlendMode: "screen",
      }}
    />
  );
};

// ====== 3D PERSPECTIVE TEXT ======
const Text3D: React.FC<{
  text: string;
  startFrame: number;
  style?: "hero" | "impact" | "stat";
}> = ({ text, startFrame, style = "hero" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const scaleIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 8, stiffness: 100, mass: 0.8 },
  });

  const rotateX = interpolate(localFrame, [0, 15], [90, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const glowPulse = interpolate(
    Math.sin(localFrame * 0.12),
    [-1, 1],
    [20, 50]
  );

  const styles: Record<string, React.CSSProperties> = {
    hero: {
      fontSize: 62,
      fontWeight: 900,
      color: "#FFFFFF",
      textShadow: `0 0 ${glowPulse}px rgba(255,255,255,0.5), 0 4px 20px rgba(0,0,0,0.8)`,
      letterSpacing: "-2px",
      lineHeight: 1.1,
    },
    impact: {
      fontSize: 72,
      fontWeight: 900,
      color: GOLD,
      textShadow: `0 0 ${glowPulse}px ${GOLD}, 0 0 ${glowPulse * 2}px rgba(201,168,76,0.3)`,
      letterSpacing: "-3px",
      lineHeight: 1.0,
    },
    stat: {
      fontSize: 110,
      fontWeight: 900,
      color: GOLD,
      textShadow: `0 0 ${glowPulse}px ${GOLD}, 0 0 ${glowPulse * 2}px rgba(201,168,76,0.5)`,
      letterSpacing: "-4px",
    },
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 30,
        right: 30,
        textAlign: "center",
        zIndex: 30,
        perspective: "800px",
      }}
    >
      <div
        style={{
          ...styles[style],
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          transform: `scale(${scaleIn}) rotateX(${rotateX}deg)`,
          transformOrigin: "center bottom",
          opacity: scaleIn,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ====== ANIMATED STAT COUNTER ======
const AnimatedCounter: React.FC<{
  number: number;
  suffix: string;
  label: string;
  startFrame: number;
}> = ({ number, suffix, label, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 30, stiffness: 60 },
  });

  const current = Math.round(number * progress);
  const glow = interpolate(Math.sin(localFrame * 0.1), [-1, 1], [20, 60]);

  const barWidth = interpolate(progress, [0, 1], [0, 100]);

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 0,
        right: 0,
        textAlign: "center",
        zIndex: 30,
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 900,
          fontFamily: "'Inter', sans-serif",
          color: GOLD,
          textShadow: `0 0 ${glow}px ${GOLD}, 0 0 ${glow * 2}px rgba(201,168,76,0.4)`,
          transform: `scale(${progress})`,
        }}
      >
        {current.toLocaleString("it-IT")}{suffix}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#FFFFFF",
          letterSpacing: "5px",
          textTransform: "uppercase",
          marginTop: 12,
          opacity: progress,
        }}
      >
        {label}
      </div>
      {/* Animated underline */}
      <div
        style={{
          margin: "16px auto 0",
          width: 200,
          height: 3,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: "100%",
            background: `linear-gradient(90deg, transparent, ${GOLD})`,
            borderRadius: 2,
            boxShadow: `0 0 10px ${GOLD}`,
          }}
        />
      </div>
    </div>
  );
};

// ====== TRUSTPILOT HOLOGRAPHIC BADGE ======
const HoloBadge: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const shimmer = (localFrame * 3) % 400;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 380,
        left: 40,
        right: 40,
        zIndex: 30,
        transform: `scale(${scale})`,
        opacity: scale,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(0,0,0,0.7), rgba(24,47,32,0.8))",
          border: "1px solid rgba(201,168,76,0.4)",
          borderRadius: 20,
          padding: "20px 30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shimmer effect */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: shimmer - 200,
            width: 100,
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)",
            transform: "skewX(-20deg)",
          }}
        />
        <span style={{ fontSize: 32, color: "#00b67a" }}>★★★★★</span>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>
            4.9 / 5 Trustpilot
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
            356 famiglie soddisfatte
          </div>
        </div>
      </div>
    </div>
  );
};

// ====== FUTURISTIC CTA ======
const FuturisticCTA: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const slideUp = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const borderGlow = interpolate(Math.sin(localFrame * 0.15), [-1, 1], [0.3, 0.8]);
  const pulse = interpolate(Math.sin(localFrame * 0.2), [-1, 1], [1, 1.04]);
  const arrowX = interpolate(Math.sin(localFrame * 0.3), [-1, 1], [0, 8]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 100,
        left: 30,
        right: 30,
        zIndex: 30,
        transform: `translateY(${(1 - slideUp) * 120}px)`,
        opacity: slideUp,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${GOLD}, #e8c968, ${GOLD})`,
          borderRadius: 20,
          padding: "24px 40px",
          textAlign: "center",
          transform: `scale(${pulse})`,
          boxShadow: `0 0 30px rgba(201,168,76,${borderGlow}), 0 10px 40px rgba(0,0,0,0.4)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Inner shimmer */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: ((localFrame * 4) % 600) - 200,
            width: 120,
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
            transform: "skewX(-20deg)",
          }}
        />
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: DARK_GREEN,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: "-1px",
            position: "relative",
          }}
        >
          CONSULENZA GRATUITA{" "}
          <span style={{ display: "inline-block", transform: `translateX(${arrowX}px)` }}>→</span>
        </div>
      </div>
      <div
        style={{
          textAlign: "center",
          marginTop: 14,
          fontSize: 18,
          color: `rgba(201,168,76,${0.4 + borderGlow * 0.3})`,
          fontWeight: 700,
          letterSpacing: "6px",
          textTransform: "uppercase",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        METODO SINCRO®
      </div>
    </div>
  );
};

// ====== PROGRESS BAR ======
const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.08)", zIndex: 100 }}>
      <div style={{
        height: "100%",
        width: `${progress * 100}%`,
        background: `linear-gradient(90deg, ${GOLD}60, ${GOLD})`,
        boxShadow: `0 0 15px ${GOLD}80`,
      }} />
    </div>
  );
};

// ====== CINEMATIC OVERLAYS ======
const CinematicOverlay: React.FC = () => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 350, background: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)", zIndex: 3 }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 550, background: `linear-gradient(0deg, ${DARK_GREEN}F0 0%, ${DARK_GREEN}99 30%, transparent 100%)`, zIndex: 3 }} />
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, boxShadow: "inset 0 0 200px rgba(0,0,0,0.5)", zIndex: 2 }} />
  </>
);

// ====== MAIN COMPOSITION ======
export const MetodoSincroAd: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.12]);

  // Concept flash triggers (at key script moments)
  const flashFrames = [0, FPS * 5, FPS * 10, FPS * 16, FPS * 22];

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_GREEN }}>
      {/* Video with subtle zoom */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <Video src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <CinematicOverlay />
      <ProgressBar />
      <ScanLine />
      <ParticleField />

      {/* Concept flashes */}
      {flashFrames.map((f, i) => (
        <ConceptFlash key={i} trigger={f} />
      ))}

      {/* 0-4s: Hook text with 3D perspective */}
      <Sequence from={0} durationInFrames={FPS * 5}>
        <Text3D text="Tuo figlio ha talento." startFrame={0} style="hero" />
      </Sequence>

      {/* 5-9s: Impact text */}
      <Sequence from={FPS * 5} durationInFrames={FPS * 5}>
        <Text3D text="Ma qualcosa lo blocca." startFrame={0} style="impact" />
      </Sequence>

      {/* 16-22s: Counter animation */}
      <Sequence from={FPS * 16} durationInFrames={FPS * 7}>
        <AnimatedCounter number={2100} suffix="+" label="calciatori trasformati" startFrame={0} />
      </Sequence>

      {/* 22-28s: Trustpilot holographic badge */}
      <Sequence from={FPS * 22}>
        <HoloBadge startFrame={0} />
      </Sequence>

      {/* Last 6s: Futuristic CTA */}
      <Sequence from={durationInFrames - FPS * 6}>
        <FuturisticCTA startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
