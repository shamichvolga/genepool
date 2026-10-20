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
import { NULL_INDEX } from "./MathConstants";
import { assert } from "./Utility";


export function FamilyTree()
{
    function FamilyTreeNode()
    {
        //based on the index of the swimbot in the pool at the time the node was reated
        this.poolIndex          = NULL_INDEX;
        this.parent1PoolIndex   = NULL_INDEX;
        this.parent2PoolIndex   = NULL_INDEX;
        
        // consistent with the indeces in the node array
        this.parent1Index   = NULL_INDEX;   
        this.parent2Index   = NULL_INDEX;   
                
        this.birthTime  = 0;
        this.deathTime  = 0;
        this.alive      = true;
        this.genes      = null; // Uint8Array - one byte per gene
        this.evolutionTraits = null;
    }

    let _nodes = new Array();  
    let _numNodes = 0;  
    let _latestNodeForPoolIndex = new Map(); // pool index -> newest node with that pool index
    
    //-----------------------
    this.reset = function()
    {
        _numNodes = 0;
        _latestNodeForPoolIndex.clear();
        _nodes = [];
        _nodes.length = 0;
    }
    
    //----------------------------------------------------------------
    // saving and loading a world: the nodes as columns of numbers
    //----------------------------------------------------------------
    this.exportState = function()
    {
        const n = _numNodes;
        const length = ( n > 0 ) ? _nodes[0].genes.length : 0;
        const cols  = new Float64Array( n * 8 );
        const genes = new Uint8Array( n * length );
        const traits = new Array( n );
        for (let i = 0; i < n; i++)
        {
            const node = _nodes[i];
            cols.set( [ node.poolIndex, node.parent1PoolIndex, node.parent2PoolIndex, node.parent1Index, node.parent2Index, node.birthTime, node.deathTime, node.alive ? 1 : 0 ], i * 8 );
            genes.set( node.genes, i * length );
            traits[i] = node.evolutionTraits;
        }
        return { n, length, cols, genes, traits: JSON.stringify( traits ) };
    }

    this.importState = function( state )
    {
        this.reset();
        const traits = JSON.parse( state.traits );
        for (let i = 0; i < state.n; i++)
        {
            const c = state.cols;
            const node = new FamilyTreeNode;
            node.poolIndex = c[ i * 8 ]; node.parent1PoolIndex = c[ i * 8 + 1 ]; node.parent2PoolIndex = c[ i * 8 + 2 ];
            node.parent1Index = c[ i * 8 + 3 ]; node.parent2Index = c[ i * 8 + 4 ];
            node.birthTime = c[ i * 8 + 5 ]; node.deathTime = c[ i * 8 + 6 ]; node.alive = c[ i * 8 + 7 ] === 1;
            node.genes = state.genes.slice( i * state.length, ( i + 1 ) * state.length );
            node.evolutionTraits = traits[i];
            _nodes[i] = node;
            _latestNodeForPoolIndex.set( node.poolIndex, i );
        }
        _numNodes = state.n;
    }

    //----------------------------------------------------
    this.setDeathTime = function( poolIndex, deathTime )
    {
	    assert( poolIndex != NULL_INDEX, "FamilyTree.js: this.setDeathTime: poolIndex != NULL_INDEX" )
    
        let index = getIndexFromPoolIndex( poolIndex );
        
        //assert( index > NULL_INDEX, "family tree: setDeathTime: index > NULL_INDEX" );
        
        if ( index > NULL_INDEX )
        {
            _nodes[ index ].deathTime = deathTime;
            _nodes[ index ].alive = false;
        }
    }
    
    
    //-------------------------------------------------------------------------------------------
    this.addNode = function( poolIndex, parent1PoolIndex, parent2PoolIndex, birthTime, genes, evolutionTraits = null )
    {
        //calulate the proper parent indices based on.....
    
        _nodes[ _numNodes ] = new FamilyTreeNode;
        _nodes[ _numNodes ].poolIndex           = poolIndex;
        _nodes[ _numNodes ].parent1PoolIndex    = parent1PoolIndex;
        _nodes[ _numNodes ].parent2PoolIndex    = parent2PoolIndex;
        _nodes[ _numNodes ].parent1Index        = getIndexFromPoolIndex( parent1PoolIndex );
        _nodes[ _numNodes ].parent2Index        = getIndexFromPoolIndex( parent2PoolIndex );
        _nodes[ _numNodes ].birthTime           = birthTime;
        _nodes[ _numNodes ].deathTime           = 0;
        _nodes[ _numNodes ].alive               = true;
        
        _nodes[ _numNodes ].genes = Uint8Array.from( genes );
        _nodes[ _numNodes ].evolutionTraits = evolutionTraits;

        _latestNodeForPoolIndex.set( poolIndex, _numNodes );
        _numNodes ++;
    }
    
    //------------------------------------------
    function getIndexFromPoolIndex( poolIndex )
    {
        //----------------------------------------------------------
        // pool index values can reoccur as a result of pool swimbot
        // reincarnation, so the newest node with that index wins.
        //----------------------------------------------------------
        let n = _latestNodeForPoolIndex.get( poolIndex );
        return ( n === undefined ) ? NULL_INDEX : n;
    }
    
               
    //-----------------------------------------------------------------------------------------------------
    this.getNumNodes                = function(         ) { return _numNodes; }
    this.getNodeParent1Index        = function( index   ) { return _nodes[ index ].parent1Index;        }
    this.getNodeParent2Index        = function( index   ) { return _nodes[ index ].parent2Index;        }
    this.getNodePoolIndex           = function( index   ) { return _nodes[ index ].poolIndex;           }
    this.getNodeParent1PoolIndex    = function( index   ) { return _nodes[ index ].parent1PoolIndex;    }
    this.getNodeParent2PoolIndex    = function( index   ) { return _nodes[ index ].parent2PoolIndex;    }
    this.getNodeBirthTime           = function( index   ) { return _nodes[ index ].birthTime;           }
    this.getNodeDeathTime           = function( index   ) { return _nodes[ index ].deathTime;           }
    this.getNodeGenes               = function( index   ) { return _nodes[ index ].genes;               }
    this.getNodeEvolutionTraits     = function( index   ) { return _nodes[ index ].evolutionTraits;     }
    this.getNodeAlive               = function( index   ) { return _nodes[ index ].alive;               }
    this.getLatestNodeIndexForPoolIndex = function( poolIndex ) { return getIndexFromPoolIndex( poolIndex ); }

    // Direct offspring which have reached the age of first reproduction are a
    // useful early measure of inherited fitness. Young living offspring are
    // censored until they reach maturity instead of being counted as failures.
    this.getOffspringMaturitySummary = function( currentTime, maturityAge )
    {
        const count = _numNodes;
        const offspringByParent = new Array( count );
        for (let i = 0; i < count; i++) offspringByParent[i] = { total: 0, eligible: 0, matured: 0 };
        const total = { parents: 0, reproducingParents: 0, offspring: 0, eligible: 0, matured: 0 };

        for (let childIndex = 0; childIndex < count; childIndex++)
        {
            const child = _nodes[ childIndex ];
            const age = Math.max( 0, ( child.alive ? currentTime : child.deathTime ) - child.birthTime );
            const eligible = !child.alive || age >= maturityAge;
            const matured = age >= maturityAge;
            const parents = [ child.parent1Index, child.parent2Index ];
            let validParents = 0;
            for (let p = 0; p < 2; p++)
            {
                const parentIndex = parents[p];
                if ( parentIndex < 0 || parentIndex >= count || ( p === 1 && parentIndex === parents[0] )) continue;
                const summary = offspringByParent[ parentIndex ];
                summary.total ++;
                if ( eligible ) summary.eligible ++;
                if ( matured ) summary.matured ++;
                validParents ++;
            }

            // Aggregate totals count each child once; the phenotype groups
            // below count parent-child links so both parents receive credit.
            if ( validParents > 0 ) total.offspring ++;
            if ( validParents > 0 && eligible ) total.eligible ++;
            if ( validParents > 0 && matured ) total.matured ++;
        }

        const groups = {
            small : { parents: 0, offspring: 0, eligible: 0, matured: 0 },
            medium: { parents: 0, offspring: 0, eligible: 0, matured: 0 },
            large : { parents: 0, offspring: 0, eligible: 0, matured: 0 },
        };
        const choosinessGroups = {
            low: { parents: 0, offspring: 0, eligible: 0, matured: 0 },
            medium: { parents: 0, offspring: 0, eligible: 0, matured: 0 },
            high: { parents: 0, offspring: 0, eligible: 0, matured: 0 },
        };
        for (let parentIndex = 0; parentIndex < count; parentIndex++)
        {
            const parent = _nodes[ parentIndex ];
            const traits = parent.evolutionTraits;
            if ( !traits || !( traits.mass > 0 )) continue;
            const group = traits.mass < 300 ? groups.small : ( traits.mass < 700 ? groups.medium : groups.large );
            const children = offspringByParent[ parentIndex ];
            group.parents ++;
            group.offspring += children.total;
            group.eligible += children.eligible;
            group.matured += children.matured;
            total.parents ++;
            if ( children.total > 0 ) total.reproducingParents ++;

            if ( Number.isFinite( traits.choosiness ))
            {
                const chooserGroup = traits.choosiness < 1 / 3 ? choosinessGroups.low
                    : ( traits.choosiness < 2 / 3 ? choosinessGroups.medium : choosinessGroups.high );
                chooserGroup.parents ++;
                chooserGroup.offspring += children.total;
                chooserGroup.eligible += children.eligible;
                chooserGroup.matured += children.matured;
            }
        }

        const summarize = ( group ) => ({
            parents: group.parents,
            offspring: group.offspring,
            eligible: group.eligible,
            matured: group.matured,
            survival: group.eligible > 0 ? group.matured / group.eligible : 0,
            maturedPerParent: group.parents > 0 ? group.matured / group.parents : 0,
        });
        return {
            parents: total.parents,
            reproducingParents: total.reproducingParents,
            offspring: total.offspring,
            eligible: total.eligible,
            matured: total.matured,
            survival: total.eligible > 0 ? total.matured / total.eligible : 0,
            maturedPerParent: total.parents > 0 ? total.matured / total.parents : 0,
            small: summarize( groups.small ),
            medium: summarize( groups.medium ),
            large: summarize( groups.large ),
            choosiness: {
                low: summarize( choosinessGroups.low ),
                medium: summarize( choosinessGroups.medium ),
                high: summarize( choosinessGroups.high ),
            },
        };
    }
}
