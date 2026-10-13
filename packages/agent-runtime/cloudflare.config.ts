import { defineConfig, defineContainer, exports } from "@cloudflare/config";

const grok = defineContainer({
  name: "grok",
  schedulingPolicy: "durable_object",
  images: { grok: { dockerfile: "./Dockerfile" } }
});

export default defineConfig({
  worker: {
    name: "agent-runtime",
    entrypoint: "src/index.ts",
    compatibilityDate: "2026-09-04",
    compatibilityFlags: ["nodejs_compat"],
    exports: {
      GrokSandbox: exports.durableObject({ storage: "sqlite", container: grok })
    },
    observability: { enabled: true }
  },
  containers: [grok]
});
