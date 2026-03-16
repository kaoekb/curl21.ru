const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { URL } = require('node:url');
const colors = require('colors/safe');

const DEFAULT_ANIMATION_NAME = 'default';
const FRAMES_PATH = path.join(__dirname, 'frames');
const ANIMATIONS_PATH = path.join(__dirname, 'animations');
const FRAME_INTERVAL_MS = 70;
const ANIMATION_SETTINGS = {
  lock: {
    frameIntervalMs: 100,
    colorName: 'green'
  }
};
const PORT = Number(process.env.PARROT_PORT) || 3000;
const REDIRECT_URL = 'https://github.com/kaoekb/curl21.ru';
const ANIMATION_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const colorsOptions = [
  'red',
  'yellow',
  'green',
  'blue',
  'magenta',
  'cyan',
  'white'
];
const numColors = colorsOptions.length;
const selectColor = (previousColor) => {
  if (numColors === 1) {
    return 0;
  }

  let color;

  do {
    color = Math.floor(Math.random() * numColors);
  } while (color === previousColor);

  return color;
};

const sortFrameFiles = (files) =>
  [...files].sort((left, right) => {
    const leftIndex = Number.parseInt(left, 10);
    const rightIndex = Number.parseInt(right, 10);
    const leftIsNumeric = Number.isFinite(leftIndex);
    const rightIsNumeric = Number.isFinite(rightIndex);

    if (leftIsNumeric && rightIsNumeric && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    if (leftIsNumeric && !rightIsNumeric) {
      return -1;
    }

    if (!leftIsNumeric && rightIsNumeric) {
      return 1;
    }

    return left.localeCompare(right);
  });

const flipFrame = (frame) =>
  frame
    .split('\n')
    .map((line) => [...line].reverse().join(''))
    .join('\n');

const loadFrameSet = async (framesPath) => {
  const files = sortFrameFiles(
    (await fs.readdir(framesPath)).filter((file) => file.endsWith('.txt'))
  );

  if (files.length === 0) {
    throw new Error(`No frame files found in ${framesPath}`);
  }

  const original = await Promise.all(
    files.map((file) => fs.readFile(path.join(framesPath, file), 'utf8'))
  );

  return {
    original,
    flipped: original.map(flipFrame)
  };
};

const loadAnimations = async () => {
  const animations = new Map();

  animations.set(DEFAULT_ANIMATION_NAME, await loadFrameSet(FRAMES_PATH));

  let animationEntries = [];
  try {
    animationEntries = await fs.readdir(ANIMATIONS_PATH, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  for (const entry of animationEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (!ANIMATION_NAME_PATTERN.test(entry.name)) {
      console.warn(`Skipping animation with invalid name: ${entry.name}`);
      continue;
    }

    const framesPath = path.join(ANIMATIONS_PATH, entry.name);
    try {
      animations.set(entry.name, await loadFrameSet(framesPath));
    } catch (error) {
      console.warn(`Skipping animation "${entry.name}"`);
      console.warn(error.message);
    }
  }

  return animations;
};

const buildFramePayload = ({ clearScreen = false, colorName, frame }) =>
  `${clearScreen ? '\u001b[2J\u001b[3J' : ''}\u001b[H${colors[colorName](frame)}`;

const streamFrames = (res, opts) => {
  let index = 0;
  let lastColor;
  let shouldClearScreen = true;
  const frames = opts.flip ? opts.frameSet.flipped : opts.frameSet.original;
  const frameIntervalMs = opts.frameIntervalMs || FRAME_INTERVAL_MS;
  const colorName = opts.colorName;

  const renderFrame = () => {
    const nextColor = colorName || colorsOptions[selectColor(lastColor)];
    if (!colorName) {
      lastColor = colorsOptions.indexOf(nextColor);
    }

    // Only clear once on connect; afterwards just jump home to avoid a visible blank frame.
    res.write(
      buildFramePayload({
        clearScreen: shouldClearScreen,
        colorName: nextColor,
        frame: frames[index]
      })
    );
    shouldClearScreen = false;

    index = (index + 1) % frames.length;
  };

  renderFrame();

  return setInterval(renderFrame, frameIntervalMs);
};

const validateQuery = (searchParams) => ({
  flip: String(searchParams.get('flip')).toLowerCase() === 'true'
});

const respondWithJson = (req, res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });

  if (req.method === 'HEAD') {
    return res.end();
  }

  return res.end(JSON.stringify(payload));
};

const resolveAnimationName = (pathname) => {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return DEFAULT_ANIMATION_NAME;
  }

  if (segments.length !== 1) {
    return null;
  }

  const animationName = segments[0].toLowerCase();
  if (!ANIMATION_NAME_PATTERN.test(animationName)) {
    return null;
  }

  return animationName;
};

const listAvailableAnimations = (animations) =>
  [...animations.keys()].filter((name) => name !== DEFAULT_ANIMATION_NAME).sort();

const resolveFrameIntervalMs = (animationName) =>
  ANIMATION_SETTINGS[animationName]?.frameIntervalMs || FRAME_INTERVAL_MS;

const resolveColorName = (animationName) =>
  ANIMATION_SETTINGS[animationName]?.colorName || null;

const createRequestHandler = (animations) => (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/healthcheck') {
    return respondWithJson(req, res, 200, { status: 'ok' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return respondWithJson(req, res, 405, { error: 'method_not_allowed' });
  }

  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent.includes('curl')) {
    res.writeHead(302, { Location: REDIRECT_URL });
    return res.end();
  }

  const animationName = resolveAnimationName(requestUrl.pathname);
  if (!animationName || !animations.has(animationName)) {
    return respondWithJson(req, res, 404, {
      error: 'animation_not_found',
      available: listAvailableAnimations(animations)
    });
  }

  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });

  if (req.method === 'HEAD') {
    return res.end();
  }

  const interval = streamFrames(res, {
    frameSet: animations.get(animationName),
    colorName: resolveColorName(animationName),
    frameIntervalMs: resolveFrameIntervalMs(animationName),
    ...validateQuery(requestUrl.searchParams)
  });

  const cleanup = () => {
    clearInterval(interval);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
};

const startServer = async () => {
  const animations = await loadAnimations();
  const server = http.createServer(createRequestHandler(animations));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close((error) => {
      if (error) {
        console.error('Error while shutting down the server');
        console.error(error);
        process.exit(1);
      }

      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      console.log(`Listening on port ${PORT}`);
      resolve();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(PORT);
  });

  return server;
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createRequestHandler,
  buildFramePayload,
  flipFrame,
  listAvailableAnimations,
  loadAnimations,
  loadFrameSet,
  resolveColorName,
  resolveFrameIntervalMs,
  resolveAnimationName,
  selectColor,
  sortFrameFiles,
  startServer,
  validateQuery
};
