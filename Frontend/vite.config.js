import { defineConfig } from 'vite';

// ── Vite Configuration ────────────────────────────────────────────────────
// The proxy forwards /api/* requests to the Laravel dev server, avoiding
// CORS preflight issues entirely during local development.
export default defineConfig({
    server: {
        host: '0.0.0.0',
        port: 5173,
        allowedHosts: [
            'process.blue.desilab.in'
        ],
        proxy: {
            '/api': {
                target: 'http://process.blue.desilab.in:8000',
                changeOrigin: true,
                secure: false,
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq, req, res) => {
                        if (req.headers.authorization) {
                            proxyReq.setHeader('Authorization', req.headers.authorization);
                        }

                        if (req.headers['x-access-token']) {
                            proxyReq.setHeader('X-Access-Token', req.headers['x-access-token']);
                        }
                    });
                },
                bypass: (req, res, options) => {
                    if (req.url.includes('/audit-logs/download/')) {
                        // Redirect to the backend server to avoid Node 20 strict HTTP parser crashing 
                        // on chunked responses from php artisan serve
                        res.writeHead(302, { location: `http://process.blue.desilab.in:8000${req.url}` });
                        res.end();
                        return req.url;
                    }
                }
            },
        },
    },
});
