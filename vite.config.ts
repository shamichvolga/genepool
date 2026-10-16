import { defineConfig, type Plugin } from "vite";

// Development: a change in the code does not reload the page (which would
// start the world anew). The page only hears "the code changed" and offers
// to apply it, keeping the world (src/devResume.ts).
// GENEPOOL_AUTO_RELOAD=1 brings back the usual reload on every change.
const keepTheWorldRunning: Plugin =
{
    name: "genepool-keep-the-world-running",
    apply: "serve",
    handleHotUpdate( { server, file, modules } )
    {
        if ( modules.length === 0 ) return;      // (not a part of the game: results, notes...)
        if ( ( globalThis as any ).process?.env?.GENEPOOL_AUTO_RELOAD === "1" ) return;
        if ( file.endsWith( ".html" )) return;   // (the page itself changed: reload as usual)
        server.ws.send({ type: "custom", event: "genepool:code-changed", data: { file: file.split( /[\/]/ ).pop() } });
        return [];
    },
};

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
    plugins: [ keepTheWorldRunning ],
    // the simulation thread starts its own worker threads: module workers
    worker:  { format: "es" },
    server:  { port: 5173, strictPort: true, headers: isolationHeaders,
               watch: { ignored: [ "**/tools/results/**", "**/dist/**", "**/docs/**" ] } },
    preview: { port: 4173, headers: isolationHeaders },
});
