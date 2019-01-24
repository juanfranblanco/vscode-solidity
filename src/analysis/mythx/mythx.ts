import * as smd from './sourceMappingDecoder';
import * as srcmap from './srcmap';
import * as vscode from 'vscode';
import * as path from 'path';

const warnFn = vscode.window.showWarningMessage;

// const SWC_PREFIX =
//       "https://smartcontractsecurity.github.io/SWC-registry/docs";

/********************************************************
Mythx messages currently needs a bit of messaging to
be able to work within the Eslint framework. Some things
we handle here:

- long messages
  Chop at sentence boundary.
- Non-ASCII characters: /[\u0001-\u001A]/ (including \n and `)
  Remove them.
**********************************************************/
function massageMessage(mess: string): string {
    // Mythx messages are long. Strip after first period.
    let sentMatch = null;
    try {
        sentMatch = mess.match('\\.[ \t\n]');
    } catch (err) {
        return 'no message';
    }
    if (sentMatch) {
        mess = mess.slice(0, sentMatch.index + 1);
    }

    // Remove characters that mess up table formatting
    mess = mess.replace(new RegExp(/`/, 'g'), '\'');
    mess = mess.replace(new RegExp(/\n/, 'g'), ' ');
    // mess = mess.replace(new RegExp(/[\u0001-\u001A]/, 'g'), '');
    return mess;
}

/*
  Mythx seems to downplay severity. What eslint calls an "error",
  Mythx calls "warning". And what eslint calls "warning",
  Mythx calls "informational".
*/
const myth2Severity = {
    Informational: 3,
    Warning: 2,
};

const myth2EslintField = {
    'address': 'addr2lineColumn', // Not used
    'description': 'message',
    'line': 'lineNumberStart',
    'swc-description': 'message',
    'title': 'title',
    'tool': 'tool',
    'type': 'severity',
};

/*
  Mythril seems to downplay severity. What eslint calls an "error",
  Mythril calls "warning". And what eslint calls "warning",
  Mythril calls "informational".
*/
const mythx2Severity = {
    High: 3,
    Medium: 2,
};

const isFatal = (fatal, severity) => fatal || severity === 2;


export class MythXIssues {
    private issues: any;
    private _contractName: any;
    private _buildObj: any;
    private sourceMap: any;
    private deployedSourceMap: any;
    private offset2InstNum: any;
    private sourceMappingDecoder: any;
    private asts: any;
    private lineBreakPositions: any;

    /**
     *
     * @param {object} buildObj - Truffle smart contract build object
     */
    constructor(buildObj) {
        this.issues = [];
        this._contractName = buildObj.contractName;
        this._buildObj = truffle2MythXJSON(buildObj);
        this.sourceMap = this._buildObj.sourceMap;
        this.deployedSourceMap = this._buildObj.deployedSourceMap;
        this.offset2InstNum = srcmap.makeOffset2InstNum(this._buildObj.deployedBytecode);

        this.sourceMappingDecoder = new smd.SourceMappingDecoder();
        this.asts = this.mapAsts(this._buildObj.sources);
        this.lineBreakPositions = this.mapLineBreakPositions(this.sourceMappingDecoder, this._buildObj.sources);
    }

    get buildObj() {
        return this._buildObj;
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
        this.issues = issues
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
    public issue2EsLint(issue, spaceLimited, sourceFormat, sourceName) {
        const esIssue = {
            column: 0,
            endCol: 0,
            endLine: -1,
            fatal: false,
            line: -1,
            message: spaceLimited ? issue.description.head : `${issue.description.head} ${issue.description.tail}`,
            mythXseverity: issue.severity,
            ruleId: issue.swcID,
            severity: mythx2Severity[issue.severity] || 1,
        };

        let startLineCol,  endLineCol;
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
    public getEslintIssues(spaceLimited = false) {
        return this.issues.map(report => this.convertMythXReport2EsIssue(report, spaceLimited));
    }
}

// FIXME figure out how to export this class.
class Info {
    private ast: any;
    private buildObj: any;
    private contractSource: string;
    private issues: any;
    private deployedSourceMap: any;
    private sourceLocation: any;
    private sourceMappingDecoder: any;
    private lineBreakPositions: any;
    private loc: any;
    private offset2InstNum: any;
    private sourceMap: any;

    constructor(issues, buildObj) {
        this.issues = issues;
        this.buildObj = buildObj;

        const contractName = buildObj.contractName;
        this.contractSource = buildObj.sources[contractName];

        this.ast = buildObj.ast;
        this.sourceMap = buildObj.sourceMap;
        this.deployedSourceMap = buildObj.deployedSourceMap;
        this.sourceMappingDecoder = new smd.SourceMappingDecoder();
        this.lineBreakPositions = this.sourceMappingDecoder
            .getLinebreakPositions(this.contractSource);
        this.offset2InstNum = srcmap.makeOffset2InstNum(buildObj.deployedBytecode);
    }

    // Is this an issue that should be ignored?
    public isIgnorable(issue, options) {
    // FIXME: is issue.address correct or does it need to be turned into
    // an instruction number?

        const node = srcmap.isVariableDeclaration(issue.address, this.deployedSourceMap,
            this.ast);
        if (node && srcmap.isDynamicArray(node)) {
            if (options.debug) {
                warnFn('**debug: Ignoring Mythx issue around ' +
                       'dynamically-allocated array.');
            }
            return true;
        } else {
            return false;
        }
    }

    /*
    Turn an bytecode offset into a line and column.
    We are lossy here because we don't keep the end location.
    */
    public byteOffset2lineColumn(bytecodeOffset) {
        const instNum = this.offset2InstNum[bytecodeOffset];
        this.sourceLocation = this.sourceMappingDecoder
            .atIndex(instNum, this.deployedSourceMap);
        if (this.sourceLocation) {
            this.loc = this.sourceMappingDecoder
                .convertOffsetToLineColumn(this.sourceLocation, this.lineBreakPositions);
            if (this.loc.start) {
                // Adjust because routines starts lines at 0 rather than 1.
                this.loc.start.line++;
            }
            if (this.loc.end) {
                this.loc.end.line++;
            }
            return [this.loc.start, this.loc.end];
        }
        return [{line: -1, column: 0}, {}];
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
    public sourceLocation2markedLine(startLineCol: any, endLineCol: any) {
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

    /*
    The eslint report format which we use, has these fields:
    line, column, severity, message, ruleId, fatal

    but a Mythx JSON report has these fields:
    address, type, description, contract, function,

    Convert a Mythx issue into an ESLint-style issue.
  */
    public issue2EsLint(issue: any, path1: string) {
        const esIssue = {
            'address': null,
            'column': -1,
            'endCol': -1,
            'endLine': -1,
            'fatal': false,
            'line': '',
            'markedText': '',
            'path': path1,
            'ruleId': '',
            'severity': myth2Severity.Warning,
            'srcmap': '',
            'title': '',
            'tool': '',
            'type': '',

        };

        let fields = ['title', 'tool', 'type', 'address', 'description'];
        switch (issue.tool) {
        case 'maru':
           fields = ['title', 'tool', 'type', 'line', 'swc-description'];
            break;
        case 'mythx':
            issue['swc-id'] = `SWC-${issue['swc-id']}`;
            break;
        }
        for (const field of fields) {
            const esField = myth2EslintField[field];
            const value = issue[field];
            if (field === 'address' && value !== undefined ) {
                esIssue.address = value;
                try {
                    const [startLineCol, endLineCol] = this.byteOffset2lineColumn(value);
                    esIssue.line = startLineCol.line;
                    esIssue.column = startLineCol.column;
                    esIssue.endLine = endLineCol.line;
                    esIssue.endCol = endLineCol.column;
                    esIssue.markedText = this.sourceLocation2markedLine(startLineCol, endLineCol);
                } catch (err) {
                    esIssue.line = '';
                    esIssue.column = 0;
                }
            } else if (esField === 'severity' && value !== undefined) {
                esIssue[esField] = myth2Severity[value];
                esIssue.type = value;
            } else if (esField === 'title' && value !== undefined) {
                esIssue[esField] = value;
            } else if (esField === 'tool' && value !== undefined) {
                esIssue[esField] = value;
            } else if (esField === 'message' && value !== undefined) {
                esIssue[esField] = massageMessage(value);
            } else if (esField === 'lineNumberStart') {
                esIssue.line = issue.lineNumberStart;
                esIssue.column = 0;
            } else if (field === 'line' && value !== undefined) {
                esIssue[field] = massageMessage(value);
                esIssue.column = 0;
                esIssue.line = issue.line;
            }
        }

        esIssue.ruleId = `${issue['swc-id']}`;

        // Alternatives:
        // switch (options.style) {
        // case 'tap':
        //     esIssue.ruleId = `${SWC_PREFIX}/${issue['swc-id']}`;
        //     break;
        // default:
        //     esIssue.ruleId = `${issue['swc-id']}`;
        //     break;
        // }
        // if (issue['swc-id'] !== undefined) {
        //     esIssue.ruleId = `${issue.tool}/${issue['swc-id']}`;
        // } else {
        //     esIssue.ruleId = `${issue.tool}`;
        // }
        esIssue.fatal = false; // Mythx doesn't give fatal messages?
        return esIssue;
    }
}

/* FIXME: since I don't know how to export Info as a class we have
   this function which does everything and creates the an instance
   object internally. This may or may not be what we want to do in the
   future.
*/
// Turn Mythx Issues, into eslint-format issues.
export function issues2Eslint(issues: any, buildObj: any, options: any): any {
    const esIssues = [];
    const info = new Info(issues, buildObj);
    for (const issue of issues) {
        if (!info.isIgnorable(issue, options)) {
            esIssues.push(info.issue2EsLint(issue, buildObj.sourcePath));
        }
    }
    return esIssues;
}

// Take truffle's build/contracts/xxx.json JSON and make it
// compatible with the Mythx Platform API
const truffle2MythXJSON = function(truffleJSON: any, toolId = 'truffle-analyze'): any {
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
        toolId,
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
