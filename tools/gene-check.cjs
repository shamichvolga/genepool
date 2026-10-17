//------------------------------------------------------------------------------
// How one gene changes over time in the population: mean, spread, and the
// share in five bands. node tools/gene-check.cjs --gene 162 --seed 7 --steps 60000
//------------------------------------------------------------------------------
"use strict";
const { createSimulation } = require( "./headless.cjs" );
const arg = ( n, d ) => { const i = process.argv.indexOf( "--" + n ); return i >= 0 ? process.argv[ i + 1 ] : d; };
const GENE = +arg( "gene", 162 ), STEPS = +arg( "steps", 60000 ), EVERY = +arg( "every", 10000 );
const run = createSimulation( +arg( "seed", 7 ), {} ); const gp = run.genePool;
const report = ( step ) => {
  const v = []; const bots = gp.getSwimbots();
  for ( let s = 0; s < bots.length; s++ ) if ( bots[s].getAlive() ) v.push( gp.getSwimbotGenes( s )[ GENE ] / 255 );
  const mean = v.reduce( ( a, b ) => a + b, 0 ) / v.length, sd = Math.sqrt( v.reduce( ( a, b ) => a + ( b - mean ) ** 2, 0 ) / v.length );
  const bands = [ 0, 0, 0, 0, 0 ]; for ( const x of v ) bands[ Math.min( 4, Math.floor( x * 5 )) ]++;
  console.log( `step ${ step } n ${ v.length } gene ${ GENE } mean ${ mean.toFixed( 3 ) } sd ${ sd.toFixed( 3 ) } bands % ${ bands.map( b => ( 100 * b / v.length ).toFixed( 0 )).join( "/" ) }` );
};
report( 0 );
for ( let step = 1; step <= STEPS; step++ ) { gp.update(); if ( step % EVERY === 0 ) report( step ); }
