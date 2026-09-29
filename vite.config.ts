import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
import fs from 'node:fs';
import nodePath from 'node:path';

export default defineConfig({
  root: path('./web'),
  publicDir: path('./public'),
  plugins: [
    react(),
    {
      name: 'resolve-base-ui-mjs',
      resolveId(source, importer) {
        if (importer && importer.includes('@base-ui') && source.endsWith('.mjs')) {
          const jsTarget = nodePath.resolve(nodePath.dirname(importer), source.replace(/\.mjs$/, '.js'));
          if (fs.existsSync(jsTarget)) return jsTarget;
        }
      }
    }
  ],
  resolve: {
    alias: [
      { find: /^@base-ui\/react\/(.+)$/, replacement: path('./node_modules/@base-ui/react/$1/index.js') },
      { find: '@base-ui/react', replacement: path('./node_modules/@base-ui/react/index.js') },
      { find: '@', replacement: path('./') }
    ]
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { watch: { usePolling: true } },
  build: { outDir: path('./dist'), emptyOutDir: true }
});
