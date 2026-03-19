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
  staticFile,
} from "remotion";

const GOLD = "#c9a84c";
const DARK = "#0a0f0e";
const FPS = 30;

/* ═══════════════════════════════════════════════════════
   SCREEN SHAKE — camera trembles on every scene cut
   ═══════════════════════════════════════════════════════ */
const useScreenShake = (triggerFrames: number[]) => {
  const frame = useCurrentFrame();
  let shakeX = 0, shakeY = 0, shakeRot = 0;
  for (const t of triggerFrames) {
    const d = frame - t;
    if (d >= 0 && d < 10) {
      const intensity = interpolate(d, [0, 10], [18, 0], { extrapolateRight: "clamp" });
      shakeX += Math.sin(d * 8.3) * intensity;
      shakeY += Math.cos(d * 6.7) * intensity * 0.7;
      shakeRot += Math.sin(d * 5.1) * intensity * 0.15;
    }
  }
  return { shakeX, shakeY, shakeRot };
};

/* ═══════════════════════════════════════════════════════
   GLITCH TRANSITION — RGB split + bars on scene cuts
   ═══════════════════════════════════════════════════════ */
const GlitchTransition: React.FC<{ triggerFrame: number }> = ({ triggerFrame }) => {
  const frame = useCurrentFrame();
  const d = frame - triggerFrame;
  if (d < -2 || d > 8) return null;

  const intensity = interpolate(d, [0, 3, 8], [1, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bars = Array.from({ length: 6 }, (_, i) => ({
    top: `${(i * 17 + d * 30) % 100}%`,
    height: `${3 + Math.random() * 5}%`,
    opacity: intensity * (0.4 + Math.random() * 0.3),
  }));

  return (
    <>
      {/* RGB split flash */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 60,
        background: `rgba(255,0,0,${intensity * 0.15})`,
        transform: `translateX(${intensity * 8}px)`,
        mixBlendMode: "screen",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 60,
        background: `rgba(0,255,255,${intensity * 0.12})`,
        transform: `translateX(${-intensity * 6}px)`,
        mixBlendMode: "screen",
      }} />
      {/* Glitch bars */}
      {bars.map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: 0, right: 0, zIndex: 61,
          top: b.top, height: b.height,
          background: `rgba(255,255,255,${b.opacity})`,
          transform: `translateX(${(i % 2 ? 1 : -1) * intensity * 40}px)`,
        }} />
      ))}
      {/* White flash */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 59,
        background: `rgba(255,255,255,${d < 2 ? intensity * 0.5 : 0})`,
      }} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════
   SLAM TEXT — huge text that crashes in from a direction
   ═══════════════════════════════════════════════════════ */
const SlamText: React.FC<{
  text: string; startFrame: number; direction?: "left" | "right" | "top" | "bottom";
  color?: string; size?: number; duration?: number;
}> = ({ text, startFrame, direction = "left", color = "#fff", size = 90, duration = FPS * 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > duration) return null;

  const slam = spring({ frame: local, fps, config: { damping: 6, stiffness: 200, mass: 0.5 } });
  const fadeOut = interpolate(local, [duration - 10, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const offset = 800;
  const transforms: Record<string, string> = {
    left: `translateX(${interpolate(slam, [0, 1], [-offset, 0])}px)`,
    right: `translateX(${interpolate(slam, [0, 1], [offset, 0])}px)`,
    top: `translateY(${interpolate(slam, [0, 1], [-offset, 0])}px)`,
    bottom: `translateY(${interpolate(slam, [0, 1], [offset, 0])}px)`,
  };

  const slamScale = interpolate(local, [0, 4, 8], [1.6, 1.1, 1], { extrapolateRight: "clamp" });
  const glow = interpolate(Math.sin(local * 0.15), [-1, 1], [30, 80]);

  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 35,
    }}>
      <div style={{
        fontSize: size, fontWeight: 900, fontFamily: "'Inter',sans-serif",
        color, textTransform: "uppercase", letterSpacing: "-4px", lineHeight: 1,
        textShadow: `0 0 ${glow}px ${color === GOLD ? GOLD : "rgba(255,255,255,0.6)"}, 0 6px 40px rgba(0,0,0,0.9)`,
        transform: `${transforms[direction]} scale(${slamScale})`,
        opacity: fadeOut,
        WebkitTextStroke: color === GOLD ? `2px ${GOLD}` : "none",
      }}>
        {text}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   WORD-BY-WORD SUBTITLE — each word pops in sequence
   ═══════════════════════════════════════════════════════ */
const WordByWord: React.FC<{
  words: string[]; startFrame: number; wordDelay?: number; position?: "top" | "bottom";
}> = ({ words, startFrame, wordDelay = 4, position = "bottom" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const totalDuration = words.length * wordDelay + FPS * 2;
  if (local > totalDuration) return null;

  const fadeOut = interpolate(local, [totalDuration - 10, totalDuration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute",
      ...(position === "bottom" ? { bottom: 350 } : { top: 100 }),
      left: 30, right: 30, zIndex: 30, textAlign: "center", opacity: fadeOut,
    }}>
      <div style={{
        display: "inline-block",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)",
        borderRadius: 14, padding: "18px 30px",
        border: `1px solid ${GOLD}25`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        {words.map((word, i) => {
          const wordStart = i * wordDelay;
          const wordLocal = local - wordStart;
          if (wordLocal < 0) return null;

          const pop = spring({ frame: wordLocal, fps, config: { damping: 8, stiffness: 150, mass: 0.4 } });

          return (
            <span key={i} style={{
              display: "inline-block", marginRight: 10,
              fontSize: 32, fontWeight: 800, color: "#fff",
              fontFamily: "'Inter',sans-serif",
              transform: `scale(${pop}) translateY(${(1 - pop) * 20}px)`,
              opacity: pop,
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}>
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   ZOOM PUNCH — quick zoom in/out impact
   ═══════════════════════════════════════════════════════ */
const useZoomPunch = (triggerFrames: number[]) => {
  const frame = useCurrentFrame();
  let zoom = 1;
  for (const t of triggerFrames) {
    const d = frame - t;
    if (d >= 0 && d < 12) {
      const punch = interpolate(d, [0, 3, 12], [1, 1.12, 1], { extrapolateRight: "clamp" });
      zoom *= punch;
    }
  }
  return zoom;
};

/* ═══════════════════════════════════════════════════════
   ANIMATED FRAME BORDER — golden scanning border
   ═══════════════════════════════════════════════════════ */
const AnimatedBorder: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = (frame / durationInFrames);
  const dashOffset = frame * 3;
  const opacity = interpolate(Math.sin(frame * 0.05), [-1, 1], [0.3, 0.7]);

  return (
    <div style={{ position: "absolute", inset: 12, zIndex: 15, pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)"
          rx="16" fill="none" stroke={GOLD} strokeWidth="2"
          strokeDasharray="20 30" strokeDashoffset={dashOffset}
          opacity={opacity} />
      </svg>
      {/* Corner brackets */}
      {[
        { top: 0, left: 0 }, { top: 0, right: 0 },
        { bottom: 0, left: 0 }, { bottom: 0, right: 0 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos, width: 40, height: 40, zIndex: 16,
          borderColor: GOLD, borderStyle: "solid", borderWidth: 0,
          ...(pos.top !== undefined && pos.left !== undefined ? { borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 } : {}),
          ...(pos.top !== undefined && pos.right !== undefined ? { borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 } : {}),
          ...(pos.bottom !== undefined && pos.left !== undefined ? { borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 } : {}),
          ...(pos.bottom !== undefined && pos.right !== undefined ? { borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 } : {}),
          opacity: 0.8,
        }} />
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   BIG STAT COUNTER — animated number with explosion
   ═══════════════════════════════════════════════════════ */
const StatExplosion: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const prog = spring({ frame: local, fps, config: { damping: 18, stiffness: 60 } });
  const count = Math.round(2100 * prog);
  const glow = interpolate(Math.sin(local * 0.08), [-1, 1], [40, 100]);
  const ringScale = interpolate(local, [0, 20], [0.5, 1.5], { extrapolateRight: "clamp" });
  const ringOpacity = interpolate(local, [0, 20], [0.8, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center", zIndex: 35 }}>
      {/* Expanding ring */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 300, height: 300,
        transform: `translate(-50%,-50%) scale(${ringScale})`,
        border: `3px solid ${GOLD}`,
        borderRadius: "50%",
        opacity: ringOpacity,
      }} />
      <div style={{
        fontSize: 140, fontWeight: 900, fontFamily: "'Inter',sans-serif",
        color: GOLD,
        textShadow: `0 0 ${glow}px ${GOLD}, 0 0 ${glow * 1.5}px rgba(201,168,76,0.4), 0 8px 40px rgba(0,0,0,0.8)`,
        transform: `scale(${prog})`,
      }}>
        {count.toLocaleString("it-IT")}+
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: "#fff",
        letterSpacing: 6, marginTop: 10, opacity: prog,
        textShadow: "0 2px 20px rgba(0,0,0,0.8)",
      }}>
        CALCIATORI TRASFORMATI
      </div>
      {/* Animated underline */}
      <div style={{
        width: 200, height: 3, margin: "14px auto 0",
        background: `linear-gradient(90deg,transparent,${GOLD},transparent)`,
        transform: `scaleX(${prog})`,
        boxShadow: `0 0 20px ${GOLD}`,
      }} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TRUSTPILOT — holographic badge
   ═══════════════════════════════════════════════════════ */
const TrustBadge: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const scale = spring({ frame: local, fps, config: { damping: 8, stiffness: 100 } });
  const shimmer = (local * 5) % 600;

  return (
    <div style={{
      position: "absolute", bottom: 320, left: 40, right: 40, zIndex: 30,
      transform: `scale(${scale})`, opacity: scale,
    }}>
      <div style={{
        background: "linear-gradient(135deg,rgba(0,0,0,0.8),rgba(24,47,32,0.85))",
        border: `2px solid ${GOLD}50`, borderRadius: 18,
        padding: "20px 28px", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 16, position: "relative", overflow: "hidden",
        boxShadow: `0 0 30px rgba(201,168,76,0.2), 0 10px 40px rgba(0,0,0,0.5)`,
      }}>
        <div style={{
          position: "absolute", top: 0, left: shimmer - 200, width: 120, height: "100%",
          background: `linear-gradient(90deg,transparent,${GOLD}20,transparent)`,
          transform: "skewX(-20deg)",
        }} />
        <span style={{ fontSize: 34, color: "#00b67a" }}>★★★★★</span>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'Inter',sans-serif" }}>
            4.9 / 5 Trustpilot
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
            356 famiglie soddisfatte
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   CTA — gold button with dramatic entrance
   ═══════════════════════════════════════════════════════ */
const CTA: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const slam = spring({ frame: local, fps, config: { damping: 8, stiffness: 120, mass: 0.6 } });
  const pulse = interpolate(Math.sin(local * 0.25), [-1, 1], [1, 1.05]);
  const arrowX = interpolate(Math.sin(local * 0.35), [-1, 1], [0, 12]);
  const shimmer = ((local * 6) % 800) - 200;
  const glow = interpolate(Math.sin(local * 0.15), [-1, 1], [0.4, 0.9]);

  return (
    <div style={{
      position: "absolute", bottom: 70, left: 30, right: 30, zIndex: 40,
      transform: `translateY(${(1 - slam) * 200}px) scale(${slam})`, opacity: slam,
    }}>
      <div style={{
        background: `linear-gradient(135deg,${GOLD},#e8c968,${GOLD})`,
        borderRadius: 20, padding: "26px 40px", textAlign: "center",
        transform: `scale(${pulse})`,
        boxShadow: `0 0 40px rgba(201,168,76,${glow}), 0 0 80px rgba(201,168,76,0.2), 0 12px 50px rgba(0,0,0,0.5)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: shimmer, width: 150, height: "100%",
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)",
          transform: "skewX(-20deg)",
        }} />
        <div style={{
          fontSize: 38, fontWeight: 900, color: DARK,
          fontFamily: "'Inter',sans-serif", letterSpacing: "-1px", position: "relative",
        }}>
          CONSULENZA GRATUITA{" "}
          <span style={{ display: "inline-block", transform: `translateX(${arrowX}px)` }}>→</span>
        </div>
      </div>
      <div style={{
        textAlign: "center", marginTop: 14, fontSize: 18,
        color: `${GOLD}`, fontWeight: 800, letterSpacing: 8,
        fontFamily: "'Inter',sans-serif",
        textShadow: `0 0 20px ${GOLD}60`,
      }}>
        METODO SINCRO®
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PIP AVATAR — circular with golden border, fades in/out
   ═══════════════════════════════════════════════════════ */
const PipAvatar: React.FC<{ startFrame: number; duration: number; videoStartFrom: number }> = ({
  startFrame, duration, videoStartFrom,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > duration) return null;

  const scaleIn = spring({ frame: local, fps, config: { damping: 10, stiffness: 100, mass: 0.5 } });
  const fadeOut = interpolate(local, [duration - 15, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(Math.sin(local * 0.12), [-1, 1], [0.3, 0.7]);
  const borderRotate = local * 2;

  return (
    <div style={{
      position: "absolute", bottom: 220, right: 24, zIndex: 28,
      width: 200, height: 200,
      transform: `scale(${scaleIn})`,
      opacity: Math.min(scaleIn, fadeOut),
    }}>
      {/* Rotating border effect */}
      <div style={{
        position: "absolute", inset: -4,
        borderRadius: "50%",
        background: `conic-gradient(from ${borderRotate}deg, ${GOLD}, transparent, ${GOLD}, transparent, ${GOLD})`,
        opacity: glow,
      }} />
      <div style={{
        position: "absolute", inset: 2,
        borderRadius: "50%", overflow: "hidden",
        boxShadow: `0 0 25px rgba(201,168,76,${glow}), 0 8px 30px rgba(0,0,0,0.6)`,
        background: DARK,
      }}>
        <Video
          src={staticFile("pip.mp4")}
          startFrom={videoStartFrom}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PROGRESS BAR — cinematic style
   ═══════════════════════════════════════════════════════ */
const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.06)", zIndex: 100 }}>
      <div style={{
        height: "100%", width: `${progress * 100}%`,
        background: `linear-gradient(90deg,${GOLD}60,${GOLD})`,
        boxShadow: `0 -2px 15px ${GOLD}80, 0 0 5px ${GOLD}`,
      }} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   CINEMATIC OVERLAYS
   ═══════════════════════════════════════════════════════ */
const CinematicOverlay: React.FC = () => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 350, background: "linear-gradient(180deg,rgba(0,0,0,0.7) 0%,transparent 100%)", zIndex: 3 }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 550, background: `linear-gradient(0deg,${DARK}F0 0%,${DARK}88 40%,transparent 100%)`, zIndex: 3 }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 200px rgba(0,0,0,0.45)", zIndex: 2 }} />
  </>
);

/* ═══════════════════════════════════════════════════════
   WATERMARK
   ═══════════════════════════════════════════════════════ */
const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(Math.sin(frame * 0.03), [-1, 1], [0.15, 0.35]);
  return (
    <div style={{
      position: "absolute", top: 28, left: 28, zIndex: 20,
      fontSize: 15, fontWeight: 800, letterSpacing: 4, color: `rgba(201,168,76,${o})`,
      fontFamily: "'Inter',sans-serif",
    }}>
      METODO SINCRO®
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   ██  MAIN COMPOSITION  ██
   ═══════════════════════════════════════════════════════════ */
export const MetodoSincroAd: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Scene cut frames
  const cuts = [0, FPS * 5, FPS * 10, FPS * 16, FPS * 22];

  const { shakeX, shakeY, shakeRot } = useScreenShake(cuts);
  const zoomPunch = useZoomPunch(cuts);
  const baseZoom = interpolate(frame, [0, durationInFrames], [1.02, 1.08]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {/* ── VIDEO LAYER with shake + zoom ── */}
      <div style={{
        position: "absolute", inset: -30, /* extra space for shake */
        transform: `translate(${shakeX}px, ${shakeY}px) rotate(${shakeRot}deg) scale(${baseZoom * zoomPunch})`,
        transformOrigin: "center",
      }}>
        <Video src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <CinematicOverlay />
      <AnimatedBorder />
      <ProgressBar />
      <Watermark />

      {/* ── GLITCH transitions at every scene cut ── */}
      {cuts.map((c, i) => <GlitchTransition key={i} triggerFrame={c} />)}

      {/* ═══ SCENE 1: 0-5s — HOOK ═══ */}
      <Sequence from={0} durationInFrames={FPS * 5}>
        <SlamText text="TALENTO" startFrame={FPS * 0.3} direction="left" color={GOLD} size={100} />
      </Sequence>
      <WordByWord
        words={["Tuo", "figlio", "ha", "talento.", "Lo", "vedi", "ogni", "giorno."]}
        startFrame={FPS * 1}
        wordDelay={3}
      />

      {/* ═══ SCENE 2: 5-10s — PROBLEMA ═══ */}
      <Sequence from={FPS * 5} durationInFrames={FPS * 5}>
        <SlamText text="BLOCCO" startFrame={FPS * 0.5} direction="right" color="#ff3333" size={110} />
      </Sequence>
      <WordByWord
        words={["Ma", "qualcosa", "lo", "blocca."]}
        startFrame={FPS * 6}
        wordDelay={5}
      />

      {/* ═══ PiP Antonio: scenes 2-3 ═══ */}
      <PipAvatar startFrame={FPS * 7} duration={FPS * 6} videoStartFrom={FPS * 7} />

      {/* ═══ SCENE 3: 10-16s — PRESSIONE ═══ */}
      <Sequence from={FPS * 10} durationInFrames={FPS * 6}>
        <SlamText text="PRESSIONE" startFrame={FPS * 0.5} direction="top" size={85} />
      </Sequence>
      <WordByWord
        words={["La", "pressione", "mentale", "frena", "il", "70%", "dei", "giovani."]}
        startFrame={FPS * 11}
        wordDelay={3}
      />

      {/* ═══ SCENE 4: 16-22s — SOLUZIONE + STATS ═══ */}
      <Sequence from={FPS * 16} durationInFrames={FPS * 6}>
        <StatExplosion startFrame={FPS * 0.5} />
      </Sequence>
      <WordByWord
        words={["Il", "Metodo", "Sincro", "lavora", "sulla", "mente."]}
        startFrame={FPS * 17}
        wordDelay={4}
        position="bottom"
      />

      {/* ═══ SCENE 5: 22-32s — TRUST + CTA ═══ */}
      <Sequence from={FPS * 22}>
        <TrustBadge startFrame={FPS * 0.5} />
      </Sequence>

      {/* PiP Antonio returns for CTA */}
      <PipAvatar startFrame={FPS * 24} duration={FPS * 8} videoStartFrom={FPS * 24} />

      {/* CTA last 6 seconds */}
      <Sequence from={durationInFrames - FPS * 6}>
        <CTA startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
