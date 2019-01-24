'use strict';

import * as path from 'path';
import * as assert from 'assert';
import * as SourceMappingDecoder from 'remix-lib/src/sourceMappingDecoder';
import * as srcmap from './srcmap';
import * as mythx from './mythx';

/*
  Mythril seems to downplay severity. What eslint calls an "error",
  Mythril calls "warning". And what eslint calls "warning",
  Mythril calls "informational".
*/
const mythx2Severity = {
    High: 3,
    Medium: 2,
};

const isFatal = (fatal: boolean, severity: number) => fatal || severity === 2;


export class MythXIssues {

    public issues: Array<any>;
    public buildObj: any;
    public sourceMap: string;
    public deployedSourceMap: string;
    public offset2InstNum: Array<number>;
    public sourceMappingDecoder: SourceMappingDecoder;
    public asts: any;
    public lineBreakPositions: any;

    /**
     *
     * @param {object} buildObj - Truffle smart contract build object
     */
    constructor(buildObj: any) {
        this.issues = [];
        this.buildObj = mythx.truffle2MythXJSON(buildObj);
        this.sourceMap = this.buildObj.sourceMap;
        this.deployedSourceMap = this.buildObj.deployedSourceMap;
        this.offset2InstNum = srcmap.makeOffset2InstNum(this.buildObj.deployedBytecode);

        this.sourceMappingDecoder = new SourceMappingDecoder();
        this.asts = this.mapAsts(this.buildObj.sources);
        this.lineBreakPositions = this.mapLineBreakPositions(this.sourceMappingDecoder, this.buildObj.sources);
    }

    /**
     * Accepts analyze result issues and groups issues by sourceList
     *
     * @param {object[]} issues - MythX analyze API output result issues
     */
    public setIssues(issues: Array<any>) {
        this.issues = issues
            .map(mythx.remapMythXOutput)
            .reduce((acc, curr) => acc.concat(curr), []);
    }

    /**
     * Maps linebreak positions of a source to its solidity file from the array of sources
     *
     * @param {object} decoder -  SourceMappingDecoder object
     * @param {object[]} sources - Collection of MythX API output sources property.
     * @returns {object} - linebreak positions grouped by soliduty file paths
     */
    public mapLineBreakPositions(decoder: any, sources: any ): any {
        const result = {};

        for (const source of sources) {
            source.forEach(([ sourcePath, { source: any } ]) => {
                result[sourcePath] = decoder.getLinebreakPositions(source);
            });
        }

        return result;
    }

    /**
     * Maps ast objects to its solidity file from the array of sources
     *
     * @param {object[]} sources - Collection of MythX API output sources property.
     * @returns {object} - ast objects grouped by soliduty file paths
     */
    public mapAsts (sources: any): any {
        const result = {};
        for (const source of sources) {
            sources.forEach(([ sourcePath, { ast } ]) => {
                result[sourcePath] = ast;
            });
        }

        return result;
    }

    // Is this an issue that should be ignored?
    public isIgnorable(sourceMapLocation, options, source) {
        const ast = this.asts[source];
        const instIndex = sourceMapLocation.split(':')[0];
        const node = srcmap.isVariableDeclaration(instIndex, this.deployedSourceMap, ast);
        if (node && srcmap.isDynamicArray(node)) {
            if (options.debug) {
                // this might brealk if logger is none.
                const logger = options.logger || console;
                logger.log('**debug: Ignoring Mythril issue around ' +
                      'dynamically-allocated array.');
            }
            return true;
        } else {
            return false;
        }
    }

    /**
      * Turn a bytecode offset into a line and column location.
      * We make use of this.sourceMappingDecoder of this class to make
      * the conversion.
      *
      * @param {integer} bytecodeOffset - the offset we want to convert
      * @returns {line: number, column: number}
      */
    public byteOffset2lineColumn(bytecodeOffset, lineBreakPositions) {
        const instNum = this.offset2InstNum[bytecodeOffset];
        const sourceLocation = this.sourceMappingDecoder.atIndex(instNum, this.deployedSourceMap);
        assert(sourceLocation, 'sourceMappingDecoder.atIndex() should not return null');
        const loc = this.sourceMappingDecoder
            .convertOffsetToLineColumn(sourceLocation, lineBreakPositions);

        // FIXME: note we are lossy in that we don't return the end location
        if (loc.start) {
            // Adjust because routines starts lines at 0 rather than 1.
            loc.start.line++;
        }
        if (loc.end) {
            loc.end.line++;
        }

        // FIXME: Note from discussion with Rocky we agreed
        // that byteOffset2LineColumn should always return
        // data even when line/column can't be found.
        // Default is { start: {line: -1, column: 0}, end: {}}
        const start = loc.start || { line: -1, column: 0 };
        const end = loc.end || {};

        return [start, end];
    }


    /**
      * Turn a srcmap entry (the thing between semicolons) into a line and
      * column location.
      * We make use of this.sourceMappingDecoder of this class to make
      * the conversion.
      *
      * @param {string} srcEntry - a single entry of solc sourceMap
      * @returns {line: number, column: number}
    */
    public textSrcEntry2lineColumn(srcEntry, lineBreakPositions) {
        const ary = srcEntry.split(':');
        const sourceLocation = {
            length: parseInt(ary[1], 10),
            start: parseInt(ary[0], 10),
        };
        const loc = this.sourceMappingDecoder
            .convertOffsetToLineColumn(sourceLocation, lineBreakPositions);
            // FIXME: note we are lossy in that we don't return the end location
        if (loc.start) {
            // Adjust because routines starts lines at 0 rather than 1.
            loc.start.line++;
        }
        if (loc.end) {
            loc.end.line++;
        }
        return [loc.start, loc.end];
    }

    /**
      * Convert a MythX issue into an ESLint-style issue.
      * The eslint report format which we use, has these fields:
      *
      * - column,
      * - endCol,
      * - endLine,
      * - fatal,
      * - line,
      * - message,
      * - ruleId,
      * - severity
      *
      * but a MythX JSON report has these fields:
      *
      * - description.head
      * - description.tail,
      * - locations
      * - severity
      * - swcID
      * - swcTitle
      *
      * @param {MythXIssue} issue - the MythX issue we want to convert
      * @param {boolean} spaceLimited - true if we have a space-limited report format
      * @param {string} sourceFormat - the kind of location we have, e.g. evm-bytecode or source text
      * @param {Array<string>} sourceList - a list container objects (e.g. bytecode, source code) that
      *                                     holds the locations that are referred to
      * @returns eslint-issue object
    */
    public issue2EsLint(issue, spaceLimited, sourceFormat, sourceName) {
        const esIssue = {
            column: 0,
            endCol: 0,
            endLine: -1,
            fatal: false,
            line: -1,
            locations: issue.locations,
            message: spaceLimited ? issue.description.head : `${issue.description.head} ${issue.description.tail}`,
            mythXseverity: issue.severity,
            ruleId: issue.swcID,
            severity: mythx2Severity[issue.severity] || 1,
        };

        let startLineCol: any,  endLineCol: any;
        const lineBreakPositions = this.lineBreakPositions[sourceName];

        if (sourceFormat === 'evm-byzantium-bytecode') {
            // Pick out first byteCode offset value
            const offset = parseInt(issue.sourceMap.split(':')[0], 10);
            [startLineCol, endLineCol] = this.byteOffset2lineColumn(offset, lineBreakPositions);
        } else if (sourceFormat === 'text') {
            // Pick out first srcEntry value
            const srcEntry = issue.sourceMap.split(';')[0];
            [startLineCol, endLineCol] = this.textSrcEntry2lineColumn(srcEntry, lineBreakPositions);
        }
        if (startLineCol) {
            esIssue.line = startLineCol.line;
            esIssue.column = startLineCol.column;
            esIssue.endLine = endLineCol.line;
            esIssue.endCol = endLineCol.column;
        }

        return esIssue;
    }

    /**
     * Converts MythX analyze API output item to Eslint compatible object
     * @param {object} report - issue item from the collection MythX analyze API output
     * @param {boolean} spaceLimited
     * @returns {object}
     */
    public convertMythXReport2EsIssue(report, spaceLimited) {
        const { issues, sourceFormat, source } = report;
        const result = {
            errorCount: 0,
            filePath: source,
            fixableErrorCount: 0,
            fixableWarningCount: 0,
            messages: [],
            warningCount: 0,
        };
        const sourceName = path.basename(source);

        result.messages = issues.map(issue => this.issue2EsLint(issue, spaceLimited, sourceFormat, sourceName));

        result.warningCount = result.messages.reduce((acc,  { fatal, severity }) =>
            !isFatal(fatal , severity) ? acc + 1 : acc, 0);

        result.errorCount = result.messages.reduce((acc,  { fatal, severity }) =>
            isFatal(fatal , severity) ? acc + 1 : acc, 0);

        return result;
    }
    /**
     * Transforms array of MythX Issues into Eslint issues
     *
     * @param {boolean} spaceLimited
     * @returns {object[]}
     */
    public getEslintIssues(spaceLimited) {
        return this.issues.map(report => this.convertMythXReport2EsIssue(report, spaceLimited));
    }
}
