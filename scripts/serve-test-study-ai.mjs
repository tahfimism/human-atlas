import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3017;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url.pathname}`);

  // Endpoint to save generated thumbnails to disk
  if (req.method === 'POST' && url.pathname === '/api/save-thumbnail') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { organ, dataUrl } = JSON.parse(body);
        if (!organ || !dataUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing organ or dataUrl' }));
        }

        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `${organ.toLowerCase().trim().replace(/\s+/g, '-')}.webp`;

        fs.mkdirSync('public/thumbnails', { recursive: true });
        fs.mkdirSync('test-study-ai/thumbnails', { recursive: true });

        fs.writeFileSync(path.join('public/thumbnails', filename), buffer);
        fs.writeFileSync(path.join('test-study-ai/thumbnails', filename), buffer);

        console.log(`✓ Saved thumbnail: ${filename} (${buffer.length} bytes)`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, organ, filename, size: buffer.length }));
      } catch (err) {
        console.error('Error saving thumbnail:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Serve static thumbnails
  if (url.pathname.startsWith('/thumbnails/')) {
    const filename = path.basename(url.pathname);
    const localPath = path.join('test-study-ai/thumbnails', filename);
    const pubPath = path.join('public/thumbnails', filename);
    const target = fs.existsSync(localPath) ? localPath : fs.existsSync(pubPath) ? pubPath : null;

    if (target) {
      res.writeHead(200, {
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(target).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Thumbnail not found');
    }
  }

  // Serve automated thumbnail generator UI
  if (url.pathname === '/generator' || url.pathname === '/generator.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (fs.existsSync('test-study-ai/generator.html')) {
      return fs.createReadStream('test-study-ai/generator.html').pipe(res);
    }
  }

  // Default: Serve main chat app
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream('test-study-ai/index.html').pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Study AI Server running at http://localhost:${PORT}`);
  console.log(`Thumbnail generator available at http://localhost:${PORT}/generator`);
});
