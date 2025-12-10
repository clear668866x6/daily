
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 移除了 server.proxy，因为 Google GenAI SDK 
  // 在配置正确网络环境的情况下可以直接从浏览器访问
})
