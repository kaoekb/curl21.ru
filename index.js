const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { URL } = require('node:url');
const colors = require('colors/safe');

const FRAMES_PATH = path.join(__dirname, 'frames');
const FRAME_INTERVAL_MS = 70;
const PORT = Number(process.env.PARROT_PORT) || 3000;
const REDIRECT_URL = 'https://github.com/kaoekb/curl21.ru';

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

    return leftIndex - rightIndex;
  });

const flipFrame = (frame) =>
  frame
    .split('\n')
    .map((line) => [...line].reverse().join(''))
    .join('\n');

const loadFrames = async () => {
  const files = sortFrameFiles(await fs.readdir(FRAMES_PATH));
  const original = await Promise.all(
    files.map((file) => fs.readFile(path.join(FRAMES_PATH, file), 'utf8'))
  );

  return {
    original,
    flipped: original.map(flipFrame)
  };
};

const streamFrames = (res, opts) => {
  let index = 0;
  let lastColor;
  const frames = opts.flip ? opts.frameSet.flipped : opts.frameSet.original;

  const renderFrame = () => {
    const nextColor = selectColor(lastColor);
    lastColor = nextColor;

    // Clear the screen and render the next frame in a new color.
    res.write('\033[2J\033[3J\033[H');
    res.write(colors[colorsOptions[nextColor]](frames[index]));

    index = (index + 1) % frames.length;
  };

  renderFrame();

  return setInterval(renderFrame, FRAME_INTERVAL_MS);
};

const validateQuery = (searchParams) => ({
  flip: String(searchParams.get('flip')).toLowerCase() === 'true'
});

const createRequestHandler = (frameSet) => (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/healthcheck') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent.includes('curl')) {
    res.writeHead(302, { Location: REDIRECT_URL });
    return res.end();
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
    frameSet,
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
  const frameSet = await loadFrames();
  const server = http.createServer(createRequestHandler(frameSet));

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
  flipFrame,
  loadFrames,
  selectColor,
  sortFrameFiles,
  startServer,
  validateQuery
};
