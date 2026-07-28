import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [
    react(),
    // gzip e brotli pre-comprimidos em build; a maioria dos hosts estaticos
    // (Vercel, Nginx, CDNs) serve o .gz/.br automaticamente quando presente,
    // evitando comprimir on-the-fly a cada request dos chunks pesados abaixo.
    //
    // Os dois algoritmos vao numa unica instancia via `algorithms`. Registrar
    // duas instancias de `compression()` tambem produz a saida correta, mas
    // cada uma reemite os arquivos da outra e o build fica cheio de
    // "overwrites a previously emitted file".
    compression({ algorithms: ['gzip', 'brotliCompress'] })
  ],
  build: {
    // "hidden" gera o .map sem referenciar via comment no bundle publicado -
    // util para debug de erro de producao (ex. Sentry) sem expor o source
    // map linkado no DevTools de qualquer visitante.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          pdf: ['pdfjs-dist'],
          xlsx: ['xlsx'],
          jspdf: ['jspdf', 'jspdf-autotable']
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  }
});
