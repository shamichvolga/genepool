// Times each part of the body physics separately (ms per step, ns per body part).
//   node tools/physics-timing.cjs [project folder]
"use strict";
const path = require( "path" );
const { createSimulation } = require( path.join( __dirname, "headless.cjs" ) );
const run = createSimulation( 1, {}, process.argv[2] || path.join( __dirname, ".." ) );
for ( let i = 0; i < 50; i++ ) run.genePool.update();
const bots = run.genePool.getSwimbots().filter( b => b.getAlive() );
let parts = 0; for ( const b of bots ) parts += b.getNumParts();
function time( label, fn ) {
    const N = 300;
    for ( let k = 0; k < 20; k++ ) for ( const b of bots ) fn( b );
    const t = process.hrtime.bigint();
    for ( let k = 0; k < N; k++ ) for ( const b of bots ) fn( b );
    const ms = Number( process.hrtime.bigint() - t ) / 1e6;
    console.log( label.padEnd( 26 ), ( ms / N ).toFixed( 2 ), "ms/step ", ( ms * 1e6 / N / parts ).toFixed( 0 ), "ns/part" );
}
time( "updateBodyParts",        b => b.updateBodyParts() );
time( "calculateFluidForces",   b => b.calculateFluidForces() );
time( "getMomentAdjustment",    b => b.getMomentAdjustment() );
time( "calculateCenterOfMass",  b => b.calculateCenterOfMass() );
time( "updateWallCollisions",   b => b.updateWallCollisions() );
time( "getAge (call overhead)", b => b.getAge() );
