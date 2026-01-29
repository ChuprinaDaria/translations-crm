import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true, // Додати source maps для діагностики TDZ помилок
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Всі vendor бібліотеки (включаючи React) в одному chunk
          // щоб уникнути проблем з порядком завантаження та TDZ помилок
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Виділяємо API модуль окремо для кращого кешування
          if (id.includes('/lib/api')) {
            return 'api';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

