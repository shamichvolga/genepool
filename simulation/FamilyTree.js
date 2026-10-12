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

"use strict";


function FamilyTree()
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
        this.genes      = null; // Uint8Array - one byte per gene
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
    
    //----------------------------------------------------
    this.setDeathTime = function( poolIndex, deathTime )
    {
	    assert( poolIndex != NULL_INDEX, "FamilyTree.js: this.setDeathTime: poolIndex != NULL_INDEX" )
    
        let index = getIndexFromPoolIndex( poolIndex );
        
        //assert( index > NULL_INDEX, "family tree: setDeathTime: index > NULL_INDEX" );
        
        if ( index > NULL_INDEX )
        {
            _nodes[ index ].deathTime = deathTime;
        }
    }
    
    
    //-------------------------------------------------------------------------------------------
    this.addNode = function( poolIndex, parent1PoolIndex, parent2PoolIndex, birthTime, genes )
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
        
        _nodes[ _numNodes ].genes = Uint8Array.from( genes );

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
}
