import * as smd from './sourceMappingDecoder';
import * as srcmap from './srcmap';
import * as vscode from 'vscode';

const warnFn = vscode.window.showWarningMessage;

// const SWC_PREFIX =
//       "https://smartcontractsecurity.github.io/SWC-registry/docs";

/********************************************************
Mythril messages currently needs a bit of messaging to
be able to work within the Eslint framework. Some things
we handle here:

- long messages
  Chop at sentence boundary.
- Non-ASCII characters: /[\u0001-\u001A]/ (including \n and `)
  Remove them.
**********************************************************/
function massageMessage(mess: string): string {
    // Mythril messages are long. Strip after first period.
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
  Mythril seems to downplay severity. What eslint calls an "error",
  Mythril calls "warning". And what eslint calls "warning",
  Mythril calls "informational".
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
                warnFn('**debug: Ignoring Mythril issue around ' +
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

    but a Mythril JSON report has these fields:
    address, type, description, contract, function,

    Convert a Mythril issue into an ESLint-style issue.
  */
    public issue2EsLint(issue: any, path: string) {
        const esIssue = {
            'address': null,
            'column': -1,
            'endCol': -1,
            'endLine': -1,
            'fatal': false,
            'line': '',
            'markedText': '',
            'path': path,
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
        case 'mythril':
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
        esIssue.fatal = false; // Mythril doesn't give fatal messages?
        return esIssue;
    }
}

/* FIXME: since I don't know how to export Info as a class we have
   this function which does everything and creates the an instance
   object internally. This may or may not be what we want to do in the
   future.
*/
// Turn Mythril Issues, into eslint-format issues.
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
// compatible with the Mythril Platform API
export function truffle2MythrilJSON(truffleJSON: any) {

    // Add/remap some fields because the Mythril Platform API doesn't
    // align with truffle's JSON

    truffleJSON.sourceList = [truffleJSON.ast.absolutePath];
    truffleJSON.sources = {};
    truffleJSON.sources[truffleJSON.contractName] = truffleJSON.source;

    return truffleJSON;
}
