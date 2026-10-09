import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const mobile = mode === "mobile";
  const host = process.env.TAURI_DEV_HOST;
  return {
    base: "./",
    plugins: [react()],
    clearScreen: !mobile,
    build: { outDir: mobile ? "dist-mobile" : "dist", target: "es2021" },
    server: {
      host: host || "0.0.0.0",
      port: mobile ? 5181 : 5180,
      strictPort: true,
      ...(host ? { hmr: { host, port: 5182 } } : {}),
      watch: { ignored: ["**/src-tauri/**"] },
      ...(mobile ? {} : { proxy: { "/api": "http://127.0.0.1:8099" } }),
    },
  };
});
