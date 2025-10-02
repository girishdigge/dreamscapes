// services/render-worker/ffmpeg/videoProcessor.js
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * assembleFramesToVideo(framesDir, outputPath, opts, shouldCancelFn, progressCb)
 * - framesDir: directory containing frame00001.png, frame00002.png ...
 * - outputPath: absolute path to write .webm or .mp4
 * - opts: { fps, format, resolution }
 * - shouldCancelFn: function returning true if job canceled
 * - progressCb: callback(progress 0..1)
 */
function assembleFramesToVideo(
  framesDir,
  outputPath,
  opts = {},
  shouldCancelFn = () => false,
  progressCb = () => {}
) {
  const fps = opts.fps || 30;
  const format = (opts.format || 'webm').toLowerCase();
  const resolution = opts.resolution || [1280, 720];

  return new Promise((resolve, reject) => {
    if (shouldCancelFn && shouldCancelFn())
      return reject(new Error('canceled'));

    // Determine input pattern. Frames named frame00001.png ...
    const inputPattern = path.join(framesDir, 'frame%05d.png');

    // Ensure there is at least one frame
    const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png'));
    if (!files.length) return reject(new Error('no frames found'));

    // Build ffmpeg args
    let args;
    if (format === 'mp4') {
      args = [
        '-y',
        '-framerate',
        `${fps}`,
        '-i',
        inputPattern,
        '-s',
        `${resolution[0]}x${resolution[1]}`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '23',
        outputPath,
      ];
    } else {
      // default webm using vp9 (or vp8 if vp9 not available)
      args = [
        '-y',
        '-framerate',
        `${fps}`,
        '-i',
        inputPattern,
        '-s',
        `${resolution[0]}x${resolution[1]}`,
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '0',
        '-crf',
        '30',
        outputPath,
      ];
    }

    const ff = child_process.spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Parse stderr to provide rough progress (frame=) if available
    ff.stderr.setEncoding('utf8');
    ff.stderr.on('data', (chunk) => {
      // parse "frame=  123 fps=..."
      const m = chunk.match(/frame=\s*([0-9]+)/);
      if (m) {
        const frame = parseInt(m[1], 10);
        const total = files.length;
        const prog = Math.min(1, frame / Math.max(1, total));
        try {
          progressCb(prog);
        } catch (e) {}
      }
    });

    ff.on('error', (err) => reject(err));
    ff.on('close', (code) => {
      if (code === 0) {
        try {
          progressCb(1.0);
        } catch (e) {}
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    // cancellation support: poll
    const interval = setInterval(() => {
      if (shouldCancelFn && shouldCancelFn()) {
        ff.kill('SIGKILL');
        clearInterval(interval);
        reject(new Error('canceled'));
      }
    }, 250);
  });
}

module.exports = { assembleFramesToVideo };
