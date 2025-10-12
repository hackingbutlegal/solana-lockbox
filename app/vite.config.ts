import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
    Buffer: ['buffer', 'Buffer'],
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      plugins: [
        {
          name: 'inject-buffer',
          renderChunk(code) {
            if (code.includes('Buffer')) {
              return `import { Buffer } from 'buffer';\nglobalThis.Buffer = Buffer;\n${code}`;
            }
            return code;
          },
        },
      ],
    },
  },
});
