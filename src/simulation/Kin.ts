import { SharedState } from "./SharedState";
import * as SS from "./MindLayout";

// KIN_NOT_EATEN_ENABLED: parent, child, brother or sister (by birth numbers;
// the founders, numbered 0, have no known family)
export function areKin( st: SharedState, a: number, b: number ): boolean
{
    const M = st.mind, ma = a * SS.MIND_STRIDE, mb = b * SS.MIND_STRIDE;
    const sa = M[ ma + SS.M_SERIAL ], sb = M[ mb + SS.M_SERIAL ];
    const a1 = M[ ma + SS.M_PARENT_A ], a2 = M[ ma + SS.M_PARENT_B ], b1 = M[ mb + SS.M_PARENT_A ], b2 = M[ mb + SS.M_PARENT_B ];
    if (( sa > 0 ) && (( b1 === sa ) || ( b2 === sa ))) return true;      // b is my child
    if (( sb > 0 ) && (( a1 === sb ) || ( a2 === sb ))) return true;      // b is my parent
    if (( a1 > 0 ) && (( a1 === b1 ) || ( a1 === b2 ))) return true;      // a shared parent
    if (( a2 > 0 ) && (( a2 === b1 ) || ( a2 === b2 ))) return true;
    return false;
}

