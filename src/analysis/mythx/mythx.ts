import * as smd from './compat/remix-lib/sourceMappingDecoder';
import * as srcmap from './srcmap';
import * as path from 'path';


// const SWC_PREFIX =
//       "https://smartcontractsecurity.github.io/SWC-registry/docs";

/*
  Mythril seems to downplay severity. What eslint calls an "error",
  Mythril calls "warning". And what eslint calls "warning",
  Mythril calls "informational".
*/
const mythx2Severity = {
    High: 2,
    Medium: 1,
};

const isFatal = (fatal, severity) => fatal || severity === 2;


export class MythXIssues {
    private _issues: any;
    private _contractName: any;
    private _buildObj: any;
    private contractSource: string;
    private sourceMap: any;
    private deployedSourceMap: any;
    private offset2InstNum: any;
    private sourceMappingDecoder: any;
    private asts: any;
    private _lineBreakPositions: any;

    /**
     *
     * @param {object} buildObj - Truffle smart contract build object
     */
    constructor(buildObj: any) {
        this._issues = [];
        this._contractName = buildObj.contractName;
        this._buildObj = truffle2MythXJSON(buildObj);
        this.contractSource = buildObj.source;
        this.sourceMap = this._buildObj.sourceMap;
        this.deployedSourceMap = this._buildObj.deployedSourceMap;
        this.offset2InstNum = srcmap.makeOffset2InstNum(this._buildObj.deployedBytecode);

        this.sourceMappingDecoder = new smd.SourceMappingDecoder();
        this.asts = this.mapAsts(this._buildObj.sources);
        this._lineBreakPositions = this.mapLineBreakPositions(this.sourceMappingDecoder, this._buildObj.sources);
    }

    get buildObj() {
        return this._buildObj;
    }

    get lineBreakPositions() {
        return this._lineBreakPositions;
    }

    get issues() {
        return this._issues;
    }

    get issuesWithLineColumn() {
        return this._issues.map(issue => {
           const { sourceFormat, source } = issue;
           const sourceName = path.basename(source);
           const lineBreakPositions = this._lineBreakPositions[sourceName];
            issue.issues.map(i => {
                let startLineCol: any,  endLineCol: any;
                if (sourceFormat === 'evm-byzantium-bytecode') {
                    const offset = parseInt(i.sourceMap.split(':')[0], 10);
                    [startLineCol, endLineCol] = this.byteOffset2lineColumn(offset, lineBreakPositions);
                } else if (sourceFormat === 'text') {
                    // Pick out first srcEntry value
                    const srcEntry = i.sourceMap.split(';')[0];
                    [startLineCol, endLineCol] = this.textSrcEntry2lineColumn(srcEntry, lineBreakPositions);
                }
                if (startLineCol) {
                    i.line = startLineCol.line;
                    i.column = startLineCol.column;
                    i.endLine = endLineCol.line;
                    i.endCol = endLineCol.column;
                }
                return i;
            });
            return issue;
        });
    }

    get contractName() {
        return this._contractName;
    }

    /**
     * Accepts analyze result issues and groups issues by sourceList
     *
     * @param {object[]} issues - MythX analyze API output result issues
     */
    public setIssues(issues) {
        this._issues = issues
            .map(remapMythXOutput)
            .reduce((acc, curr) => acc.concat(curr), []);
    }

    public getBuildObj() {
        return this._buildObj;
    }

    /**
     * Maps linebreak positions of a source to its solidity file from the array of sources
     *
     * @param {object} decoder -  SourceMappingDecoder object
     * @param {object[]} sources - Collection of MythX API output sources property.
     * @returns {object} - linebreak positions grouped by soliduty file paths
     */
    public mapLineBreakPositions(decoder: any, sources: any) {
        const result = {};

        Object.entries(sources).forEach((entry: any) => {
            const sourcePath: string = entry[0];
            const sourceProps: any = entry[1];

            result[sourcePath] = decoder.getLinebreakPositions(sourceProps.source);
        });

        return result;
    }

    /**
     * Maps ast objects to its solidity file from the array of sources
     *
     * @param {object[]} sources - Collection of MythX API output sources property.
     * @returns {object} - ast objects grouped by soliduty file paths
     */
    public mapAsts (sources: any) {
        const result = {};
        Object.entries(sources).forEach((entry: any) => {
            const sourcePath: string = entry[0];
            const sourceProps: any = entry[1];
            result[sourcePath] = sourceProps.ast;
        });

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

    // Return at most one line of text source marked up. If the spanned region
    // is more than one line add ... to the end of the underline.
    // For example:
    //    x =  a + 1 * 2
    //         ^^^^^
    // or if the region spans more than one line:
    //    if (a > b) {
    //    ^^^^^^^^^^^^...
    //
    public sourceLocation2markedLine(startLineCol: any, endLineCol: any): string {
        let endLine = this.contractSource.indexOf('\n', startLineCol.beginLinePos);
        if (endLine === -1) {
            endLine = this.contractSource.length;
        }
        const startText = this.contractSource.slice(startLineCol.beginLinePos, endLine);
        let underlines = ' '.repeat(startLineCol.column);
        if (startLineCol.beginLinePos === endLineCol.beginLinePos) {
            // One same line, mark portion of that line.
            underlines += '^'.repeat(endLineCol.column - startLineCol.column);
        } else {
            underlines += ('^'.repeat(startText.length - startLineCol.column)) + '...';
        }
        return `${startText}\n${underlines}`;
    }

    /**
      * Add to the MythX issue ESLint fields. Note these are added _in addition_.
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
      * - sourceMap,
      * - severity
      * - swcId
      * - swcTitle
      *
      * @param {MythXIssue} issue - the MythX issue we want to convert
      * @param {boolean} spaceLimited - true if we have a space-limited report format
      * @param {string} sourceFormat - the kind of location we have, e.g. evm-bytecode or source text
      * @param {Array<string>} sourceList - a list container objects (e.g. bytecode, source code) that
      *                                     holds the locations that are referred to
      * @returns eslint-issue object
    */
    public issue2EsLint(issue: any, spaceLimited: boolean,
                        sourceFormat: string, sourceName: string) {
        const esIssue = {
            column: 0,
            endCol: 0,
            endLine: -1,
            fatal: false,
            head: issue.description.head,
            line: -1,
            markedText: '',
            message: spaceLimited ? issue.description.head : `${issue.description.head} ${issue.description.tail}`,
            mythXseverity: issue.severity,
            ruleId: issue.swcID,
            severity: mythx2Severity[issue.severity] || 1,
            sourceMap: issue.sourceMap,
            swcID: issue.swcID,
            swcTitle: issue.swcTitle,
            tail: issue.description.tail,
        };

        let startLineCol: any,  endLineCol: any;
        const lineBreakPositions = this._lineBreakPositions[sourceName];

        if (sourceFormat === 'evm-byzantium-bytecode') {
            // Pick out first byteCode offset value
            const offset = parseInt(issue.sourceMap.split(':')[0], 10);
            [startLineCol, endLineCol] = this.byteOffset2lineColumn(offset, lineBreakPositions);
        } else if (sourceFormat === 'text') {
            // Pick out first srcEntry value
            const srcEntry = issue.sourceMap.split(';')[0];
            [startLineCol, endLineCol] = this.textSrcEntry2lineColumn(srcEntry, lineBreakPositions);
            if (startLineCol) {
                esIssue.markedText = this.sourceLocation2markedLine(startLineCol, endLineCol);
            }

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
        const result: any = {
            errorCount: 0,
            filePath: source,
            fixableErrorCount: 0,
            fixableWarningCount: 0,
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
        return this._issues.map(report => this.convertMythXReport2EsIssue(report, spaceLimited));
    }
}

// Take truffle's build/contracts/xxx.json JSON and make it
// compatible with the Mythx Platform API
export const truffle2MythXJSON = function(truffleJSON: any): any {
    const {
        contractName,
        bytecode,
        deployedBytecode,
        sourceMap,
        deployedSourceMap,
        sourcePath,
        source,
        ast,
        compiler: { version },
    } = truffleJSON;

    const sourcesKey = path.basename(sourcePath);

    return {
        bytecode,
        contractName,
        deployedBytecode,
        deployedSourceMap,
        sourceList: [ sourcePath ],
        sourceMap,
        sources: {
            [sourcesKey]: {
                ast,
                source,
            },
        },
        version,
    };
};

export const remapMythXOutput = mythObject => {
    const mapped = mythObject.sourceList.map(source => ({
        issues: [],
        source,
        sourceFormat: mythObject.sourceFormat,
        sourceType: mythObject.sourceType,
    }));

    if (mythObject.issues) {
        mythObject.issues.forEach(issue => {
            issue.locations.forEach(({ sourceMap }) => {
                // const sourceListIndex = sourceMap.split(':')[2];
                // FIXME: Only one sourceList is supported. set to 0
                mapped[0].issues.push({
                    description: issue.description,
                    extra: issue.extra,
                    severity: issue.severity,
                    sourceMap: sourceMap,
                    swcID: issue.swcID,
                    swcTitle: issue.swcTitle,
                });
            });
        });
    }

    return mapped;
};
