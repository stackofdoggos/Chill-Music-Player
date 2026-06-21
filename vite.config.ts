import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

/** Production build targets https://milesaguilar.com/music */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/music/' : '/',
  build: {
    sourcemap: false,
  },
}))
