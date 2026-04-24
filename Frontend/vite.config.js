import { defineConfig } from 'vite';

// ── Vite Configuration ────────────────────────────────────────────────────
// The proxy forwards /api/* requests to the Laravel dev server, avoiding
// CORS preflight issues entirely during local development.
export default defineConfig({
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target:       'http://192.168.xx.xx:8000',
                changeOrigin: true,
                secure:       false,
            },
        },
    },
});
