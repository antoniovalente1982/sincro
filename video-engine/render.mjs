import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(__dirname, "src", "index.ts");
const outputPath = path.join(__dirname, "..", "data", "ads_video", "edited_58_plateau_break.mp4");

async function main() {
  console.log("📦 Bundling...");
  const bundled = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("🎬 Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "MetodoSincroAd",
  });

  console.log(`🎥 Rendering ${composition.durationInFrames} frames at ${composition.fps}fps...`);
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: outputPath,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 10 === 0) {
        process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%`);
      }
    },
  });

  console.log(`\n✅ Video saved: ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
