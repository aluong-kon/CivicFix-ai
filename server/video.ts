import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function extractVideoFrame(
  videoPath: string,
  outputDir: string
): Promise<string | null> {
  if (!fs.existsSync(videoPath)) return null;

  const frameFileName = `frame_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
  const framePath = path.join(outputDir, frameFileName);

  return new Promise((resolve) => {
    // Attempt extraction at 1 second or first frame
    const cmd = `ffmpeg -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" -y`;

    exec(cmd, (error) => {
      if (!error && fs.existsSync(framePath)) {
        resolve(frameFileName);
        return;
      }

      // Fallback: extract earliest frame without seeking
      const fallbackCmd = `ffmpeg -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" -y`;
      exec(fallbackCmd, (fallbackErr) => {
        if (!fallbackErr && fs.existsSync(framePath)) {
          resolve(frameFileName);
        } else {
          console.warn('ffmpeg frame extraction failed:', fallbackErr);
          resolve(null);
        }
      });
    });
  });
}
