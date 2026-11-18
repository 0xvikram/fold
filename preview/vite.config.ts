// `npm run preview`: the real Fold client and the real API routes in a plain browser.
// Only the Devvit SDK is swapped for the in-memory stand-ins in this folder.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

function api(): Plugin {
  return {
    name: 'fold-preview-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const { api } = await server.ssrLoadModule(here('../src/server/routes/api.ts'));
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const r: Response = await api.fetch(
          new Request(`http://local${req.url.slice(4)}`, { method: req.method, headers: req.headers as HeadersInit, body: req.method === 'GET' ? undefined : body }),
        );
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await r.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({
  root: here('../src/client'),
  publicDir: here('../public'),
  plugins: [react(), tailwind(), api()],
  resolve: {
    alias: {
      '@devvit/web/server': here('./mock-server.ts'),
      '@devvit/web/client': here('./mock-client.ts'),
    },
  },
  ssr: { noExternal: ['@devvit/web'] },
  server: { port: 5182, fs: { allow: [here('..')] } },
});
