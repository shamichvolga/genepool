import { defineConfig, type Plugin } from "vite";
// @ts-ignore (no node types here)
import { execSync } from "node:child_process";
// @ts-ignore (a plain .mjs helper)
import { saveRunChunk } from "./tools/run-report.mjs";

// the code version a run was made with: the commit, "+" if files were changed
// since, and "dev" for the server that follows code edits
function codeVersion( dev: boolean ): string
{
    let v = "unknown";
    try
    {
        v = execSync( "git rev-parse --short HEAD", { encoding: "utf8" }).trim();
        if ( execSync( "git status --porcelain --untracked-files=no", { encoding: "utf8" }).trim() !== "" ) v += "+";
    }
    catch ( e ) { /* (no git) */ }
    return dev ? v + "-dev" : v;
}

// the runs the user starts in the browser are written to runs/ (src/RunRecorder.ts)
function receiveRuns( server: any )
{
    server.middlewares.use( "/__runs", ( req: any, res: any ) =>
    {
        if ( req.method !== "POST" ) { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on( "data", ( c: any ) => body += c );
        req.on( "end", () =>
        {
            try { saveRunChunk( "runs", JSON.parse( body )); res.statusCode = 204; }
            catch ( e ) { console.error( "runs: could not save", e ); res.statusCode = 500; }
            res.end();
        });
    });
}
const runRecorderServer: Plugin =
{
    name: "genepool-run-recorder",
    configureServer( server )        { receiveRuns( server ); },
    configurePreviewServer( server ) { receiveRuns( server ); },
};

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

export default defineConfig( ({ command }) => (
{
    base: "./",
    plugins: [ keepTheWorldRunning, runRecorderServer ],
    define:  { __GENEPOOL_VERSION__: JSON.stringify( codeVersion( command === "serve" )) },
    // the simulation thread starts its own worker threads: module workers
    worker:  { format: "es" },
    server:  { port: 5173, strictPort: true, headers: isolationHeaders,
               watch: { ignored: [ "**/tools/results/**", "**/dist/**", "**/docs/**", "**/runs/**" ] } },
    preview: { port: 4173, headers: isolationHeaders },
}));
