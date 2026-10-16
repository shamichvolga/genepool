import { defineConfig } from "vite";

// Cross-origin isolation headers: needed later for SharedArrayBuffer
// (several worker threads sharing the simulation's memory).
const isolationHeaders =
{
    "Cross-Origin-Opener-Policy":   "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig(
{
    base: "./",
    // the simulation thread starts its own worker threads: module workers
    worker:  { format: "es" },
    server:  { port: 5173, headers: isolationHeaders },
    preview: { port: 4173, headers: isolationHeaders },
});
