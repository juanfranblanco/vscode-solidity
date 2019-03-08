/***
  This is modified from remix-lib/src/sourceMappingDecoder.js

  The essential difference is that remix-lib uses legacyAST and we
  use ast instead. legacyAST has field "children" while ast
  renames this to "nodes".
***/

import * as util from 'remix-lib/src/util';
import { AstWalker } from './astWalker';

/**
 * Decompress the source mapping given by solc-bin.js
 */
export class SourceMappingDecoder {

    /**
     * get a list of nodes that are at the given @arg position
     *
     * @param {String} astNodeType      - type of node to return
     * @param {Int} position     - cursor position
     * @return {Object} ast object given by the compiler
     */
    public nodesAtPosition (astNodeType, position, ast) {
        const astWalker = new AstWalker();
        const callback = {};
        const found = [];
        callback['*'] = function (node) {
            const nodeLocation = sourceLocationFromAstNode(node);
            if (!nodeLocation) {
                return;
            }
            if (nodeLocation.start <= position && nodeLocation.start + nodeLocation.length >= position) {
                if (!astNodeType || astNodeType === node.name) {
                    found.push(node);
                    if (astNodeType) {
                        return false;
                    }
                }
                return true;
            } else {
                return false;
            }
        };
        astWalker.walk(ast.ast, callback);
        return found;
    }

    /**
     * Decode the source mapping for the given @arg index
     *
     * @param {Integer} index      - source mapping index to decode
     * @param {String} mapping     - compressed source mapping given by solc-bin
     * @return {Object} returns the decompressed source mapping for the given index {start, length, file, jump}
     */
    public atIndex (index: any, mapping: any) {
        const ret = {
            file: -1,
            jump: '',
            length: 0,
            start: -1,
        };
        const map = mapping.split(';');
        if (index >= map.length) {
            index = map.length - 1;
        }
        for (let k = index; k >= 0; k--) {
            let current = map[k];
            current = current.split(':');
            if (ret.start === -1 && current[0] && current[0] !== '-1' && current[0].length) {
                ret.start = parseInt(current[0], 10);
            }
            if (ret.length === 0 && current[1] && current[1] !== '-1' && current[1].length) {
                ret.length = parseInt(current[1], 10);
            }
            if (ret.file === -1 && current[2] && current[2] !== '-1' && current[2].length) {
                ret.file = parseInt(current[2], 10);
            }
            if (ret.jump === undefined && current[3] && current[3].length) {
                ret.jump = current[3];
            }
            if (!current.length) {
                continue;
            }
            if (ret.start !== -1 && ret.length !== 0 && ret.file !== -1) {
                break;
            }
        }
        return ret;
    }

    /**
     * Decode the given @arg value
     *
     * @param {string} value      - source location to decode ( should be start:length:file )
     * @return {Object} returns the decompressed source mapping {start, length, file}
     */
    public decode(value) {
        if (value) {
            value = value.split(':');
            return {
                file: parseInt(value[2], 10),
                length: parseInt(value[1], 10),
                start: parseInt(value[0], 10),

            };
        }
    }

    /**
     * Decode the source mapping for the given compressed mapping
     *
     * @param {String} mapping     - compressed source mapping given by solc-bin
     * @return {Array} returns the decompressed source mapping. Array of {start, length, file, jump}
     */
    public decompressAll = function (mapping) {
        const map = mapping.split(';');
        const ret = [];
        for (const src of map) {
            const compressed = src.split(':');
            const sourceMap = {
                file: compressed[2] ? parseInt(compressed[2], 10) : ret[ret.length - 1].file,
                jump: compressed[3] ? compressed[3] : ret[ret.length - 1].jump,
                length: compressed[1] ? parseInt(compressed[1], 10) : ret[ret.length - 1].length,
                start: compressed[0] ? parseInt(compressed[0], 10) : ret[ret.length - 1].start,
            };
            ret.push(sourceMap);
        }
        return ret;
    };

    /**
     * Retrieve line/column position of each source char
     *
     * @param {String} source - contract source code
     * @return {Arrray} returns an array containing offset of line breaks
     */
    public getLinebreakPositions = function (source) {
        const ret = [];
        for (let pos = source.indexOf('\n'); pos >= 0; pos = source.indexOf('\n', pos + 1)) {
            ret.push(pos);
        }
        return ret;
    };

    /**
     * Retrieve the line/colum position for the given source mapping
     *
     * @param {Object} sourceLocation - object containing attributes {source} and {length}
     * @param {Array} lineBreakPositions - array returned by the function 'getLinebreakPositions'
     * @return {Object} returns an object {start: {line, column}, end: {line, column}} (line/column count start at 0)
     */
    public convertOffsetToLineColumn = function (sourceLocation, lineBreakPositions) {
        if (sourceLocation.start >= 0 && sourceLocation.length >= 0) {
            return {
                end: this.convertFromCharPosition(sourceLocation.start + sourceLocation.length, lineBreakPositions),
                start: this.convertFromCharPosition(sourceLocation.start, lineBreakPositions),

            };
        } else {
            return {
                end: null,
                start: null,
            };
        }
    };

    /**
     * Retrieve the first @arg astNodeType that include the source map at arg instIndex
     *
     * @param {String} astNodeType - node type that include the source map instIndex
     * @param {String} instIndex - instruction index used to retrieve the source map
     * @param {String} sourceMap - source map given by the compilation result
     * @param {Object} ast - ast given by the compilation result
     */
    public findNodeAtInstructionIndex (astNodeType, instIndex, sourceMap, ast) {
        const sourceLocation = this.atIndex(instIndex, sourceMap);
        return this.findNodeAtSourceLocation(astNodeType, sourceLocation, ast);
    }

    public convertFromCharPosition (pos, lineBreakPositions) {
        let line = util.findLowerBound(pos, lineBreakPositions);
        if (lineBreakPositions[line] !== pos) {
            line += 1;
        }
        const beginLinePos = line === 0 ? 0 : (lineBreakPositions[line - 1] + 1);
        const column = pos - beginLinePos;
        return {
            beginLinePos: beginLinePos,
            column: column,
            line: line,
        };
    }

    public findNodeAtSourceLocation (astNodeType, sourceLocation, ast) {
        const astWalker = new AstWalker();
        const callback = {};
        let found = null;
        callback['*'] = function (node) {
            const nodeLocation = sourceLocationFromAstNode(node);
            if (!nodeLocation) {
                return true;
            }
            if (nodeLocation.start <= sourceLocation.start && nodeLocation.start + nodeLocation.length >= sourceLocation.start + sourceLocation.length) {
                if (astNodeType === node.nodeType) {
                    found = node;
                    return false;
                } else {
                    return true;
                }
            } else {
                return false;
            }
        };
        astWalker.walk(ast, callback);
        return found;
    }
}

export function sourceLocationFromAstNode(astNode) {
    if (astNode.src) {
        const split = astNode.src.split(':');
        return {
            file: parseInt(split[2], 10),
            length: parseInt(split[1], 10),
            start: parseInt(split[0], 10),
        };
    }
    return null;
}
