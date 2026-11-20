import { GENES_AUTOTOMY_BITE, GENES_AUTOTOMY_THREAT, GENES_AUTOTOMY_AMOUNT, GENES_AUTOTOMY_WHICH, GENES_ASYMMETRY, geneAverage, thermalWidthOf, GENES_HUNGER, GENES_PREDATOR, GENES_THERMAL_OPTIMUM, GENES_DIGESTION, GENES_BRIGHTNESS, GENES_CHOOSINESS } from "./EcologyGenes";
import { environment } from "./Environment";
//--------------------------------------------------------------------------
//                                                                        
//    This file is part of GenePool Swimbots.                             
//    Copyright (c) 2021 by Jeffrey Ventrella - All Rights Reserved.      
//                                                                        
//    See the README file or go to swimbots.com for full license details.           
//    You may use, distribute, and modify this code only under the terms  
//    of the "Commons Clause" license (commonsclause.com).                
//                                                                        
//    This software is intended for education, game design, and research. 
//                                                                        
// -------------------------------------------------------------------------- 
import { Genotype, NUM_GENES } from "./Genotype";
import { globalTweakers } from "./Globals";
import { BYTE_SIZE, NULL_INDEX, ONE, ZERO } from "./MathConstants";
import { PREDATOR_LEVEL_THRESHOLD } from "./Parameters";
import { MAX_PARTS, MIN_PARTS, Part, Phenotype, ROOT_PART } from "./SwimbotTypes";
import { assert } from "./Utility";


//----------------------------
//  constants
//----------------------------
//const NUM_CATEGORIES = 3;
//const NUM_CATEGORIES = 6;
export const NUM_CATEGORIES = 4;



//-------------------------------------
//  gene limits
//-------------------------------------
export const MIN_LENGTH            =  3.0; 
export const MAX_LENGTH            =  27.0; 
export const MIN_WIDTH             =  0.5;
export const MIN_SPLINED           =  0; 
export const MAX_SPLINED           =  1; 
export const MIN_END_CAP_SPLINE    =  0.5; 
export const MAX_END_CAP_SPLINE    =  4.0; 

//const MAX_WIDTH             =  5.0; 
export const MAX_WIDTH             =  7.0; 


export const MIN_FREQUENCY         =  0.02;
export const MAX_FREQUENCY         =  0.2;
export const MIN_AMP               = -60.0;
export const MAX_AMP               =  60.0;
export const MIN_PHASE             =  -1.0;
export const MAX_PHASE             =   1.0;	

// Deadzone asymmetry: small deviations from 0.5 are neutral; beyond ±0.48 the
// gene is rescaled to the full -1..+1 range. The wider neutral band keeps
// around half the population classically symmetric even after 100k steps.
export const ASYMMETRY_DEADZONE = 0.48;
export function asymmetryFromGene( geneNorm: number ): number
{
    const raw = geneNorm * 2 - 1;
    if ( raw > ASYMMETRY_DEADZONE ) { return ( raw - ASYMMETRY_DEADZONE ) / ( 1 - ASYMMETRY_DEADZONE ); }
    if ( raw < -ASYMMETRY_DEADZONE ) { return ( raw + ASYMMETRY_DEADZONE ) / ( 1 - ASYMMETRY_DEADZONE ); }
    return 0;
}
export const MIN_COLOR             =   ZERO;
export const MAX_COLOR             =   ONE;
const BRIGHTNESS_COLOR_SHARE        =   0.6;    // how much the brightness decides the body color
export const BRIGHTNESS_FROM_GENES  =   0.5;    // the rest of the brightness comes from the preferred temperature
export const MIN_BRANCH_PERIOD     =   1;
export const MAX_BRANCH_PERIOD     =   4;	
export const MIN_BRANCH_ANGLE      =  -90.0;
export const MAX_BRANCH_ANGLE      =   90.0;
export const MIN_BRANCH_NUMBER     =   0;
export const MAX_BRANCH_NUMBER     =   3;

export const MIN_BRANCH_SHIFT      =   0;
export const MAX_BRANCH_SHIFT      =   6;
export const MIN_BRANCH_REFLECT    =   0;
export const MAX_BRANCH_REFLECT    =   3;
export const MIN_BRANCH_CATEGORY   =   0;
export const MAX_BRANCH_CATEGORY   =   NUM_CATEGORIES - 1;
export const MIN_CUT_OFF           =   MIN_PARTS;
export const MAX_CUT_OFF           =   MAX_PARTS - 1;
export const MIN_SEQUENCE_COUNT    =   MIN_PARTS;
export const MAX_SEQUENCE_COUNT    =   5;

// GP6-inspired experiment: refine an already generated body over several
// passes. It is deliberately separate from topology generation, so the
// control and experiment have exactly the same parts and branches.
export const ITERATIVE_GROWTH_ENABLED = false;
export const ITERATIVE_GROWTH_PASSES  = 16;
const ITERATIVE_GROWTH_FIRST_GENE     = 171; // outside the body, ecology and experimental blocks through 170
const ITERATIVE_GROWTH_COLOR_GENE     = 183; // 12 per-category genes, then one global color-shift scale
const ITERATIVE_GROWTH_LAST_GENE      = ITERATIVE_GROWTH_COLOR_GENE;
export function isIterativeGrowthGene( g: number ): boolean
{
    return ITERATIVE_GROWTH_ENABLED && g >= ITERATIVE_GROWTH_FIRST_GENE && g <= ITERATIVE_GROWTH_LAST_GENE;
}

// Five independent GP6-inspired mechanics. The new loci start after the
// iterative-growth block and are treated as junk unless their experiment is on.
export const SECONDARY_BRANCHING_ENABLED = true;
export const SEGMENT_REPLICATION_ENABLED = true;
export const GROWTH_TURN_ENABLED         = false;
export const BRANCH_AMP_FLIP_ENABLED     = true;
export const SECONDARY_BRANCHING_GENE    = 184;
export const FREQ_MULTIPLIER_GENE         = 206;
export const AMP_MULTIPLIER_GENE          = 207;
export const GLIDE_FACTOR_GENE            = 208;
export const JOINT_LIMIT_GENE             = 209;
export const SEGMENT_REPLICATION_FIRST_GENE = 185; // repeat + delay for each of four categories
export const GROWTH_TURN_FIRST_GENE      = 193;    // amplitude + phase + phase acceleration per category
export const BRANCH_AMP_FLIP_GENE        = 205;
export function isGP6MechanicsGene( g: number ): boolean
{
    return ( SECONDARY_BRANCHING_ENABLED && g === SECONDARY_BRANCHING_GENE )
        || ( SEGMENT_REPLICATION_ENABLED && g >= SEGMENT_REPLICATION_FIRST_GENE && g < GROWTH_TURN_FIRST_GENE )
        || ( GROWTH_TURN_ENABLED && g >= GROWTH_TURN_FIRST_GENE && g < BRANCH_AMP_FLIP_GENE )
        || ( BRANCH_AMP_FLIP_ENABLED && g === BRANCH_AMP_FLIP_GENE );
}
export function isExperimentalEmbryologyGene( g: number ): boolean
{
    return isIterativeGrowthGene( g ) || isGP6MechanicsGene( g )
        || ( g >= 206 && g <= 209 ) || ( g === GENES_ASYMMETRY[0] );
}


export const GREATEST_POSSIBLE_SWIMBOT_MASS = MAX_PARTS * MAX_LENGTH * MAX_WIDTH

export const GREATEST_POSSIBLE_SWIMBOT_LENGTH	= MAX_PARTS * MAX_LENGTH;


//--------------------
export function Embryology()
{	    

let testNoEel = true;

    //-------------------------
    function CategoryValues()
    {	   	
        this.sequenceCount  = ZERO;
        
        //geometry and color
        this.startWidth         = ZERO;
        this.endWidth           = ZERO;
        this.startLength        = ZERO;
        this.endLength          = ZERO;
        this.curl                = ZERO;
        this.startRed           = ZERO;
        this.startGreen         = ZERO;
        this.startBlue          = ZERO;
        this.endRed             = ZERO;
        this.endGreen           = ZERO;
        this.endBlue            = ZERO;
        this.splined            = ZERO;
        this.endCapSpline       = ZERO;
        this.jointMin           = -75;
        this.jointMax           = 75;
        
        // motion
        this.amp                = ZERO;
        this.phase              = ZERO;
        this.turnAmp            = ZERO;
        this.turnPhase          = ZERO;
        this.branchAmp          = ZERO;
        this.branchPhase        = ZERO;
        this.branchTurnAmp      = ZERO;
        this.branchTurnPhase    = ZERO;
        
        //branching
        this.branchPeriod       = ZERO;
        this.branchAngle        = ZERO;
        this.branchNumber       = ZERO;
        this.branchShift        = ZERO;
        this.branchCategory     = ZERO;
        this.branchReflect      = ZERO;
 	}
	    
	//-------------------------------------------------------------
	// variables
	//-------------------------------------------------------------
    let _normalizedGenes        = new Array( NUM_GENES ); 
    let _geneNames              = new Array( NUM_GENES ); 
    let _branchStatus           = new Array( MAX_PARTS );
    let _branchDepth            = new Array( MAX_PARTS );
    let _categoryValues         = new Array( NUM_CATEGORIES ); 
    let _partIndex              = ZERO;
    let _generating             = false;
    let _ampMult                = ONE;
    let _frequency              = ZERO;
    let _numGenesUsed           = 0;
    let _numGenesPerCategory    = 0;
    let _cutOff                 = 0;
    let _asymmetry              = 0;
    let preferredFoodTypeGene   = 0;
    let digestibleFoodTypeGene  = 0;
    
	this.getPreferredFoodTypeGene   = function() { return preferredFoodTypeGene;    }
	this.getDigestibleFoodTypeGene  = function() { return digestibleFoodTypeGene;   }

    for (let g=0; g<NUM_GENES; g++)
    {
        _geneNames[g] = "junk";
    }
    
         
	//----------------------------------------------------
	// generate phenotype from genotype
	//----------------------------------------------------
	this.generatePhenotypeFromGenotype = function( genotype )
	{
        //--------------------------------
        // create new phenotype...
        //--------------------------------
		let phenotype = new Phenotype();
		
	    //-----------------------------------
	    // create categories array
	    //-----------------------------------
		for (let c=0; c<NUM_CATEGORIES; c++)
		{
		    _categoryValues[c] = new CategoryValues();
		}

	    //-----------------------------------
	    // initialize branch status
	    //-----------------------------------
		for (let p=0; p<MAX_PARTS; p++)
		{
		    _branchStatus[p] = false;
                _branchDepth[p]  = 0;
		}

	    //--------------------------------------------------------
	    // convert the gene values from byte to normalized
	    //--------------------------------------------------------
		for (let g=0; g<NUM_GENES; g++)
		{
            _normalizedGenes[g] = genotype.getGeneValue(g) / BYTE_SIZE;
		    assert( _normalizedGenes[g] >= ZERO, "normalizedGenes[g] >= ZERO" );
		    assert( _normalizedGenes[g] <= ONE,  "normalizedGenes[g] <= ONE"  );
		}
        _asymmetry = asymmetryFromGene( _normalizedGenes[ GENES_ASYMMETRY[0] ] );

        //------------------------------------------------------------
        // get the ranges...
        //------------------------------------------------------------
        let sequenceCountRange      = MAX_SEQUENCE_COUNT    - MIN_SEQUENCE_COUNT;
        let widthRange              = MAX_WIDTH             - MIN_WIDTH;
        let lengthRange             = MAX_LENGTH            - MIN_LENGTH;

        let ampRange                = MAX_AMP               - MIN_AMP;
        let frequencyRange          = MAX_FREQUENCY         - MIN_FREQUENCY;
        let phaseRange              = MAX_PHASE             - MIN_PHASE;
        let colorRange              = MAX_COLOR             - MIN_COLOR;
        let periodRange             = MAX_BRANCH_PERIOD     - MIN_BRANCH_PERIOD;
        let branchAngleRange        = MAX_BRANCH_ANGLE      - MIN_BRANCH_ANGLE;
        let branchNumberRange       = MAX_BRANCH_NUMBER     - MIN_BRANCH_NUMBER;
        let branchShiftRange        = MAX_BRANCH_SHIFT      - MIN_BRANCH_SHIFT;
        let branchCategoryRange     = MAX_BRANCH_CATEGORY   - MIN_BRANCH_CATEGORY;
        let branchReflectRange      = MAX_BRANCH_REFLECT    - MIN_BRANCH_REFLECT;
        let cutOffRange             = globalTweakers.maximumParts - 1 - MIN_CUT_OFF;
        let splinedRange            = MAX_SPLINED           - MIN_SPLINED;
        let endCapSplineRange       = MAX_END_CAP_SPLINE    - MIN_END_CAP_SPLINE;
        phenotype.hungerThresholdRatio = 0.1 + geneAverage( genotype, GENES_HUNGER ) * 0.9;
        // the swimbot's own hunger threshold = the pool's setting x 0.5 .. 2
        // (gene 1/3 = exactly the setting); used in the environment pool
        phenotype.hungerFactor     = 0.5 + 1.5 * geneAverage( genotype, GENES_HUNGER );
        // autotomy (dropping a part of the body)
        phenotype.autotomyBite     = geneAverage( genotype, GENES_AUTOTOMY_BITE );                // chance when bitten
        phenotype.autotomyThreat   = geneAverage( genotype, GENES_AUTOTOMY_THREAT );              // 0 never .. 1 at first sight
        phenotype.autotomyAmount   = 0.1 + 0.5 * geneAverage( genotype, GENES_AUTOTOMY_AMOUNT );  // 10 .. 60 % of the parts
        phenotype.autotomyWhich    = geneAverage( genotype, GENES_AUTOTOMY_WHICH );


        // predator level and hunger live in the ecology gene block (EcologyGenes.ts)
        phenotype.predatorLevel    = geneAverage( genotype, GENES_PREDATOR ); // 0..1
        phenotype.thermalOptimum   = geneAverage( genotype, GENES_THERMAL_OPTIMUM );
        phenotype.thermalWidth     = thermalWidthOf( genotype );
        phenotype.digestion        = geneAverage( genotype, GENES_DIGESTION );
        // the body brightness others see: half its own genes, half the preferred
        // temperature (cold-adapted swimbots are darker, like real animals).
        // So the climate a swimbot is adapted to shows in its colors, and
        // choosing a mate of similar color means choosing one from a similar
        // climate (a "magic trait", see docs/БИОЛОГ_ЭТАП5.md)
        phenotype.brightness       = BRIGHTNESS_FROM_GENES * geneAverage( genotype, GENES_BRIGHTNESS )
                                   + ( 1 - BRIGHTNESS_FROM_GENES ) * phenotype.thermalOptimum;
        phenotype.choosiness       = geneAverage( genotype, GENES_CHOOSINESS );

        // Legacy/binary compatibility for other code that may still look for isPredator
        phenotype.isPredator       = phenotype.predatorLevel > PREDATOR_LEVEL_THRESHOLD;

        // Tail genes 206..209: byte 0 (legacy saves) or 128 = neutral 1.0 / 0.0 / [-75, 75]
        const rawFreq  = genotype.getGeneValue( FREQ_MULTIPLIER_GENE );
        const rawAmp   = genotype.getGeneValue( AMP_MULTIPLIER_GENE );
        const rawGlide = genotype.getGeneValue( GLIDE_FACTOR_GENE );
        const rawJoint = genotype.getGeneValue( JOINT_LIMIT_GENE );
        const freqMult  = ( rawFreq === 0 || rawFreq === 128 ) ? 1.0 : Math.pow( 2.0, (( rawFreq - 128 ) / 127 ) * 0.9 );
        const ampMult   = ( rawAmp  === 0 || rawAmp  === 128 ) ? 1.0 : Math.pow( 1.6, ( rawAmp - 128 ) / 127 );
        _ampMult = ampMult;
        const glideVal  = ( rawGlide === 0 || rawGlide <= 128 ) ? 0.0 : (( rawGlide - 128 ) / 127 ) * 0.6;
        const jointBias = ( rawJoint === 0 || rawJoint === 128 ) ? 0.0 : (( rawJoint - 128 ) / 127 ) * 55.0;
        phenotype.glideFactor = glideVal;

        //---------------------------------
        // apply genes
        //---------------------------------
		let g = -1;
        
        g++; _frequency = MIN_FREQUENCY + frequencyRange    * _normalizedGenes[g];  _geneNames[g] = "frequency";
        g++; _cutOff    = MIN_CUT_OFF   + cutOffRange       * _normalizedGenes[g];  _geneNames[g] = "cutoff";
        
		for (let c=0; c<NUM_CATEGORIES; c++)
		{
		    _numGenesPerCategory = 0;
            g++; _categoryValues[c].startRed        = MIN_COLOR             + colorRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "start red";
            g++; _categoryValues[c].startGreen      = MIN_COLOR             + colorRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "start green";
            g++; _categoryValues[c].startBlue	    = MIN_COLOR             + colorRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "start blue";
            g++; _categoryValues[c].endRed	        = MIN_COLOR             + colorRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "end red";
            g++; _categoryValues[c].endGreen        = MIN_COLOR             + colorRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "end green";
            g++; _categoryValues[c].endBlue         = MIN_COLOR             + colorRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "end blue";
            g++; _categoryValues[c].startWidth      = MIN_WIDTH             + widthRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "start width";
            g++; _categoryValues[c].endWidth        = MIN_WIDTH             + widthRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "end width";
            g++; _categoryValues[c].startLength     = MIN_LENGTH            + lengthRange           * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "start length";
            g++; _categoryValues[c].endLength       = MIN_LENGTH            + lengthRange           * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "end length";


            g++; _categoryValues[c].amp             = MIN_AMP               + ampRange              * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "amplitude";
            g++; _categoryValues[c].phase           = MIN_PHASE             + phaseRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "phase";
            g++; _categoryValues[c].turnAmp         = MIN_AMP               + ampRange              * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "turn amplitude";
            g++; _categoryValues[c].turnPhase       = MIN_PHASE             + phaseRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "turn phase";
            g++; _categoryValues[c].branchAmp       = MIN_AMP               + ampRange              * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch amplitude";
            g++; _categoryValues[c].branchPhase     = MIN_PHASE             + phaseRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch phase";
            g++; _categoryValues[c].branchTurnAmp   = MIN_AMP               + ampRange              * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch turn amplitude";
            g++; _categoryValues[c].branchTurnPhase = MIN_PHASE             + phaseRange            * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch turn phase";

            g++; _categoryValues[c].sequenceCount   = MIN_SEQUENCE_COUNT    + sequenceCountRange    * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "sequence count";
            g++; _categoryValues[c].branchPeriod    = MIN_BRANCH_PERIOD     + periodRange           * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch period";
            g++; _categoryValues[c].branchAngle     = MIN_BRANCH_ANGLE      + branchAngleRange      * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch angle";
            g++; _categoryValues[c].branchNumber    = MIN_BRANCH_NUMBER     + branchNumberRange     * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch number";
            g++; _categoryValues[c].branchShift     = MIN_BRANCH_SHIFT      + branchShiftRange      * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch shift";
            g++; _categoryValues[c].branchCategory  = MIN_BRANCH_CATEGORY   + branchCategoryRange   * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch category";
            g++; _categoryValues[c].branchReflect   = MIN_BRANCH_REFLECT    + branchReflectRange    * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "branch reflect";
            
            g++; _categoryValues[c].splined         = MIN_SPLINED           + splinedRange          * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "splined";
            g++; _categoryValues[c].endCapSpline    = MIN_END_CAP_SPLINE    + endCapSplineRange     * _normalizedGenes[g]; _numGenesPerCategory ++;  _geneNames[g] = "end cap spline";
         
            //---------------------------------------------------------------------------------------------
            // make these integers
            //---------------------------------------------------------------------------------------------
            _categoryValues[c].sequenceCount    = Math.floor( ZERO  + _categoryValues[c].sequenceCount  );
            _categoryValues[c].branchPeriod     = Math.floor( ZERO  + _categoryValues[c].branchPeriod   );
            _categoryValues[c].branchNumber     = Math.floor( ONE   + _categoryValues[c].branchNumber   );
            _categoryValues[c].branchShift      = Math.floor( ZERO  + _categoryValues[c].branchShift    );
            _categoryValues[c].branchCategory   = Math.floor( ZERO  + _categoryValues[c].branchCategory );
            _categoryValues[c].branchReflect    = Math.floor( ONE   + _categoryValues[c].branchReflect  );
            _categoryValues[c].splined          = Math.round( ZERO  + _categoryValues[c].splined        );
            const sign = ( c % 2 === 0 ) ? 1 : -1;
            const shift = jointBias * sign;
            _categoryValues[c].jointMin = Math.max( -88, Math.min( -12, -75 + shift ));
            _categoryValues[c].jointMax = Math.min(  88, Math.max(  12,  75 + shift ));
        }

        //-----------------------------------------------------------------------------------------
        // add genes for food type preference and digestibility:
        //
        // by default, swimbots are all born with a preferrence for 0 (green), but if numFoodTypes 
        // is set to 2, then they are born with a genetically-determined preferrence.
        //-----------------------------------------------------------------------------------------
        phenotype.preferredFoodType  = 0;
        phenotype.digestibleFoodType = 0;


        g++;  
        preferredFoodTypeGene = g; 
        _geneNames[g] = "preferred food type";
        if ( globalTweakers.numFoodTypes === 2 ) 
        {
            phenotype.preferredFoodType = Math.floor( _normalizedGenes[g] * 2 );     
        }   

        g++;  
        digestibleFoodTypeGene = g; 
        _geneNames[g] = "digestible food type";
        if ( globalTweakers.numFoodTypes === 2 ) 
        {
            phenotype.digestibleFoodType = Math.floor( _normalizedGenes[g] * 2 );     
        }   
        

        //---------------------------------------
        // important: set _numGenesUsed
        //---------------------------------------
        _numGenesUsed = g + 1;
        if ( ITERATIVE_GROWTH_ENABLED )
        {
            for ( let c = 0; c < NUM_CATEGORIES; c++ )
            {
                const gene = ITERATIVE_GROWTH_FIRST_GENE + c * 3;
                _geneNames[ gene     ] = "iterative width growth";
                _geneNames[ gene + 1 ] = "iterative length growth";
                _geneNames[ gene + 2 ] = "iterative category shift";
            }
            _geneNames[ ITERATIVE_GROWTH_COLOR_GENE ] = "iterative color shift scale";
        }
        if ( SECONDARY_BRANCHING_ENABLED ) { _geneNames[ SECONDARY_BRANCHING_GENE ] = "secondary branching"; }
        if ( SEGMENT_REPLICATION_ENABLED )
        {
            for ( let c = 0; c < NUM_CATEGORIES; c++ )
            {
                _geneNames[ SEGMENT_REPLICATION_FIRST_GENE + c * 2     ] = "replicate number";
                _geneNames[ SEGMENT_REPLICATION_FIRST_GENE + c * 2 + 1 ] = "replicate delay";
            }
        }
        if ( GROWTH_TURN_ENABLED )
        {
            for ( let c = 0; c < NUM_CATEGORIES; c++ )
            {
                _geneNames[ GROWTH_TURN_FIRST_GENE + c * 3     ] = "growth turn amp";
                _geneNames[ GROWTH_TURN_FIRST_GENE + c * 3 + 1 ] = "growth turn phase";
                _geneNames[ GROWTH_TURN_FIRST_GENE + c * 3 + 2 ] = "growth turn phase acc";
            }
        }
        if ( BRANCH_AMP_FLIP_ENABLED ) { _geneNames[ BRANCH_AMP_FLIP_GENE ] = "branch amp flip"; }

        //---------------------------------------
        // make sure this is kosher
        //---------------------------------------
        //console.log( "num genes used = " + _numGenesUsed + " out of " + NUM_GENES );
		assert( _numGenesUsed < NUM_GENES, "embryology: _numGenesUsed < NUM_GENES" );
        
        //---------------------------------
        // set the frequency...
        //---------------------------------
        phenotype.frequency = Math.max( 0.015, Math.min( 0.35, _frequency * freqMult ));
        
        // ВРЕМЕННО: хищники — чёрные, чтобы их было видно
        if (phenotype.predatorLevel > PREDATOR_LEVEL_THRESHOLD) {
            for (let c = 0; c < NUM_CATEGORIES; c++) {
                _categoryValues[c].startRed   = 0;
                _categoryValues[c].startGreen = 0;
                _categoryValues[c].startBlue  = 0;
                _categoryValues[c].endRed     = 0;
                _categoryValues[c].endGreen   = 0;
                _categoryValues[c].endBlue    = 0;
            }
        }
        //------------------------------------------------------------------
        // environment: the body brightness gene shows in the colors (the
        // colors move towards a grey of that brightness), so swimbots that
        // choose a mate of similar color also choose similar brightness
        //------------------------------------------------------------------
        else if ( environment.active )
        {
            const grey = phenotype.brightness;
            const k    = BRIGHTNESS_COLOR_SHARE;
            for (let c = 0; c < NUM_CATEGORIES; c++)
            {
                const v = _categoryValues[c];
                v.startRed   = v.startRed   * ( 1 - k ) + grey * k;
                v.startGreen = v.startGreen * ( 1 - k ) + grey * k;
                v.startBlue  = v.startBlue  * ( 1 - k ) + grey * k;
                v.endRed     = v.endRed     * ( 1 - k ) + grey * k;
                v.endGreen   = v.endGreen   * ( 1 - k ) + grey * k;
                v.endBlue    = v.endBlue    * ( 1 - k ) + grey * k;
            }
        }

        //----------------------------------------------
        // generate the first sequence...
        //----------------------------------------------
        _partIndex = ROOT_PART;
        let startCategory = 0;
        
testNoEel = true;
//console.log( "--------------");
        this.generateBodySequence( phenotype, _partIndex, ZERO, startCategory, ONE );  
testNoEel = false;  


        //----------------------------------------------
        // generate the rest of the body...
        //----------------------------------------------
        _generating = true;
        while ( _generating )
        {          
            for (let p=0; p<MAX_PARTS; p++)
            {
                _generating = false; // this might get set back to true in generateBodySequence
                
                //----------------------------------------------
                // branching...
                //----------------------------------------------
                if ( _branchStatus[p] )
                {        
                    _branchStatus[p] = false; // this might get set back to true in generateBodySequence
                    
                    let partCategory = phenotype.parts[p].category;              
                    
                    let c = _categoryValues[ partCategory ].branchCategory;
                    let reflect = ONE;

                    //--------------------------------------------
                    // grow branch 
                    //--------------------------------------------
                    if ( _categoryValues[c].branchNumber === 1 )
                    {
                        reflect = ONE;
                        this.generateBodySequence( phenotype, p, _categoryValues[c].branchAngle, c, reflect, _branchDepth[p] + 1, _categoryValues[c].branchAngle < 0 ? -1 : 1 );
                    }
                    else
                    {
                        //---------------------------------------------------------------
                        // fan out branch angle across the range of branches....
                        //---------------------------------------------------------------
                        for (let b=0; b<_categoryValues[c].branchNumber; b++)
                        {
                            reflect = ONE;
                            if ( b % _categoryValues[c].branchReflect === 0 )
                            {
                                reflect = -ONE;
                            }

                            let f = -ONE + ( b / ( _categoryValues[c].branchNumber - 1 ) ) * 2;

                            this.generateBodySequence( phenotype, p, _categoryValues[c].branchAngle * f, c, reflect, _branchDepth[p] + 1, f );
                        }
                    }                    
                }
            }
        }
        
        //------------------------------------------------------------------------
        // set num parts (it will have accumulated from generating part sequences)
        //------------------------------------------------------------------------
        phenotype.numParts = _partIndex + 1;
        
        assert( phenotype.numParts > 1, "phenotype.numParts > 1"  );

        // (autotomy reorders the parts: remember each one's first number, see Swimbot.restorePhenotypeOrder)
        for (let p = 0; p < phenotype.numParts; p++) { phenotype.parts[p].origin = p; }

        if ( ITERATIVE_GROWTH_ENABLED ) { refineBodyIteratively( phenotype ); }

		//-----------------------------------------------------
		// re-order the parts for more sensible rendering 
		//-----------------------------------------------------
//this.fixPartOrdering( phenotype );

		//----------------------
		// return phenotype
		//----------------------
        return phenotype;
    }
    
    
    
	//-----------------------------------------------
	// re-order the body parts for proper rendering
	//-----------------------------------------------
	this.fixPartOrdering = function( phenotype )
	{
	    //--------------------------------------------------------------------------
	    //  copy the parts array into a backup array and call it "testParts"
	    //--------------------------------------------------------------------------
	    let fixed     = new Array();
	    let testParts = new Array();
	    
	    
	    phenotype.parts[2].red   = 1.0;
	    phenotype.parts[2].green = 1.0;
	    phenotype.parts[2].blue  = 0.5;

        for (let p=1; p<phenotype.numParts; p++)
		{
		    fixed[p] = false;
            testParts[p] = new Part();
		    copyPart( phenotype.parts[p], testParts[p] );
        }
	    
	    //---------------------------
	    // start with part 1
	    //---------------------------
        let currentParentIndex = 1;
	    fixed[ currentParentIndex ] = true;

//console.log( "" );		    
//console.log( "" );		    

	    //-----------------------------------------------------
	    // loop through the rest of the parts to replace them 
	    // with the copy...possibly in a different order)
	    //-----------------------------------------------------
        for (let p=1; p<phenotype.numParts; p++)
		{
//let r = phenotype.numParts - p;		    
//console.log( phenotype.numParts + ", " + p + ", " + r );		    
//copyPart( testParts[r], phenotype.parts[p] );
	
copyPart( testParts[p], phenotype.parts[p] );
	
	
	        /*
            //------------------------------------------------------
            // we need to loop through testParts to see if any 
            // part is a child of testParts[ currentParentIndex ]
            //------------------------------------------------------
            for (let o=1; o<phenotype.numParts; o++)
            {	     
                if ( testParts[o].parent === currentParentIndex )
                {
                    if ( ! fixed[o] )
                    {
                        if ( ! _branchStatus[o] )
                        {
                            copyPart( testParts[p], phenotype.parts[p] );
                            fixed[o] = true;
                            currentParentIndex = o;
                        }
                    }
                }
            }
            */
        }
    }
    
    
    
    
	//--------------------------------------
	// copy part
	//--------------------------------------
    function copyPart( from, to )
    {
        to.category			= from.category;
        to.position			= from.position;        
        to.velocity			= from.velocity;
        to.previousMid 		= from.previousMid;
        to.midPosition 		= from.midPosition;
        to.perpendicular	= from.perpendicular;
        to.bendingAngle		= from.bendingAngle;
        to.currentAngle		= from.currentAngle;

// do not use this
//to.parent = from.parent;

        to.mass				= from.mass;
        to.length			= from.length;
        to.width			= from.width;
        to.angle		    = from.angle;
        //to.branchAngle		= from.branchAngle;
        to.frequency		= from.frequency;
        to.amp			    = from.amp;
        to.phase		    = from.phase;
        to.turnAmp		    = from.turnAmp;
        to.turnPhase	    = from.turnPhase;
        to.momentFactor		= from.momentFactor;
        to.red				= from.red;
        to.green			= from.green;
        to.blue				= from.blue;
        to.splined          = from.splined;
        to.endCapSpline     = from.endCapSpline;
        to.numDecendents	= from.numDecendents;
        
        for (let d=0; d<MAX_PARTS; d++)
        {
            to.decendent[d] = from.decendent[d]; 
        }  
    }
    
    
	//---------------------------------------------------------------------------------
	// generate body sequence
	//---------------------------------------------------------------------------------
	this.generateBodySequence = function( phenotype, parent, branchAngle, c, reflect, depth = 0, branchSide = 0 )
	{
        const secondaryTip = SECONDARY_BRANCHING_ENABLED && depth === 1
            && _normalizedGenes[ SECONDARY_BRANCHING_GENE ] >= 0.25;
        const replicateNumber = SEGMENT_REPLICATION_ENABLED
            ? 1 + Math.min( 2, Math.floor( 3 * _normalizedGenes[ SEGMENT_REPLICATION_FIRST_GENE + c * 2 ] )) : 1;
        const replicateDelay = SEGMENT_REPLICATION_ENABLED
            ? 1 + Math.min( 2, Math.floor( 3 * _normalizedGenes[ SEGMENT_REPLICATION_FIRST_GENE + c * 2 + 1 ] )) : 1;
        const growthAmp   = GROWTH_TURN_ENABLED ? 24 * ( _normalizedGenes[ GROWTH_TURN_FIRST_GENE + c * 3 ] - 0.5 ) : 0;
        const growthPhase = GROWTH_TURN_ENABLED ? 2 * _normalizedGenes[ GROWTH_TURN_FIRST_GENE + c * 3 + 1 ] - 1 : 0;
        const growthAcc   = GROWTH_TURN_ENABLED ? 0.5 * ( _normalizedGenes[ GROWTH_TURN_FIRST_GENE + c * 3 + 2 ] - 0.5 ) : 0;
        let growthTurn = 0;

        // Paired branches inherit opposite multipliers. A negative branch angle
        // is the left side; with a positive asymmetry gene the left grows a
        // little longer and swings a little wider, and the right does the
        // opposite. The root body (depth 0) is never touched.
        const asymSide  = branchSide !== 0 ? ( branchSide < 0 ? -1 : 1 ) : ( branchAngle < 0 ? -1 : 1 );
        const asymAngle = depth > 0 ? ( asymSide < 0 ? 1 + 0.35 * _asymmetry : 1 - 0.35 * _asymmetry ) : 1;
        const asymSize  = depth > 0 ? ( asymSide < 0 ? 1 + 0.22 * _asymmetry : 1 - 0.22 * _asymmetry ) : 1;
        const asymPhase = depth > 0 ? ( asymSide < 0 ? 1 + 0.45 * _asymmetry : 1 - 0.45 * _asymmetry ) : 1;

        for (let i=0; i<_categoryValues[c].sequenceCount; i++)
        {
            if ( _partIndex < _cutOff )
            {
                //-------------------------
                // increment _partIndex
                //-------------------------
                _partIndex ++;
                assert( _partIndex < MAX_PARTS, "_partIndex < MAX_PARTS" );
                _branchDepth[ _partIndex ] = depth;

                phenotype.parts[ _partIndex ].child = NULL_INDEX; //default

                //-------------------------------------------------------
                // the first part is a branchpoint from the parent
                //-------------------------------------------------------
                if ( i === 0 )
                {
                    phenotype.parts[ _partIndex ].branch    = true;
                    phenotype.parts[ _partIndex ].parent    = parent;
                    phenotype.parts[ _partIndex ].angle     = branchAngle * asymAngle;
                    phenotype.parts[ _partIndex ].amp       = _categoryValues[c].branchAmp;
                    phenotype.parts[ _partIndex ].phase     = _categoryValues[c].branchPhase * _partIndex * asymPhase;
                    phenotype.parts[ _partIndex ].turnAmp   = _categoryValues[c].branchTurnAmp;
                    phenotype.parts[ _partIndex ].turnPhase = _categoryValues[c].branchTurnPhase * _partIndex;
                    if ( BRANCH_AMP_FLIP_ENABLED && _normalizedGenes[ BRANCH_AMP_FLIP_GENE ] >= 0.5 && reflect < 0 )
                    {
                        phenotype.parts[ _partIndex ].phase    = -phenotype.parts[ _partIndex ].phase;
                        phenotype.parts[ _partIndex ].turnAmp  = -phenotype.parts[ _partIndex ].turnAmp;
                    }
                }
                else
                {
                    let parent = _partIndex - 1;
                    phenotype.parts[ parent ].child = _partIndex;

                    phenotype.parts[ _partIndex ].branch    = false;
                    phenotype.parts[ _partIndex ].parent    = parent;
                    phenotype.parts[ _partIndex ].angle     = ZERO;

                    phenotype.parts[ _partIndex ].amp       = _categoryValues[c].amp;
                    phenotype.parts[ _partIndex ].phase     = _categoryValues[c].phase * _partIndex * asymPhase;
                    phenotype.parts[ _partIndex ].turnAmp   = _categoryValues[c].turnAmp;
                    phenotype.parts[ _partIndex ].turnPhase = _categoryValues[c].turnPhase;
                    if ( GROWTH_TURN_ENABLED )
                    {
                        growthTurn += growthAmp * ( growthPhase + i * growthAcc );
                        phenotype.parts[ _partIndex ].angle = growthTurn;
                    }
                }



if ( testNoEel )
{
    //console.log( "testNoEel" );
    phenotype.parts[ _partIndex ].turnAmp   = ZERO;
    phenotype.parts[ _partIndex ].turnPhase = ZERO;
}

                //-----------------------------------------------
                // apply reflection on amp & joint ROM
                //-----------------------------------------------
                phenotype.parts[ _partIndex ].amp *= reflect * _ampMult;
                phenotype.parts[ _partIndex ].jointMin = _categoryValues[c].jointMin;
                phenotype.parts[ _partIndex ].jointMax = _categoryValues[c].jointMax;

                //---------------------------------------------------
                // set some other attributes
                //---------------------------------------------------
                phenotype.parts[ _partIndex ].category      = c;
                phenotype.parts[ _partIndex ].frequency     = phenotype.frequency;
                phenotype.parts[ _partIndex ].splined       = _categoryValues[c].splined;
                phenotype.parts[ _partIndex ].endCapSpline  = _categoryValues[c].endCapSpline;

                //----------------------------------------------------
                // set attributes that interpolate over the sequence
                //----------------------------------------------------
                let fraction = ZERO;

                if ( _categoryValues[c].sequenceCount > 1 )
                {
                    const delayed = Math.max( 0, i - replicateDelay + 1 );
                    const source = Math.floor( delayed / replicateNumber ) * replicateNumber;
                    fraction = source / ( _categoryValues[c].sequenceCount - 1 );
                }

                phenotype.parts[ _partIndex ].width  = ( _categoryValues[c].startWidth  + fraction * ( _categoryValues[c].endWidth  - _categoryValues[c].startWidth  )) * asymSize;
                phenotype.parts[ _partIndex ].length = ( _categoryValues[c].startLength + fraction * ( _categoryValues[c].endLength - _categoryValues[c].startLength )) * asymSize;
                phenotype.parts[ _partIndex ].red    = _categoryValues[c].startRed    + fraction * ( _categoryValues[c].endRed    - _categoryValues[c].startRed     );
                phenotype.parts[ _partIndex ].green  = _categoryValues[c].startGreen  + fraction * ( _categoryValues[c].endGreen  - _categoryValues[c].startGreen   );
                phenotype.parts[ _partIndex ].blue   = _categoryValues[c].startBlue   + fraction * ( _categoryValues[c].endBlue   - _categoryValues[c].startBlue    );

			    assert( phenotype.parts[ _partIndex ].length > ZERO, "In Embryology: phenotype.parts[ _partIndex ].length > ZERO" );
			    assert( phenotype.parts[ _partIndex ].width  > ZERO, "In Embryology: phenotype.parts[ _partIndex ].width  > ZERO" );

                //---------------------------------------------------------------------------------
                // determine if there is a branching
                //---------------------------------------------------------------------------------
                let mod = ( i + _categoryValues[c].branchShift ) % _categoryValues[c].branchPeriod;

                if ( mod === 0 || ( secondaryTip && i === _categoryValues[c].sequenceCount - 1 ))
                {
                    _generating = true;
        		    _branchStatus[ _partIndex ] = true;
                }
            }
        }
    }

    // A bounded GP6-inspired treatment of geometry, not a wholesale port of
    // its embryology. Existing end colors double as signed color-shift genes;
    // this reuses the current genome without moving the ecology gene block.
    function refineBodyIteratively( phenotype )
    {
        const colorScale = 0.02 + 0.18 * _normalizedGenes[ ITERATIVE_GROWTH_COLOR_GENE ];
        for ( let pass = 0; pass < ITERATIVE_GROWTH_PASSES; pass++ )
        {
            for ( let p = 1; p < phenotype.numParts; p++ ) // the root stays fixed, as in GP6
            {
                const part = phenotype.parts[p];
                const c = part.category;
                const gene = ITERATIVE_GROWTH_FIRST_GENE + c * 3;

                part.width += 0.09 * _normalizedGenes[ gene ];
                if      ( part.width > MAX_WIDTH ) { part.width = MIN_WIDTH; }
                else if ( part.width < MIN_WIDTH ) { part.width = MAX_WIDTH; }

                part.length += 0.3 * _normalizedGenes[ gene + 1 ];
                if      ( part.length > MAX_LENGTH ) { part.length = MIN_LENGTH; }
                else if ( part.length < MIN_LENGTH ) { part.length = MAX_LENGTH; }

                if ( !phenotype.isPredator )
                {
                    const values = _categoryValues[c];
                    part.red   += colorScale * ( values.endRed   - 0.5 );
                    part.green += colorScale * ( values.endGreen - 0.5 );
                    part.blue  += colorScale * ( values.endBlue  - 0.5 );
                    if      ( part.red   > ONE  ) { part.red   = ZERO; }
                    else if ( part.red   < ZERO ) { part.red   = ONE;  }
                    if      ( part.green > ONE  ) { part.green = ZERO; }
                    else if ( part.green < ZERO ) { part.green = ONE;  }
                    if      ( part.blue  > ONE  ) { part.blue  = ZERO; }
                    else if ( part.blue  < ZERO ) { part.blue  = ONE;  }
                }

                const shift = Math.floor( 6 * _normalizedGenes[ gene + 2 ] ) - 3;
                part.category = ( c + shift + 2 * NUM_CATEGORIES ) % NUM_CATEGORIES;
            }
        }
    }

   
	//--------------------------------
	// get num categories
	//--------------------------------
	this.getNumGeneCategories = function()
	{
	    return NUM_CATEGORIES;
	}
    
	//--------------------------------
	// get num genes used
	//--------------------------------
	this.getNumGenesUsed = function()
	{
	    return _numGenesUsed;
	}
    
	//--------------------------------
	// get num genes per category
	//--------------------------------
	this.getNumGenesPerCategory = function()
	{
	    return _numGenesPerCategory;
	}
    
   
	//--------------------------------
	// get gene name
	//--------------------------------
	this.getGeneName = function(g)
	{
	    return _geneNames[g];
	}
    
    
    
} // function Embryology()


//-----------------------------------------------------------------------------
// A body made from a gene file, without creating a swimbot or touching the
// world. Used by the folder gallery: every card shows the real segments,
// branches, widths and colours that Embryology would give these genes.
// The pose is [ startX, startY, endX, endY, width, red, green, blue ] per part,
// turned so that the mouth points right, centred near (0, 0).
//-----------------------------------------------------------------------------
export type CreaturePreview =
{
    pose: number[], parts: number, genesUsed: number,
    diet: "herbivore" | "predator", color: [ number, number, number ], name: string,
};

export function previewFromGenes( genes: number[] ): CreaturePreview
{
    const genotype = new Genotype();
    for (let g = 0; g < NUM_GENES; g++)
    {
        const v = genes && genes[g];
        genotype.setGeneValue( g, ( typeof v === "number" && isFinite( v )) ? Math.max( 0, Math.min( BYTE_SIZE - 1, Math.floor( v ))) : 0 );
    }
    const embryo = new Embryology();
    const ph = embryo.generatePhenotypeFromGenotype( genotype );

    const x = new Array<number>( MAX_PARTS ).fill( 0 );
    const y = new Array<number>( MAX_PARTS ).fill( 0 );
    const a = new Array<number>( MAX_PARTS ).fill( 0 );
    const pose: number[] = [];
    let red = 0, green = 0, blue = 0;

    for (let p = 1; p < ph.numParts; p++)
    {
        const part = ph.parts[p];
        const parent = ( part.parent >= 0 && part.parent < p ) ? part.parent : 0;
        a[p] = a[parent] + part.angle;
        const rad = ( a[p] - a[1] ) * Math.PI / 180;          // the mouth points right
        const ex = x[parent] + part.length * Math.cos( rad );
        const ey = y[parent] - part.length * Math.sin( rad );
        x[p] = ex; y[p] = ey;
        const pr = Math.max( 0, Math.min( 1, part.red ));
        const pg = Math.max( 0, Math.min( 1, part.green ));
        const pb = Math.max( 0, Math.min( 1, part.blue ));
        red += pr; green += pg; blue += pb;
        pose.push( x[parent], y[parent], ex, ey, part.width, pr, pg, pb );
    }
    const n = Math.max( 1, ph.numParts - 1 );
    const color: [ number, number, number ] = [ red / n, green / n, blue / n ];
    const hex = color.map( c => Math.max( 0, Math.min( 255, Math.round( c * 255 ))).toString( 16 ).padStart( 2, "0" )).join( "" );
    return {
        pose, parts: ph.numParts, genesUsed: embryo.getNumGenesUsed(),
        diet: ( ph.predatorLevel > PREDATOR_LEVEL_THRESHOLD ) ? "predator" : "herbivore",
        color, name: "bot_" + ph.numParts + "seg_" + hex,
    };
}





	  
       
