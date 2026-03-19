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

/* ───── KEYWORD FLASH — big word pops at key moments ───── */
const KeywordFlash: React.FC<{ word: string; startFrame: number }> = ({
  word,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > fps * 2.5) return null;

  const scale = spring({ frame: local, fps, config: { damping: 8, stiffness: 120, mass: 0.6 } });
  const fadeOut = interpolate(local, [fps * 1.5, fps * 2.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20,
    }}>
      <div style={{
        fontSize: 90, fontWeight: 900, fontFamily: "'Inter',sans-serif",
        color: "#fff", textTransform: "uppercase", letterSpacing: "-3px",
        textShadow: `0 0 60px rgba(201,168,76,0.6), 0 4px 30px rgba(0,0,0,0.8)`,
        transform: `scale(${scale})`, opacity: fadeOut,
        WebkitTextStroke: `1px ${GOLD}40`,
      }}>
        {word}
      </div>
    </div>
  );
};

/* ───── ANIMATED SUBTITLE — smaller text at bottom ───── */
const Subtitle: React.FC<{ text: string; startFrame: number; duration: number }> = ({
  text, startFrame, duration,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > duration) return null;

  const fadeIn = interpolate(local, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(local, [duration - 8, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slideUp = interpolate(local, [0, 8], [20, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute", bottom: 300, left: 40, right: 40, zIndex: 20,
      textAlign: "center",
      transform: `translateY(${slideUp}px)`,
      opacity: Math.min(fadeIn, fadeOut),
    }}>
      <div style={{
        display: "inline-block",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
        borderRadius: 12, padding: "14px 28px",
        border: `1px solid ${GOLD}30`,
      }}>
        <span style={{
          fontSize: 28, fontWeight: 700, color: "#fff",
          fontFamily: "'Inter',sans-serif", lineHeight: 1.4,
        }}>
          {text}
        </span>
      </div>
    </div>
  );
};

/* ───── STAT COUNTER ───── */
const StatCounter: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const prog = spring({ frame: local, fps, config: { damping: 30, stiffness: 50 } });
  const count = Math.round(2100 * prog);
  const glow = interpolate(Math.sin(local * 0.1), [-1, 1], [25, 55]);

  return (
    <div style={{
      position: "absolute", top: 120, left: 0, right: 0, textAlign: "center", zIndex: 22,
    }}>
      <div style={{
        fontSize: 120, fontWeight: 900, fontFamily: "'Inter',sans-serif",
        color: GOLD,
        textShadow: `0 0 ${glow}px ${GOLD}, 0 0 ${glow * 2}px rgba(201,168,76,0.3)`,
        transform: `scale(${prog})`,
      }}>
        {count.toLocaleString("it-IT")}+
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.8)",
        letterSpacing: 4, marginTop: 8, opacity: prog,
      }}>
        CALCIATORI TRASFORMATI
      </div>
    </div>
  );
};

/* ───── TRUSTPILOT BADGE ───── */
const TrustBadge: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const scale = spring({ frame: local, fps, config: { damping: 10, stiffness: 90 } });
  const shimmer = (local * 4) % 500;

  return (
    <div style={{
      position: "absolute", bottom: 330, left: 50, right: 50, zIndex: 22,
      transform: `scale(${scale})`, opacity: scale,
    }}>
      <div style={{
        background: "linear-gradient(135deg,rgba(0,0,0,0.75),rgba(24,47,32,0.85))",
        border: `1px solid ${GOLD}40`, borderRadius: 16,
        padding: "16px 24px", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 14, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: shimmer - 200, width: 100, height: "100%",
          background: `linear-gradient(90deg,transparent,${GOLD}18,transparent)`,
          transform: "skewX(-20deg)",
        }} />
        <span style={{ fontSize: 28, color: "#00b67a" }}>★★★★★</span>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "'Inter',sans-serif" }}>
            4.9 / 5 Trustpilot
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
            356 famiglie soddisfatte
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───── CTA BUTTON ───── */
const CTA: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const slideUp = spring({ frame: local, fps, config: { damping: 12, stiffness: 80 } });
  const pulse = interpolate(Math.sin(local * 0.2), [-1, 1], [1, 1.03]);
  const arrowX = interpolate(Math.sin(local * 0.3), [-1, 1], [0, 8]);
  const shimmer = ((local * 5) % 700) - 200;

  return (
    <div style={{
      position: "absolute", bottom: 80, left: 40, right: 40, zIndex: 30,
      transform: `translateY(${(1 - slideUp) * 100}px)`, opacity: slideUp,
    }}>
      <div style={{
        background: `linear-gradient(135deg,${GOLD},#e8c968,${GOLD})`,
        borderRadius: 18, padding: "22px 36px", textAlign: "center",
        transform: `scale(${pulse})`,
        boxShadow: `0 0 30px rgba(201,168,76,0.5),0 10px 40px rgba(0,0,0,0.4)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: shimmer, width: 120, height: "100%",
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)",
          transform: "skewX(-20deg)",
        }} />
        <div style={{
          fontSize: 34, fontWeight: 900, color: DARK,
          fontFamily: "'Inter',sans-serif", letterSpacing: "-1px", position: "relative",
        }}>
          CONSULENZA GRATUITA{" "}
          <span style={{ display: "inline-block", transform: `translateX(${arrowX}px)` }}>→</span>
        </div>
      </div>
      <div style={{
        textAlign: "center", marginTop: 12, fontSize: 16,
        color: `${GOLD}99`, fontWeight: 700, letterSpacing: 6,
        fontFamily: "'Inter',sans-serif",
      }}>
        METODO SINCRO®
      </div>
    </div>
  );
};

/* ───── PIP AVATAR (appears/disappears) ───── */
const PipAvatar: React.FC<{ startFrame: number; duration: number }> = ({
  startFrame, duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > duration) return null;

  const fadeIn = interpolate(local, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(local, [duration - 12, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scaleIn = spring({ frame: local, fps, config: { damping: 12, stiffness: 100 } });
  const glow = interpolate(Math.sin(local * 0.1), [-1, 1], [0.3, 0.6]);

  return (
    <div style={{
      position: "absolute", bottom: 200, right: 30, zIndex: 25,
      width: 220, height: 220,
      borderRadius: "50%", overflow: "hidden",
      border: `3px solid ${GOLD}`,
      boxShadow: `0 0 20px rgba(201,168,76,${glow}),0 8px 30px rgba(0,0,0,0.5)`,
      transform: `scale(${scaleIn})`,
      opacity: Math.min(fadeIn, fadeOut),
    }}>
      <Video
        src={staticFile("pip.mp4")}
        startFrom={startFrame}
        style={{
          width: "100%", height: "100%", objectFit: "cover",
        }}
      />
    </div>
  );
};

/* ───── PROGRESS BAR ───── */
const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.06)", zIndex: 100 }}>
      <div style={{
        height: "100%", width: `${progress * 100}%`,
        background: `linear-gradient(90deg,${GOLD}60,${GOLD})`,
        boxShadow: `0 0 12px ${GOLD}80`,
      }} />
    </div>
  );
};

/* ───── CINEMATIC OVERLAYS ───── */
const CinematicOverlay: React.FC = () => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300, background: "linear-gradient(180deg,rgba(0,0,0,0.65) 0%,transparent 100%)", zIndex: 3 }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 500, background: `linear-gradient(0deg,${DARK}EE 0%,${DARK}80 40%,transparent 100%)`, zIndex: 3 }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 180px rgba(0,0,0,0.4)", zIndex: 2 }} />
  </>
);

/* ───── BRAND WATERMARK ───── */
const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(Math.sin(frame * 0.03), [-1, 1], [0.2, 0.35]);
  return (
    <div style={{
      position: "absolute", top: 30, left: 30, zIndex: 20,
      fontSize: 16, fontWeight: 800, letterSpacing: 3, color: `rgba(201,168,76,${opacity})`,
      fontFamily: "'Inter',sans-serif",
    }}>
      METODO SINCRO®
    </div>
  );
};

/* ═══════ MAIN COMPOSITION ═══════ */
export const MetodoSincroAd: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.01, 1.06]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {/* Background cinematic video with slow zoom */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <Video src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <CinematicOverlay />
      <ProgressBar />
      <Watermark />

      {/* ── Scene 1: 0-5s — HOOK ── */}
      <Sequence from={0} durationInFrames={FPS * 5}>
        <KeywordFlash word="TALENTO" startFrame={FPS * 0.5} />
      </Sequence>
      <Subtitle text="Tuo figlio ha talento. Lo vedi ogni giorno." startFrame={FPS * 0.3} duration={FPS * 4.5} />

      {/* ── Scene 2: 5-10s — PROBLEMA ── */}
      <Sequence from={FPS * 5} durationInFrames={FPS * 5}>
        <KeywordFlash word="BLOCCO" startFrame={FPS * 1} />
      </Sequence>
      <Subtitle text="Ma qualcosa lo blocca." startFrame={FPS * 5.3} duration={FPS * 4.5} />

      {/* PiP Antonio appears during scene 2-3 */}
      <Sequence from={FPS * 6} durationInFrames={FPS * 7}>
        <PipAvatar startFrame={0} duration={FPS * 7} />
      </Sequence>

      {/* ── Scene 3: 10-16s — AGITAZIONE ── */}
      <Sequence from={FPS * 10} durationInFrames={FPS * 6}>
        <KeywordFlash word="PRESSIONE" startFrame={FPS * 1} />
      </Sequence>
      <Subtitle text="La pressione mentale frena il 70% dei giovani." startFrame={FPS * 10.3} duration={FPS * 5.5} />

      {/* ── Scene 4: 16-22s — SOLUZIONE + STATS ── */}
      <Sequence from={FPS * 16} durationInFrames={FPS * 7}>
        <StatCounter startFrame={FPS * 0.5} />
      </Sequence>
      <Subtitle text="Il Metodo Sincro lavora sulla mente, non solo sul campo." startFrame={FPS * 16.3} duration={FPS * 5} />

      {/* ── Scene 5: 22-27s — TRUST + CTA ── */}
      <Sequence from={FPS * 22} durationInFrames={FPS * 10}>
        <TrustBadge startFrame={FPS * 0.5} />
      </Sequence>

      {/* PiP Antonio comes back for final CTA */}
      <Sequence from={FPS * 24} durationInFrames={FPS * 8}>
        <PipAvatar startFrame={0} duration={FPS * 8} />
      </Sequence>

      {/* CTA in the last 6 seconds */}
      <Sequence from={durationInFrames - FPS * 6}>
        <CTA startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
