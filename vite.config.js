// vite.config.js
export default {
  server: {
    host: "localhost",
    port: 8848,
  },
  // 设置项目的基础路径，用于GitHub Pages
  base: "/webgpu-ray-tracing-demo/", // 替换为你的仓库名称

  // 构建输出目录
  build: {
    outDir: "dist",
  },
};  