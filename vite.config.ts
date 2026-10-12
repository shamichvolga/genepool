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
    server:  { port: 5173, headers: isolationHeaders },
    preview: { port: 4173, headers: isolationHeaders },
});
