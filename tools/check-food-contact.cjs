// Focused regression check for eating meat while pursuing living prey.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const run = createSimulation( 731, { INITIAL_NUM_SWIMBOTS: "80" } );
const sb = run.sandbox;
const bots = run.genePool.getSwimbots();
const predator = bots.find( b => b.getAlive() && b.getPredatorLevel() > sb.PREDATOR_LEVEL_THRESHOLD );
const prey = bots.find( b => b.getAlive() && b.getPredatorLevel() <= sb.PREDATOR_LEVEL_THRESHOLD );
assert( predator, "seed should create a predator" );
assert( prey, "seed should create herbivore prey" );

// Put the prey far enough away that the test exercises meal priority, not a bite.
predator.setEnergy( 1 );
predator.decide();
assert.strictEqual( predator.getBrainState(), sb.BRAIN_STATE_LOOKING_FOR_PREY, "hungry predator should search for prey" );

// two different free food slots of the pool (the decision kernel sees only the pool's food)
const freeSlots = [];
for ( let f = 0; f < sb.MAX_FOODBITS && freeSlots.length < 2; f++ ) { if ( !run.genePool.getFoodBitAt( f ).getAlive() ) freeSlots.push( f ); }
assert.strictEqual( freeSlots.length, 2, "the pool should have free food slots" );

function makeMeat( index, x, y, decoy )
{
    const meat = run.genePool.getFoodBitAt( index );
    meat.initialize( index );
    meat.setType( 2 );
    meat.setEnergy( 10 );
    meat.setAutotomyDecoy( decoy );
    const position = new sb.Vector2D();
    position.setXY( x, y );
    meat.setPosition( position );
    return meat;
}

function showPreyAndMeat( meat )
{
    predator.setEnvironmentalStimuli( 1, [ prey ], true, meat, true, prey, null );
    predator.decide();
    assert.strictEqual( predator.getBrainState(), sb.BRAIN_STATE_PURSUING_PREY, "predator should keep pursuing living prey" );
    assert.strictEqual( predator.getChosenFoodBit(), meat, "meat should remain a secondary target during pursuit" );
}

const mouth = predator.getMouthPosition();
const preyPosition = new sb.Vector2D();
preyPosition.setXY( mouth.x + 500, mouth.y );
prey.setPosition( preyPosition );

const counters = sb.simCounters;
const contactDecoy = makeMeat( freeSlots[0], mouth.x, mouth.y, true );
showPreyAndMeat( contactDecoy );
assert.strictEqual( !!predator.getIsTryingToEat(), true, "mouth contact should trigger eating" );
assert.strictEqual( !!predator.getIsTryingToHunt(), false, "predator must not bite prey in the same step" );
predator.eatChosenFoodBit();
assert.strictEqual( contactDecoy.getAlive(), false, "contact meat should be consumed" );
assert.strictEqual( counters.autotomyDecoysEaten, 1, "the decoy meal should be counted" );
assert.strictEqual( counters.meatMealsWhilePursuing, 1, "the meal should be recorded as eaten during pursuit" );

const tooFar = sb.SWIMBOT_MOUTH_LENGTH + sb.FOOD_BIT_GRAB_RADIUS + 1;
const nonContactMeat = makeMeat( freeSlots[1], mouth.x + tooFar, mouth.y, false );
showPreyAndMeat( nonContactMeat );
assert.strictEqual( !!predator.getIsTryingToEat(), false, "a gap beyond the meat radius must not count as contact" );
assert.strictEqual( !!predator.getIsTryingToHunt(), false, "the distant prey should not cause an unrelated bite" );
assert.strictEqual( nonContactMeat.getAlive(), true, "meat outside the mouth radius must remain uneaten" );
assert( counters.meatTargetsWhilePursuing >= 2, "meat target selections during pursuit should be counted" );

console.log( "food-contact regression passed: pursuit target, contact meal, decoy count, and non-contact" );
