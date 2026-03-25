import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  base: '/dashboard/',
  plugins: [
    solidPlugin(),
    {
      name: 'dashboard-trailing-slash-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/dashboard') {
            res.statusCode = 302;
            res.setHeader('Location', '/dashboard/');
            res.end();
            return;
          }

          next();
        });
      },
    },
  ],
  server: {
    port: 3002,
    proxy: {
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
});
