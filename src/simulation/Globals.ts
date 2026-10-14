import { GlobalTweakers } from "./Parameters";


export const SimulationStartMode = 
{
    RANDOM       : 0,
    FROGGIES     : 1,
    TANGO        : 2,
    RACE         : 3,
    NEIGHBORHOOD : 4,
    BIG_BANG     : 5,
    BAD_PARENTS  : 6,
    BARRIER      : 7,
    EMPTY        : 8,
    FILE         : 9,
    SPECIES      : 10,
    PETRI        : 11      // "petri": zones of rising temperature, life starts in the mildest one
};

export const CameraNavigationAction = 
{
    LEFT    : 0,
    RIGHT   : 1,
    UP      : 2,
    DOWN    : 3,
    IN      : 4,
    OUT     : 5
}





//---------------------------------------------------------------
// The following code is incomplete - it's purpose is to allow 
// pseudorandom number generation with seeds. 
//---------------------------------------------------------------
//var usingPseudoRandom = false;
//var pseudoRandomSeed = "defaultSeed";
export function gpRandom()
{
    //if ( usingPseudoRandom )
    {
        /* ------------------  aleaPRNG 1.1  ------------------
        Copyright (c) 2017-2020, W. "Mac" McMeans
        LICENSE: BSD 3-Clause License
        https://github.com/macmcmeans/aleaPRNG/blob/master/aleaPRNG-1.1.min.js
        Use this to quickly generate random numbers with good statistical properties.

        Return a 32-bit fraction in the range [0, 1] just like Math.random()
        > gpRandom();  -->  0.30802189325913787
 
        // advance the generator specified number of cycles
        > myRandomNumbers.prng( 4 );

        Want to 'rewind' back to the initial sequence?
        > gpRandom.restart();
        -------------------------------------------------------*/

        /****************************************************************************
         *** THREE DIFFERENT WAYS TO INITIALIZE THE RANDOM NUMBER GENERATOR:      ***
         *** 1. gpRandom = aleaPRNG(); --> for an unpredictable start             ***
         *** 2. gpRandom = aleaPRNG('some seed'); --> for a predictable start     ***
         *** 3. function gpRandom() { return(Math.random()); } --> bypass PRNG    ***
         *** ************************************************************************/

        //function aleaPRNG(){return function(n){"use strict";var r,t,e,o,a,u=new Uint32Array(3),i="";function c(n){var a=function(){var n=4022871197,r=function(r){r=r.toString();for(var t=0,e=r.length;t<e;t++){var o=.02519603282416938*(n+=r.charCodeAt(t));o-=n=o>>>0,n=(o*=n)>>>0,n+=4294967296*(o-=n)}return 2.3283064365386963e-10*(n>>>0)};return r.version="Mash 0.9",r}();r=a(" "),t=a(" "),e=a(" "),o=1;for(var u=0;u<n.length;u++)(r-=a(n[u]))<0&&(r+=1),(t-=a(n[u]))<0&&(t+=1),(e-=a(n[u]))<0&&(e+=1);i=a.version,a=null}function f(n){return parseInt(n,10)===n}var l=function(){var n=2091639*r+2.3283064365386963e-10*o;return r=t,t=e,e=n-(o=0|n)};return l.fract53=function(){return l()+1.1102230246251565e-16*(2097152*l()|0)},l.int32=function(){return 4294967296*l()},l.cycle=function(n){(n=void 0===n?1:+n)<1&&(n=1);for(var r=0;r<n;r++)l()},l.range=function(){var n,r;return 1===arguments.length?(n=0,r=arguments[0]):(n=arguments[0],r=arguments[1]),arguments[0]>arguments[1]&&(n=arguments[1],r=arguments[0]),f(n)&&f(r)?Math.floor(l()*(r-n+1))+n:l()*(r-n)+n},l.restart=function(){c(a)},l.seed=function(){c(Array.prototype.slice.call(arguments))},l.version=function(){return"aleaPRNG 1.1.0"},l.versions=function(){return"aleaPRNG 1.1.0, "+i},0===n.length&&(window.crypto.getRandomValues(u),n=[u[0],u[1],u[2]]),a=n,c(n),l}(Array.prototype.slice.call(arguments))}
         
        //return aleaPRNG( pseudoRandomSeed );
    }
    
    // default...
    return Math.random();
}




// this needs to be the same as the corresponding value in Embryology.js !!!!
export const NUM_GENES_USED = 113;
export const HUNGER_THRESHOLD_GENE_INDEX = 113;  // новый ген для порога голода
//---------------------------------------------------------------
// The global tweakers are all adjustable through the UI.
//---------------------------------------------------------------
export var globalTweakers = new GlobalTweakers();
//---------------------------------------------------------------
// counters that several modules update
//---------------------------------------------------------------
export const simCounters = {
    numDeadSwimbots: 0,
    attackCount: 0,
    births: 0,
    plantMeals: 0,
    meatMeals: 0,
    autotomyThreatDrops: 0,
    autotomyBiteDrops: 0,
    autotomyDecoysEaten: 0,
    meatTargetsWhilePursuing: 0,
    meatMealsWhilePursuing: 0,
    failedAttacks: 0,
    starvationDeaths: 0,
    oldAgeDeaths: 0,
    predationDeaths: 0,
    otherDeaths: 0,
};

export function resetSimulationCounters(): void
{
    simCounters.numDeadSwimbots = 0;
    simCounters.attackCount = 0;
    simCounters.births = 0;
    simCounters.plantMeals = 0;
    simCounters.meatMeals = 0;
    simCounters.autotomyThreatDrops = 0;
    simCounters.autotomyBiteDrops = 0;
    simCounters.autotomyDecoysEaten = 0;
    simCounters.meatTargetsWhilePursuing = 0;
    simCounters.meatMealsWhilePursuing = 0;
    simCounters.failedAttacks = 0;
    simCounters.starvationDeaths = 0;
    simCounters.oldAgeDeaths = 0;
    simCounters.predationDeaths = 0;
    simCounters.otherDeaths = 0;
}


