// Things involving the richer solc source map with its AST.
// We use this to filter out some MythX error messages.
//

import { SourceMappingDecoder } from './sourceMappingDecoder';
import {GetOpcode} from './opcodes';

/**
 *  Return the VariableDeclaration AST node associated with instIndex
 *  if there is one. Otherwise return null.
 *  @param {instIndex} number  - bytecode offset of instruction
 *  @param {sourceMap} string  - solc srcmap used to associate the instruction
 *                               with an ast node
 *  @param {ast}               - solc root AST for contract
 *  @return {AST node or null}
 *
 */
export function isVariableDeclaration (instIndex: number, sourceMap: string,
                                       ast: any) {
    const sourceMappingDecoder = new SourceMappingDecoder();
    return sourceMappingDecoder.findNodeAtInstructionIndex('VariableDeclaration',
                                                           instIndex, sourceMap, ast);
}

/* from remix-lib/src/util */
/*
    Binary Search:
    Assumes that @arg array is sorted increasingly
    return largest i such that array[i] <= target; return -1 if array[0] > target || array is empty
  */
export function findLowerBound(target, array) {
    let start = 0;
    let length = array.length;

    while (length > 0) {
      // tslint:disable-next-line:no-bitwise
      const half = length >> 1;
      const middle = start + half;
      if (array[middle] <= target) {
        length = length - 1 - half;
        start = middle + 1;
      } else {
        length = half;
      }
    }
    return start - 1;
  }

/**
 *  Return the true is AST node is a public array.
 *  @param {node} AST node     - bytecode offset of instruction
 *  @return {boolean}
 *
 */
export function isDynamicArray(node): boolean {
    // FIXME: do we want to check:
        // constant: false
    // storageLocation: 'default'
    return (node.stateVariable &&
            node.visibility === 'public' &&
            node.typeName.nodeType === 'ArrayTypeName');
}

    /* from remix-lib/src/util */
   /**
   * Converts a hex string to an array of integers.
   */
  export function hexToIntArray(hexString) {
    if (hexString.slice(0, 2) === '0x') {
      hexString = hexString.slice(2);
    }
    const integers = [];
    for (let i = 0; i < hexString.length; i += 2) {
      integers.push(parseInt(hexString.slice(i, i + 2), 16));
    }
    return integers;
    }

/**
 *  Takes a bytecode hexstring and returns a map indexed by offset
 *  that give the instruction number for that offset.
 *
 *  @param {hexstr} string     - bytecode hexstring
 *  @return {array mapping bytecode offset to an instruction number}
 *
 */
export function makeOffset2InstNum(hexstr: string): Array<number> {
    const bytecode = this.hexToIntArray(hexstr);
    const instMap = [];
    let j = -1;
    for (let i = 0; i < bytecode.length; i++) {
        j++;
        const opcode = GetOpcode(bytecode[i], true);
        if (opcode.name.slice(0, 4) === 'PUSH') {
            const length = bytecode[i] - 0x5f;
            i += length;
        }
            instMap[i] = j;
    }
    return instMap;
}
