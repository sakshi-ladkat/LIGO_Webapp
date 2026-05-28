import { defineConfig } from 'vite';

// ── Vite Configuration ────────────────────────────────────────────────────
// The proxy forwards /api/* requests to the Laravel dev server, avoiding
// CORS preflight issues entirely during local development.
export default defineConfig({
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target:       'http://192.168.11.127:8000',
                changeOrigin: true,
                secure:       false,
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        if (req.headers.authorization) {
                            proxyReq.setHeader('Authorization', req.headers.authorization);
                        }

                        if (req.headers['x-access-token']) {
                            proxyReq.setHeader('X-Access-Token', req.headers['x-access-token']);
                        }
                    });
                },
            },
        },
    },
});
