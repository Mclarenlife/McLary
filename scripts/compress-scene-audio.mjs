// FFMPEG may point to a local executable. WAV masters remain the source/fallback.
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
const ffmpeg = process.env.FFMPEG || "ffmpeg";
let before = 0,
  after = 0;
for (const name of [
  "tidal-notes",
  "distant-orbit",
  "water-entry",
  "water-emerge",
]) {
  const source = `public/audio/${name}.wav`,
    output = `public/audio/${name}.flac`;
  const result = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-map_metadata",
      "-1",
      "-c:a",
      "flac",
      "-compression_level",
      "12",
      output,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw Error(result.stderr || result.error);
  // Sample-for-sample equality also guarantees unchanged duration and loop seam.
  const decode = (path) => {
    const r = spawnSync(
      ffmpeg,
      ["-hide_banner", "-loglevel", "error", "-i", path, "-f", "s16le", "-"],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    if (r.status !== 0) throw Error(String(r.stderr || r.error));
    return r.stdout;
  };
  if (!decode(source).equals(decode(output)))
    throw Error(`Lossless validation failed: ${name}`);
  const a = (await fs.stat(source)).size,
    b = (await fs.stat(output)).size;
  before += a;
  after += b;
  console.log(name, { before: a, after: b, sampleIdentical: true });
}
console.log({
  before,
  after,
  savedPercent: +(100 * (1 - after / before)).toFixed(1),
});
