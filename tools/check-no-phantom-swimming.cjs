// Regression: choosing a goal must not move a body whose parts do not stroke.
// This specifically guards against reintroducing direct goal-to-velocity control.
"use strict";

const assert = require("assert");
const { createSimulation } = require("./headless.cjs");

const run = createSimulation(99173, {
    INITIAL_NUM_SWIMBOTS: 0,
    INITIAL_NUM_FOODBITS: 0,
    MAX_SWIMBOTS: 10,
    MAX_FOODBITS: 20,
    OBSTACLE_ENABLED: false,
    CURRENTS_ENABLED: false,
    RUDDER_ENABLED: false,
});
const s = run.sandbox;
const gp = run.genePool;

let genes = null;
for (let attempt = 0; attempt < 10000; attempt++) {
    const genotype = new s.Genotype();
    genotype.randomize();
    const phenotype = new s.Embryology().generatePhenotypeFromGenotype(genotype);
    if (phenotype.numParts === 3) {
        genes = [];
        for (let g = 0; g < s.NUM_GENES; g++) genes.push(genotype.getGeneValue(g));
        break;
    }
}
assert(genes, "a three-part genotype should be generated");
gp.createNewSwimbotWithGenes(genes);
const bot = gp.getSwimbotAt(0);
const st = s.sharedState();
const b = 0;
const k = 0;
const o = 0;

const center = new s.Vector2D();
center.setXY((s.POOL_LEFT + s.POOL_RIGHT) / 2, (s.POOL_TOP + s.POOL_BOTTOM) / 2);
bot.setPosition(center);
bot.setVelocity(new s.Vector2D());

st.bots[b + s.B_ENERGY] = 200;
st.bots[b + s.B_GOAL_X] = 1;
st.bots[b + s.B_GOAL_Y] = 0;
st.bots[b + s.B_FOCUS_X] = 1;
st.bots[b + s.B_FOCUS_Y] = 0;
st.bots[b + s.B_EFFORT] = 1;
st.bots[b + s.B_SPIN] = 0;

for (let p = 0; p < s.MAX_PARTS; p++) {
    st.partAmp[k + p] = 0;
    st.partTurnAmp[k + p] = 0;
    st.partTurnPhase[k + p] = 0;
    const i = o + p * s.PS;
    st.parts[i + s.Q_X] = st.parts[i + s.M_X];
    st.parts[i + s.Q_Y] = st.parts[i + s.M_Y];
    st.parts[i + s.B_A] = 0;
}

const botSnapshot = st.bots.slice(0, s.BOT_STRIDE);
const partSnapshot = st.parts.slice(0, s.PART_STRIDE);
const motion = () => [s.B_POS_X, s.B_POS_Y, s.B_VEL_X, s.B_VEL_Y].map(i => st.bots[b + i]);

for (let step = 0; step < 120; step++) s.physicsStep(0, st);
const towardRight = motion();

// Repeat from exactly the same state with the opposite goal. Without physical
// strokes the goal must have no effect at all; tiny floating-point drift from
// reconstructing the body is allowed, but goal-dependent propulsion is not.
st.bots.set(botSnapshot, 0);
st.parts.set(partSnapshot, 0);
st.bots[b + s.B_GOAL_X] = -1;
st.bots[b + s.B_FOCUS_X] = -1;
for (let step = 0; step < 120; step++) s.physicsStep(0, st);
const towardLeft = motion();

assert.deepStrictEqual(towardLeft, towardRight, "opposite goals must not change a stroke-free body's motion");
assert.strictEqual(bot.getNumParts(), 3, "the regression must exercise a limbless three-part body");

console.log("no-phantom-swimming regression passed: 120 steps, three parts, zero strokes, exact goal independence");
