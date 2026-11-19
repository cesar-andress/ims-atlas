import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// GitHub Pages: https://cesar-andress.github.io/ims-atlas/ and custom domain.
// CI sets VITE_BASE=/ims-atlas/ until CNAME is configured, then /.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE || process.env.VITE_BASE || "/";
  return {
    base,
    plugins: [react()],
  };
});
