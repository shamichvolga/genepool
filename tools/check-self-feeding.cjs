// Checks C11's neural gate, tissue conversion, legacy brain migration, and
// permanent tissue loss without advancing the whole population for each check.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const common = {
    INITIAL_NUM_SWIMBOTS: "40",
    INITIAL_NUM_FOODBITS: "100",
    MAX_SWIMBOTS: "80",
    MAX_FOODBITS: "200",
};

function firstUsableBot( simulation )
{
    return Array.from( simulation.genePool.getSwimbots() ).find( bot => bot.getAlive() && bot.getNumParts() > 4 );
}

function forceSelfFeedDrive( simulation, bot )
{
    const sb = simulation.sandbox;
    const weights = bot.getGenotype().getBrain();
    weights.fill( 0 );
    weights[ sb.OUT_SELF_EAT * sb.NUM_INPUTS + sb.IN_BIAS ] = 8;
    bot.setEnergy( 1 );
    bot.think();
}

const enabled = createSimulation( 812, Object.assign( {}, common, { SELF_CANNIBALISM_ENABLED: "true" }));
const enabledBot = firstUsableBot( enabled );
assert( enabledBot, "the enabled simulation should have a living organism with removable tissue" );
assert( enabledBot.getUsesNeuralBrain(), "the action should be controlled by the neural brain" );
forceSelfFeedDrive( enabled, enabledBot );
const partsBefore = enabledBot.getNumParts();
const massBefore = enabledBot.getPhenotypeMass();
const energyBefore = enabledBot.getEnergy();
enabledBot.decide();
assert.strictEqual( enabledBot.getGoalDescription(), "consuming own tissue", "the neural output should select self-feeding" );
assert( enabledBot.getNumParts() < partsBefore, "self-feeding should permanently remove a body branch" );
assert( enabledBot.getPhenotypeMass() < massBefore, "the removed branch should reduce body mass" );
assert( enabledBot.getEnergy() > energyBefore, "self-consumed tissue should provide energy below the energy cap" );
assert.strictEqual( enabled.sandbox.simCounters.selfCannibalismEvents, 1, "one action should produce one event" );
assert( enabled.sandbox.simCounters.selfCannibalismEnergy > 0, "the event should report energy gained" );
assert( enabled.sandbox.simCounters.selfCannibalismMass > 0, "the event should report tissue mass removed" );
assert.strictEqual( enabledBot.getAutotomy().partsLost, false, "self-feeding should not enter the defensive regrowth state" );

// Exhaust the remaining removable branches, then verify they do not regrow.
let attempts = 0;
while ( enabledBot.getNumParts() > 4 && attempts < 300 )
{
    enabledBot.decide();
    attempts ++;
}
assert( enabledBot.getNumParts() <= 4, "repeated self-feeding should stop at the structural minimum" );
const partsAtMinimum = enabledBot.getNumParts();
for ( let i = 0; i < 1200; i++ ) enabledBot.decide();
assert.strictEqual( enabledBot.getNumParts(), partsAtMinimum, "consumed tissue must not regrow for free" );

const disabled = createSimulation( 812, common );
const disabledBot = firstUsableBot( disabled );
assert( disabledBot, "the BASE simulation should have a living organism with removable tissue" );
forceSelfFeedDrive( disabled, disabledBot );
const disabledParts = disabledBot.getNumParts();
disabledBot.decide();
assert.strictEqual( disabledBot.getNumParts(), disabledParts, "BASE must ignore the C11 output" );
assert.strictEqual( disabled.sandbox.simCounters.selfCannibalismEvents, 0, "BASE must not record C11 events" );

const legacy = new disabled.sandbox.Genotype();
const inputs = disabled.sandbox.NUM_INPUTS;
const hidden = disabled.sandbox.NUM_HIDDEN;
// (saves from before C12 had 21 inputs, before C11 8 outputs)
const legacyInputs = 21;
const oldWeights = new Float32Array( 8 * legacyInputs + hidden * legacyInputs + hidden * hidden + 8 * hidden );
assert.strictEqual( oldWeights.length, disabled.sandbox.LEGACY_BRAIN_SIZE, "the test brain should have the legacy layout" );
const oldInputOffset = 7 * legacyInputs + disabled.sandbox.IN_BIAS;
const oldHiddenOffset = 8 * legacyInputs;
const oldOutputHiddenOffset = 8 * legacyInputs + hidden * legacyInputs + hidden * hidden;
oldWeights[ oldInputOffset ] = 0.75;
oldWeights[ oldHiddenOffset ] = -0.5;
oldWeights[ oldOutputHiddenOffset ] = 1.25;
legacy.setBrain( oldWeights );
const migrated = legacy.getBrain();
assert.strictEqual( migrated.length, disabled.sandbox.BRAIN_SIZE, "legacy brain should expand to the new network size" );
assert.strictEqual( migrated[ 7 * inputs + disabled.sandbox.IN_BIAS ], 0.75, "legacy direct-output weights should keep their meanings" );
assert.strictEqual( migrated[ 9 * inputs ], -0.5, "legacy hidden-input weights should move to their expanded offset" );
assert.strictEqual( migrated[ 9 * inputs + hidden * inputs + hidden * hidden ], 1.25,
    "legacy hidden-output weights should move to their expanded offset" );

console.log( "self-feeding regression passed: neural choice, tissue-to-energy accounting, permanent loss, BASE gate, and legacy migration" );
