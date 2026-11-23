//------------------------------------------------------------------------------
// SwimbotQueries — read-only morphology, attractiveness, and UI description
// helpers extracted from Swimbot.ts to keep the core entity lightweight.
//------------------------------------------------------------------------------
import { BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_FOOD, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_FOOD, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY, BRAIN_STATE_RESTING, BRAIN_STATE_SELF_FEED } from "./Brain";
import { GREATEST_POSSIBLE_SWIMBOT_LENGTH, GREATEST_POSSIBLE_SWIMBOT_MASS } from "./Embryology";
import { gpRandom } from "./Globals";
import { ONE, ONE_THIRD, ZERO } from "./MathConstants";
import { ATTRACTION_BIG, ATTRACTION_CLOSEST, ATTRACTION_COLORFUL, ATTRACTION_CROOKED, ATTRACTION_HYPER, ATTRACTION_LONG, ATTRACTION_NO_COLOR, ATTRACTION_RANDOM, ATTRACTION_SHORT, ATTRACTION_SIMILAR_COLOR, ATTRACTION_SIMILAR_HYPER, ATTRACTION_SIMILAR_LENGTH, ATTRACTION_SIMILAR_SIZE, ATTRACTION_SIMILAR_STRAIGHT, ATTRACTION_SMALL, ATTRACTION_STILL, ATTRACTION_STRAIGHT, MAX_PARTS, SWIMBOT_VIEW_RADIUS } from "./SwimbotTypes";

const PS  = 14;
const M_X = 2, M_Y = 3;
const A_X = 6, A_Y = 7;
const V_X = 10, V_Y = 11;

const _unitAxisX = new Float64Array( MAX_PARTS );
const _unitAxisY = new Float64Array( MAX_PARTS );

export function getGoalDescriptionForState( brainState: number ): string
{
         if ( brainState === BRAIN_STATE_RESTING          ) return "resting";
    else if ( brainState === BRAIN_STATE_LOOKING_FOR_MATE ) return "looking for mate";
    else if ( brainState === BRAIN_STATE_PURSUING_MATE    ) return "pursuing mate";
    else if ( brainState === BRAIN_STATE_LOOKING_FOR_FOOD ) return "looking for food bit";
    else if ( brainState === BRAIN_STATE_PURSUING_FOOD    ) return "pursuing food bit";
    else if ( brainState === BRAIN_STATE_LOOKING_FOR_PREY ) return "looking for prey";
    else if ( brainState === BRAIN_STATE_PURSUING_PREY    ) return "pursuing prey";
    else if ( brainState === BRAIN_STATE_FLEEING_PREDATOR ) return "fleeing predator";
    else if ( brainState === BRAIN_STATE_SELF_FEED        ) return "consuming own tissue";
    return "(no goal identified)";
}

export function getAttractionDescriptionForCode( a: number ): string
{
         if ( a === ATTRACTION_COLORFUL         ) return "colorful";
    else if ( a === ATTRACTION_BIG              ) return "big";
    else if ( a === ATTRACTION_HYPER            ) return "hyper";
    else if ( a === ATTRACTION_LONG             ) return "long";
    else if ( a === ATTRACTION_STRAIGHT         ) return "straight";
    else if ( a === ATTRACTION_NO_COLOR         ) return "no color";
    else if ( a === ATTRACTION_SMALL            ) return "small";
    else if ( a === ATTRACTION_STILL            ) return "still";
    else if ( a === ATTRACTION_SHORT            ) return "short";
    else if ( a === ATTRACTION_CROOKED          ) return "crooked";
    else if ( a === ATTRACTION_SIMILAR_COLOR    ) return "similar color";
    else if ( a === ATTRACTION_SIMILAR_SIZE     ) return "similar size";
    else if ( a === ATTRACTION_SIMILAR_HYPER    ) return "similar hyper";
    else if ( a === ATTRACTION_SIMILAR_LENGTH   ) return "similar length";
    else if ( a === ATTRACTION_SIMILAR_STRAIGHT ) return "similar straight";
    else if ( a === ATTRACTION_RANDOM           ) return "random";
    else if ( a === ATTRACTION_CLOSEST          ) return "closest";
    return "(no attraction identified)";
}

export function computeColorSaturation( phenotype: any ): number
{
    let saturation = ZERO;
    let accumulatedMass = ZERO;
    for ( let p = 1; p < phenotype.numParts; p++ )
    {
        const part = phenotype.parts[p];
        accumulatedMass += part.mass;
        const rgDiff = Math.abs( part.red - part.green );
        const rbDiff = Math.abs( part.red - part.blue );
        const gbDiff = Math.abs( part.green - part.blue );
        saturation += (( rgDiff + rbDiff + gbDiff ) / 3 ) * part.mass;
    }
    return accumulatedMass > ZERO ? saturation / accumulatedMass : ZERO;
}

export function computeBodyBigness( phenotype: any ): number
{
    return phenotype.mass / GREATEST_POSSIBLE_SWIMBOT_MASS;
}

export function computeBodyLongness( numParts: number, pd: Float64Array ): number
{
    let maxD2 = ZERO;
    for ( let p = 1; p < numParts; p++ )
    {
        const px = pd[ p * PS + M_X ], py = pd[ p * PS + M_Y ];
        for ( let pp = p + 1; pp < numParts; pp++ )
        {
            const xx = px - pd[ pp * PS + M_X ];
            const yy = py - pd[ pp * PS + M_Y ];
            const d2 = xx * xx + yy * yy;
            if ( d2 > maxD2 ) maxD2 = d2;
        }
    }
    return Math.sqrt( maxD2 ) / GREATEST_POSSIBLE_SWIMBOT_LENGTH;
}

export function computeBodyStraightness( numParts: number, pd: Float64Array, pLength: Float64Array ): number
{
    if ( numParts < 3 )
    {
        const base = ONE * 0.7 + ( numParts / MAX_PARTS ) * 0.3;
        return base > ONE ? ONE : base;
    }
    for ( let p = 1; p < numParts; p++ )
    {
        const invL = ONE / pLength[p];
        _unitAxisX[p] = pd[ p * PS + A_X ] * invL;
        _unitAxisY[p] = pd[ p * PS + A_Y ] * invL;
    }
    let amount = ZERO;
    let numTests = 0;
    for ( let p = 1; p < numParts; p++ )
    {
        for ( let pp = p + 1; pp < numParts; pp++ )
        {
            numTests++;
            amount += Math.abs( _unitAxisX[p] * _unitAxisX[pp] + _unitAxisY[p] * _unitAxisY[pp] );
        }
    }
    amount = ( amount / numTests ) * 0.7 + ( numParts / MAX_PARTS ) * 0.3;
    return amount > ONE ? ONE : amount;
}

export function computeBodyHyperness( numParts: number, pd: Float64Array ): number
{
    let amount = ZERO;
    for ( let p = 1; p < numParts; p++ )
    {
        const vx = pd[ p * PS + V_X ], vy = pd[ p * PS + V_Y ];
        amount += Math.sqrt( vx * vx + vy * vy );
    }
    amount *= 0.4;
    return amount > ONE ? ONE : amount;
}

export function computeAttractiveness( self: any, judge: any, criterion: number ): number
{
    if ( criterion === ATTRACTION_COLORFUL        ) return self.getColorSaturation();
    if ( criterion === ATTRACTION_BIG             ) return self.getCurrentBodyBigness();
    if ( criterion === ATTRACTION_HYPER           ) return self.getCurrentBodyHyperness();
    if ( criterion === ATTRACTION_LONG            ) return self.getCurrentBodyLongness();
    if ( criterion === ATTRACTION_STRAIGHT        ) return self.getCurrentBodyStraightness();

    if ( criterion === ATTRACTION_NO_COLOR        ) return ONE - self.getColorSaturation();
    if ( criterion === ATTRACTION_SMALL           ) return ONE - self.getCurrentBodyBigness();
    if ( criterion === ATTRACTION_STILL           ) return ONE - self.getCurrentBodyHyperness();
    if ( criterion === ATTRACTION_SHORT           ) return ONE - self.getCurrentBodyLongness();
    if ( criterion === ATTRACTION_CROOKED         ) return ONE - self.getCurrentBodyStraightness();

    if ( criterion === ATTRACTION_SIMILAR_COLOR   ) return self.getColorSimilarity( judge );
    if ( criterion === ATTRACTION_SIMILAR_SIZE    ) return self.getBignessSimilarity( judge );
    if ( criterion === ATTRACTION_SIMILAR_HYPER   ) return self.getHypernessSimilarity( judge );
    if ( criterion === ATTRACTION_SIMILAR_LENGTH  ) return self.getLengthSimilarity( judge );
    if ( criterion === ATTRACTION_SIMILAR_STRAIGHT) return self.getStraightessSimilarity( judge );

    if ( criterion === ATTRACTION_CLOSEST         ) return self.getCloseness( judge );
    if ( criterion === ATTRACTION_RANDOM          ) return gpRandom();
    return gpRandom();
}

export function computeCloseness( selfPos: any, judgePos: any ): number
{
    const d = selfPos.getDistanceTo( judgePos );
    const closest = d < SWIMBOT_VIEW_RADIUS ? d : SWIMBOT_VIEW_RADIUS;
    return ONE - ( closest / SWIMBOT_VIEW_RADIUS );
}

export function computeColorSimilarity( cSelf: any, cJudge: any ): number
{
    const rDiff = Math.abs( cSelf.red - cJudge.red );
    const gDiff = Math.abs( cSelf.green - cJudge.green );
    const bDiff = Math.abs( cSelf.blue - cJudge.blue );
    return ONE - (( rDiff + gDiff + bDiff ) * ONE_THIRD );
}
