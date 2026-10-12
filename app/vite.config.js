import { defineConfig } from 'vite';
import { resolve } from 'node:path';
// The canonical SQLite implementation lives in ../storage. Resolve its
// browser-only SQL.js runtime from this app, even without a root node_modules symlink.
export default defineConfig({
  resolve: { alias: { 'sql.js': resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.js') } },
  build: { rollupOptions: { input: { main: resolve(__dirname,'index.html') } } }
});
