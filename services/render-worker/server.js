// services/render-worker/server.js
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const renderEngine = require('./puppeteer/renderEngine');
const videoProcessor = require('./puppeteer/ffmpeg/videoProcessor');
const { logger, requestLogger, logError } = require('./utils/logger');

const PORT = process.env.PORT || 8001;
const STORAGE_ROOT = path.resolve(__dirname, 'storage');
const TEMP_DIR = path.join(STORAGE_ROOT, 'temp');
const EXPORTS_DIR = path.join(STORAGE_ROOT, 'exports');

mkdirp.sync(TEMP_DIR);
mkdirp.sync(EXPORTS_DIR);

const app = express();
app.use(requestLogger());
app.use(bodyParser.json({ limit: '50mb' }));

// In-memory job store
const jobs = {};
const queue = [];
let runningJobs = 0;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '1', 10);

// Serve exports statically
app.use('/downloads', express.static(EXPORTS_DIR, { index: false }));

// Health
app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.json({
    service: 'render-worker',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    concurrency: {
      running: runningJobs,
      queued: queue.length,
      max: MAX_CONCURRENT,
    },
  });
});

// Submit render job
app.post('/render', async (req, res) => {
  try {
    const { dream, config = {} } = req.body;

    logger.info('Render job submitted', {
      hasConfig: Object.keys(config).length > 0,
      quality: config.quality || 'draft',
      format: config.format || 'webm',
    });

    if (!dream || typeof dream !== 'object') {
      logger.warn('Invalid render request: missing dream JSON');
      return res
        .status(400)
        .json({ error: 'dream (JSON) is required in body' });
    }

    // Basic config defaults
    const quality = config.quality || 'draft';
    const format = config.format || 'webm';
    const fps = parseInt(config.fps || (quality === 'high' ? 60 : 30), 10);
    const resolution =
      config.res || (quality === 'high' ? [1920, 1080] : [1280, 720]);
    const duration = dream.cinematography?.durationSec || config.duration || 30;

    const jobId = uuidv4();
    const jobTemp = path.join(TEMP_DIR, jobId);
    const jobFrames = path.join(jobTemp, 'frames');
    mkdirp.sync(jobFrames);

    const job = {
      id: jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dreamFile: path.join(jobTemp, 'dream.json'),
      framesDir: jobFrames,
      outputFile: null,
      progress: 0,
      config: { quality, format, fps, resolution, duration },
      canceled: false,
      error: null,
    };

    // Persist dream JSON to file
    fs.writeFileSync(job.dreamFile, JSON.stringify(dream, null, 2));

    jobs[jobId] = job;
    queue.push(jobId);

    logger.logJobEvent(jobId, 'queued', {
      quality,
      format,
      fps,
      resolution,
      duration,
      queuePosition: queue.length,
    });

    processQueue();

    res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/job/${jobId}/status`,
      downloadUrl: null,
      message: 'Job queued',
    });
  } catch (err) {
    logError(err, { operation: 'submit_render' });
    res.status(500).json({ error: err.message });
  }
});

// Get job status
app.get('/job/:id/status', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    logger.warn('Job status requested for non-existent job', {
      jobId: req.params.id,
    });
    return res.status(404).json({ error: 'Job not found' });
  }

  logger.debug('Job status requested', {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
  });

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    config: job.config,
    outputFile: job.outputFile
      ? `/downloads/${path.basename(job.outputFile)}`
      : null,
    error: job.error,
  });
});

// Cancel / delete job
app.delete('/job/:id', async (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    logger.warn('Job cancellation requested for non-existent job', {
      jobId: req.params.id,
    });
    return res.status(404).json({ error: 'Job not found' });
  }

  logger.info('Job cancellation requested', {
    jobId: job.id,
    currentStatus: job.status,
    progress: job.progress,
  });

  // Mark canceled
  job.canceled = true;

  // If queued, remove from queue
  const qIndex = queue.indexOf(job.id);
  if (qIndex >= 0) queue.splice(qIndex, 1);

  job.status = 'canceled';
  job.updatedAt = new Date().toISOString();

  // Try to clean temp frames
  try {
    if (job.framesDir && fs.existsSync(job.framesDir)) {
      rimraf.sync(path.dirname(job.framesDir));
    }
  } catch (e) {
    logger.warn('Failed to cleanup canceled job files', {
      jobId: job.id,
      error: e.message,
    });
  }

  logger.logJobEvent(job.id, 'canceled');

  res.json({ success: true, id: job.id, status: job.status });
});

// Download endpoint is served statically under /downloads/*

// Internal helpers
async function processQueue() {
  if (runningJobs >= MAX_CONCURRENT) return;
  if (queue.length === 0) return;

  const jobId = queue.shift();
  const job = jobs[jobId];
  if (!job) return processQueue();

  // If canceled while queued
  if (job.canceled) {
    job.status = 'canceled';
    job.updatedAt = new Date().toISOString();
    logger.logJobEvent(jobId, 'canceled_while_queued');
    return processQueue();
  }

  runningJobs++;
  job.status = 'running';
  job.updatedAt = new Date().toISOString();

  logger.logJobEvent(jobId, 'started', {
    runningJobs,
    queueLength: queue.length,
  });

  try {
    await processJob(job);
  } catch (e) {
    logError(e, { operation: 'process_job', jobId });
  } finally {
    runningJobs--;
    processQueue();
  }
}

async function processJob(job) {
  const shouldCancel = () => !!job.canceled;

  try {
    job.status = 'rendering_frames';
    job.updatedAt = new Date().toISOString();

    // Read dream from file (safeguard)
    const dream = JSON.parse(fs.readFileSync(job.dreamFile, 'utf8'));

    // Render frames
    const renderOpts = {
      resolution: job.config.resolution,
      fps: job.config.fps,
      duration: job.config.duration,
      templatePath: path.join(
        __dirname,
        'puppeteer',
        'templates',
        'render_template.html'
      ),
    };

    // renderEngine returns number of frames produced
    const frameCount = await renderEngine.renderToFrames(
      dream,
      job.framesDir,
      renderOpts,
      shouldCancel,
      (progress) => {
        job.progress = Math.round(progress * 0.6); // frames are 60% of work
        job.updatedAt = new Date().toISOString();
      }
    );

    if (job.canceled) {
      job.status = 'canceled';
      job.updatedAt = new Date().toISOString();
      // cleanup frames
      rimraf.sync(path.dirname(job.framesDir));
      return;
    }

    // Assemble with ffmpeg
    job.status = 'assembling_video';
    job.updatedAt = new Date().toISOString();

    const outputFileName = `${job.id}.${
      job.config.format === 'mp4' ? 'mp4' : 'webm'
    }`;
    const outputPath = path.join(EXPORTS_DIR, outputFileName);

    // Ensure no previous file
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    await videoProcessor.assembleFramesToVideo(
      job.framesDir,
      outputPath,
      {
        fps: job.config.fps,
        format: job.config.format,
        resolution: job.config.resolution,
      },
      shouldCancel,
      (progress) => {
        // assemble progress portion: 60% -> 100% (scale)
        job.progress = 60 + Math.round(progress * 40);
        job.updatedAt = new Date().toISOString();
      }
    );

    if (job.canceled) {
      job.status = 'canceled';
      job.updatedAt = new Date().toISOString();
      // cleanup
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      rimraf.sync(path.dirname(job.framesDir));
      return;
    }

    // Success
    job.outputFile = outputPath;
    job.status = 'completed';
    job.progress = 100;
    job.updatedAt = new Date().toISOString();

    // Clean up frames to save disk (optionally keep them; here we remove)
    try {
      rimraf.sync(path.dirname(job.framesDir));
    } catch (e) {
      console.warn('Failed to remove frames dir', e);
    }
  } catch (err) {
    console.error('processJob error', err);
    job.status = 'failed';
    job.error = err.message || String(err);
    job.updatedAt = new Date().toISOString();
  }
}

app.listen(PORT, () => {
  console.log(`🎞️ Render worker listening on ${PORT}`);
  console.log(`Storage temp: ${TEMP_DIR}`);
  console.log(`Storage exports: ${EXPORTS_DIR}`);
});
