import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/__nn2_proxy': {
        target: 'https://api.nn2.top',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__nn2_proxy/, ''),
      },
    },
  },
});
