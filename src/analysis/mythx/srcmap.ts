// Things involving the richer solc source map with its AST.
// We use this to filter out some MythX error messages.
//

import { SourceMappingDecoder } from './sourceMappingDecoder';
import {GetOpcode} from './opcodes';
import * as remixUtil from 'remix-lib/src/util';

/**
 *  Return the VariableDeclaration AST node associated with instIndex
 *  if there is one. Otherwise return null.
 *  @param {sourceLocation} string  - solc srcmap used to associate the instruction
 *                                    with an ast node
 *  @param {ast}                    - solc root AST for contract
 *  @return {AST node or null}
 *
 */
export function isVariableDeclaration (srcmap: string, ast: any) {
    const sourceMappingDecoder = new SourceMappingDecoder();
    const sourceLocation = sourceMappingDecoder.decode(srcmap);
    return sourceMappingDecoder.findNodeAtSourceLocation('VariableDeclaration',
        sourceLocation, ast);
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

// FIXME: this is just a stopgap measure.
// The caller in mythx should be fixed to we don't need this.
/**
 *  @param {String} sourceMap     - solc-type sourceMap
 *  @return take sourceMap entries and turn them into file index 0
*/
export function zeroedSourceMap (sourceMap: string) {
    const srcArray = sourceMap.split(';');
    const modArray = [];
    const indexSeen = -2;
    for (const src of srcArray) {
        const fields = src.split(':');
        if (fields.length >= 3) {
            const index = fields[2];
            if (index !== '-1' && index !== '') {
                if (indexSeen !== -2) {
                    if (indexSeen !== index) {
                        throw new Error(`assuming only one index ${indexSeen} needs moving; saw ${index} as well`);
                    }
                }
                fields[2] = '0';
            }
        }
        const modFields = fields.join(':');
        modArray.push(modFields);
    }
    return modArray.join(';');
}
