// services/render-worker/puppeteer/renderEngine.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/usr/bin/chromium';

/**
 * renderToFrames(dream, framesDir, options, shouldCancelFn, progressCb)
 * - dream: JSON
 * - framesDir: directory to write frame0001.png ...
 * - options: { resolution: [w,h], fps, duration, templatePath }
 * - shouldCancelFn: function returning true if job canceled
 * - progressCb: callback (float 0..1)
 *
 * Returns number of frames produced.
 */
async function renderToFrames(
  dream,
  framesDir,
  options = {},
  shouldCancelFn = () => false,
  progressCb = () => {}
) {
  const resolution = options.resolution || [1280, 720];
  const fps = options.fps || 30;
  const duration = options.duration || 30;

  // Select template based on renderMode in dream JSON
  // Default to 2D template for backward compatibility
  let defaultTemplate = 'render_template.html';
  if (dream && dream.renderMode === '3d') {
    defaultTemplate = 'render_template_3d.html';
  }

  const templatePath =
    options.templatePath || path.join(__dirname, 'templates', defaultTemplate);

  mkdirp.sync(framesDir);

  // Number of frames
  const frameCount = Math.max(1, Math.round(fps * duration));

  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: { width: resolution[0], height: resolution[1] },
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: resolution[0], height: resolution[1] });

    // Load template from file://
    const url = 'file://' + path.resolve(templatePath);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });

    // Initialize dream in page
    await page.evaluate(
      (d, w, h) => {
        // expose a function on window to accept the dream and set canvas size
        if (
          window.initWithDream &&
          typeof window.initWithDream === 'function'
        ) {
          window.initWithDream(d, w, h);
        } else {
          // fallback: store globally
          window.__DREAM__ = d;
          if (window.resizeCanvas) window.resizeCanvas(w, h);
        }
      },
      dream,
      resolution[0],
      resolution[1]
    );

    // Select canvas element to screenshot (page provides #renderCanvas)
    const canvasHandle = await page.$('#renderCanvas');
    if (!canvasHandle) {
      throw new Error('render template does not expose #renderCanvas element');
    }

    // Wait a short time to ensure initial render
    await page.waitForTimeout(250);

    for (let i = 0; i < frameCount; i++) {
      if (shouldCancelFn()) {
        console.log('Render canceled during frames loop');
        break;
      }

      const t = i / fps; // seconds
      // instruct page to seek to time t (page must implement window.seek)
      try {
        await page.evaluate((time) => {
          if (window.seek && typeof window.seek === 'function') {
            window.seek(time);
          } else if (window._simpleSeek) {
            window._simpleSeek(time);
          }
        }, t);
      } catch (e) {
        // Non-fatal: continue
        console.warn('seek() evaluation failed', e.message);
      }

      // Allow time for drawing
      await page.waitForTimeout(10);

      const frameName = path.join(
        framesDir,
        `frame${String(i + 1).padStart(5, '0')}.png`
      );
      await canvasHandle.screenshot({ path: frameName });

      if (i % Math.max(1, Math.round(frameCount / 10)) === 0) {
        progressCb(i / frameCount);
      }
    }

    progressCb(1.0);
    await page.close();
    return frameCount;
  } finally {
    await browser.close();
  }
}

module.exports = { renderToFrames };
