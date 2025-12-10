
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 核心配置：本地开发时的反向代理
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com', // 目标真实地址
        changeOrigin: true, // 修改 Host 头，骗过目标服务器
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''), // 去掉我们自己加的前缀
      },
    },
  },
})
