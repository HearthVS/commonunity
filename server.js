const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Proxy /api/* calls to the FastAPI backend on 7477
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:7477',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api/, ''),
  on: {
    error: (err, req, res) => {
      console.error('Proxy error:', err.message);
      res.status(502).json({ error: 'Backend unavailable', detail: err.message });
    }
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname)));

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => console.log(`Compass on port ${port}`));
