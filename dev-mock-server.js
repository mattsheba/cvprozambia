// Simple static server with a mock /.netlify/functions/generate-ai endpoint
// Usage: node dev-mock-server.js [port]

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const root = process.cwd();
const port = Number(process.argv[2] || process.env.PORT || 8000);

function sendFile(res, filepath) {
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filepath).toLowerCase();
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  // Mock AI function
  if (req.method === 'POST' && parsed.pathname === '/.netlify/functions/generate-ai') {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prompt = payload.prompt || payload.text || '';
        const type = payload.type || 'summary';
        // Return a canned response that resembles the real function
        const text = `Mock ${type} response for prompt: ${String(prompt).slice(0, 120)}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, text }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'invalid json' }));
      }
    });
    return;
  }

  // Serve static files
  let pathname = parsed.pathname;
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filepath = path.join(root, pathname.replace(/\0/g, ''));
  // Prevent path traversal
  if (!filepath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filepath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    if (stats.isDirectory()) {
      sendFile(res, path.join(filepath, 'index.html'));
      return;
    }
    sendFile(res, filepath);
  });
});

server.listen(port, () => {
  console.log(`Dev mock server running at http://localhost:${port}/`);
  console.log('It serves the site and mocks /.netlify/functions/generate-ai for testing.');
});
