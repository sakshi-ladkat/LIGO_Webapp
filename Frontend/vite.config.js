import { defineConfig } from 'vite';

// ── Vite Configuration ────────────────────────────────────────────────────
// The proxy forwards /api/* requests to the Laravel dev server, avoiding
// CORS preflight issues entirely during local development.
export default defineConfig({
    server: {
        port: 5173,
        proxy: {
            '/api': {
                // Allow overriding the local API proxy target via env var
                // Useful when the dev backend runs on a different IP (VM/container).
                target:       process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
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
