import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appRoot, "..");

const LANDING_PATHS = new Set(["/", "/metodologia", "/privacidad", "/aviso-legal"]);

/** Dev + preview: public marketing routes serve landing.html (MPA). */
function landingHtmlFallback(): Plugin {
  function rewrite(req: { url?: string }, _res: unknown, next: () => void): void {
    const raw = req.url ?? "/";
    const pathOnly = raw.split("?")[0] ?? "/";
    if (LANDING_PATHS.has(pathOnly)) {
      req.url = `/landing.html${raw.includes("?") ? raw.slice(raw.indexOf("?")) : ""}`;
    }
    next();
  }
  return {
    name: "ims-atlas-landing-html",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

/** Write /version.json so clients can detect a newer deploy and reload. */
function emitVersionJson(): Plugin {
  return {
    name: "ims-atlas-version-json",
    apply: "build",
    writeBundle(outputOptions) {
      const dir = outputOptions.dir;
      if (!dir) return;
      let buildId = process.env.VITE_BUILD_ID || process.env.GITHUB_SHA || "";
      if (!buildId) {
        try {
          buildId = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
        } catch {
          buildId = `local-${Date.now()}`;
        }
      }
      const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
        version: string;
      };
      // Data release version = served CURRENT (fallback config/data.json).
      let dataVersion = "";
      const currentCandidates = [
        join(repoRoot, "app/public/data/CURRENT"),
        join(repoRoot, "data/release/public/CURRENT"),
        join(repoRoot, "config/data.json"),
      ];
      for (const cand of currentCandidates) {
        try {
          const raw = readFileSync(cand, "utf8").trim();
          if (cand.endsWith("data.json")) {
            const j = JSON.parse(raw) as { release_version?: string };
            if (j.release_version) dataVersion = j.release_version.replace(/^v/, "");
          } else {
            const v = raw.replace(/^v/, "");
            if (/^\d+\.\d+\.\d+$/.test(v)) dataVersion = v;
          }
          if (dataVersion) break;
        } catch {
          /* try next */
        }
      }
      const payload = {
        buildId,
        version: pkg.version,
        dataVersion: dataVersion || pkg.version,
        builtAt: new Date().toISOString(),
      };
      writeFileSync(
        join(dir, "version.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8",
      );
    },
  };
}

/** Emit Gzip companions for nginx gzip_static (hashed assets + public geo/meta). */
function compressAssets(): Plugin {
  return {
    name: "ims-atlas-compress",
    apply: "build",
    async writeBundle(outputOptions, bundle) {
      const { gzipSync } = await import("node:zlib");
      const { writeFile, readdir, readFile, stat } = await import("node:fs/promises");
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
      // Public-dir copies (geojson, meta) are not always in the Rollup bundle map.
      async function gzipTree(rel: string): Promise<void> {
        const abs = join(dir, rel);
        let entries;
        try {
          entries = await readdir(abs, { withFileTypes: true });
        } catch {
          return;
        }
        for (const ent of entries) {
          const child = join(rel, ent.name);
          if (ent.isDirectory()) {
            await gzipTree(child);
            continue;
          }
          if (!/\.(geojson|json|js|css|svg|html)$/.test(ent.name)) continue;
          if (ent.name.endsWith(".gz")) continue;
          const full = join(dir, child);
          const st = await stat(full);
          if (st.size < 1024) continue;
          const buf = await readFile(full);
          await writeFile(`${full}.gz`, gzipSync(buf, { level: 9 }));
        }
      }
      await gzipTree("geo");
      await gzipTree("meta");
      await gzipTree("status");
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
    plugins: [react(), landingHtmlFallback(), emitVersionJson(), compressAssets()],
    server: {
      fs: {
        // Phase N Changelog imports repo-root CHANGELOG.md via ?raw.
        allow: [appRoot, join(appRoot, "..")],
      },
    },
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
        input: {
          main: resolve(appRoot, "index.html"),
          landing: resolve(appRoot, "landing.html"),
        },
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
