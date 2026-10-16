// Checks C12's neural prey-value/travel-cost tradeoff and inherited outputs.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const common = {
    INITIAL_NUM_SWIMBOTS: "40",
    INITIAL_NUM_FOODBITS: "100",
    MAX_SWIMBOTS: "80",
    MAX_FOODBITS: "200",
};

const enabled = createSimulation( 912, Object.assign( {}, common, { PREDATOR_TARGET_SELECTION_ENABLED: "true" }));
const sb = enabled.sandbox;
const disabled = createSimulation( 912, common );
assert.strictEqual( sb.PREDATOR_TARGET_SELECTION_ENABLED, true, "C12 should be opt-in through its experiment switch" );
const founders = Array.from( enabled.genePool.getSwimbots() ).filter( bot => bot.getAlive() );
const baseFounders = Array.from( disabled.genePool.getSwimbots() ).filter( bot => bot.getAlive() );
assert.strictEqual( founders.length, baseFounders.length, "C12 should preserve the number of baseline founders" );
for ( let i = 0; i < founders.length; i ++ )
{
    const c12 = founders[i];
    const base = baseFounders[i];
    const c12Position = c12.getPosition();
    const basePosition = base.getPosition();
    assert.strictEqual( c12Position.x, basePosition.x, `C12 should preserve founder ${i}'s x coordinate` );
    assert.strictEqual( c12Position.y, basePosition.y, `C12 should preserve founder ${i}'s y coordinate` );
    assert.strictEqual( c12.getEnergy(), base.getEnergy(), `C12 should preserve founder ${i}'s initial energy` );
    assert.strictEqual( c12.getPhenotypeMass(), base.getPhenotypeMass(), `C12 should preserve founder ${i}'s body mass` );
}
assert( founders.every( bot => Number.isFinite( bot.getPreyValueWeight() )
    && Number.isFinite( bot.getPreyTravelWeight() ) && Number.isFinite( bot.getPreyBaitBias() )),
    "C12 should expose finite neural target-choice outputs" );
const choiceWeightCount = 3 * ( sb.NUM_INPUTS + sb.NUM_HIDDEN );
const choiceWeightStart = founders[0].getGenotype().getBrain().length - choiceWeightCount;
const founderChoiceWeights = founders.map( bot => Array.from( bot.getGenotype().getBrain().slice( choiceWeightStart )).join( "," ));
assert( new Set( founderChoiceWeights ).size > 1, "C12 founders should begin with varied inherited neural choice weights" );

const score = sb.preyTargetScore;
assert.strictEqual( typeof score, "function", "the candidate utility should be shared by both perception paths" );
const nearbySmall = { reward: 0.2, distance: 0.1 };
const farRich = { reward: 0.8, distance: 0.9 };
assert( score( farRich.reward, farRich.distance, 1, 0.1 ) > score( nearbySmall.reward, nearbySmall.distance, 1, 0.1 ),
    "high energy weight and low travel cost should favor richer distant prey" );
assert( score( nearbySmall.reward, nearbySmall.distance, 0.1, 1 ) > score( farRich.reward, farRich.distance, 0.1, 1 ),
    "low energy weight and high travel cost should favor closer prey" );
assert( score( 0.5, 0.3, 0.8, 0.2, 0.6, true ) > score( 0.5, 0.3, 0.8, 0.2, 0.6, false ),
    "a positive inherited bait output should favor meat over an equally valuable live target" );

const parentA = new sb.Genotype();
const parentB = new sb.Genotype();
const child = new sb.Genotype();
parentA.setAllGenesToOneValue( 128 );
parentB.setAllGenesToOneValue( 128 );
parentA.getBrain().fill( 1 );
parentB.getBrain().fill( -1 );
child.setAsOffspring( parentA, parentB );
for ( let output = 0; output < 3; output ++ )
{
    const start = choiceWeightStart + output * ( sb.NUM_INPUTS + sb.NUM_HIDDEN );
    const inheritedWeights = Array.from( child.getBrain().slice( start, start + sb.NUM_INPUTS + sb.NUM_HIDDEN ));
    const closeToParent = inheritedWeights.filter( value => Math.abs( value - 1 ) < 0.5 || Math.abs( value + 1 ) < 0.5 );
    assert( closeToParent.length > inheritedWeights.length * 0.8,
        `target-selection output ${output} should inherit a whole parent's weights with small mutations` );
}

assert.strictEqual( disabled.sandbox.PREDATOR_TARGET_SELECTION_ENABLED, false, "BASE should keep the C12 switch off" );
assert( Math.abs( disabled.sandbox.preyTargetScore( 0.8, 0.9, 1, 0.1 ) - 0.71 ) < 1e-12,
    "the pure scoring helper should not depend on the experiment switch" );

console.log( "prey-target-choice regression passed: score tradeoffs, bait choice, and neural output inheritance are represented" );
