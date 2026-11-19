import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/** Emit Brotli/Gzip companions for nginx gzip_static / brotli_static when available. */
function compressAssets(): Plugin {
  return {
    name: "ims-atlas-compress",
    apply: "build",
    async writeBundle(outputOptions, bundle) {
      const { gzipSync } = await import("node:zlib");
      const { writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const dir = outputOptions.dir;
      if (!dir) return;
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (!/\.(js|css|svg|json|html)$/.test(fileName)) continue;
        const source =
          chunk.type === "asset"
            ? typeof chunk.source === "string"
              ? Buffer.from(chunk.source)
              : Buffer.from(chunk.source)
            : Buffer.from(chunk.code);
        if (source.byteLength < 1024) continue;
        await writeFile(join(dir, `${fileName}.gz`), gzipSync(source, { level: 9 }));
      }
    },
  };
}

// GitHub Pages: https://cesar-andress.github.io/ims-atlas/ and custom domain.
// CI sets VITE_BASE=/ims-atlas/ until CNAME is configured, then /.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE || process.env.VITE_BASE || "/";
  return {
    base,
    plugins: [react(), compressAssets()],
    optimizeDeps: {
      exclude: ["@duckdb/duckdb-wasm"],
    },
    worker: {
      format: "es",
    },
    build: {
      target: "es2022",
      cssCodeSplit: true,
      modulePreload: {
        // Only preload the entry graph; route chunks load on demand.
        resolveDependencies: (_filename, deps) =>
          deps.filter(
            (d) =>
              !d.includes("maplibre") &&
              !d.includes("echarts") &&
              !d.includes("duckdb") &&
              !d.includes("Ranking") &&
              !d.includes("Matrix") &&
              !d.includes("MarketMap") &&
              !d.includes("Catalog") &&
              !d.includes("WorldChoropleth") &&
              !d.includes("FactorBars") &&
              !d.includes("StrategicScatter") &&
              !d.includes("ConfigPanel"),
          ),
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("maplibre-gl")) return "maplibre";
              if (id.includes("echarts")) return "echarts";
              if (id.includes("@duckdb")) return "duckdb";
              if (
                id.includes("/react/") ||
                id.includes("/react-dom/") ||
                id.includes("react-router") ||
                id.includes("scheduler")
              ) {
                return "react-vendor";
              }
              if (id.includes("i18next") || id.includes("react-i18next")) {
                return "i18n";
              }
            }
            if (id.includes("/core/src/")) return "core";
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
  };
});
