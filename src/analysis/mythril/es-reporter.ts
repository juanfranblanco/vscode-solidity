// An eslint Reporter class. Objects of the Reporter class need
// to have the methods listed below...

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
    if (sentMatch !== null) {
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
    address: 'addr2lineColumn', // Not used
    description: 'message',
    line: 'lineNumberStart',
    'swc-description': 'message',
    type: 'severity',
};


// FIXME figure out how to export this class.
class Info {
    private issues: Array<any>;
    constructor(issues: Array<any>) {
        this.issues = issues;
    }

    /*
    The eslint report format which we use, has these fields:
    line, column, severity, message, ruleId, fatal

    but a Mythril JSON report has these fields:
    address, type, description, contract, function,

    Convert a Mythril issue into an ESLint-style issue
    */
    public issue2EsLint(issue: any) {
        const esIssue = {
            column: -1,
            endCol: -1,
            endLine: -1,
            fatal: false,
            line: -1,
            message: '',
            ruleId: '',
            severity: myth2Severity.Warning,
        };

        let fields = ['type', 'address', 'description'];
        switch (issue.tool) {
        case 'maru':
            fields = ['type', 'line', 'swc-description'];
            break;
        case 'mythril':
            issue['swc-id'] = `SWC-${issue['swc-id']}`;
            break;
        }
        for (const field of fields) {
            const esField = myth2EslintField[field];
            const value = issue[field];
            if (field === 'address' && value !== undefined ) {
                try {
                    esIssue.line = -1;
                    esIssue.column = 0;
                    /****
                    let [startLineCol, endLineCol] = this.byteOffset2lineColumn(value);
                    esIssue.line = startLineCol.line;
                    esIssue.column = startLineCol.column;
		            esIssue.endLine = endLineCol.line;
		            esIssue.endCol = endLineCol.column;
                    ****/
                } catch (err) {
                    esIssue.line = -1;
                    esIssue.column = 0;
                }
            } else if (esField === 'severity' && value !== undefined) {
                esIssue[esField] = myth2Severity[value];
            } else if (esField === 'message' && value !== undefined) {
                esIssue[esField] = massageMessage(value);
            } else if (esField === 'lineNumberStart') {
                esIssue.line = issue.lineNumberStart;
                esIssue.column = 0;
            } else if (field === 'line' && value !== undefined) {
                esIssue.message = massageMessage(value);
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
export function issues2Eslint(issues, options) {
    const esIssues = [];
    const info = new Info(issues);
    for (const issue of issues) {
        esIssues.push(info.issue2EsLint(issue));
    }
    return esIssues;
}

enum SEVERITY {
    ERROR = 2,
    WARN = 3,
}

class Reporter {

    private reports: any;
    private rootPath: string;
    constructor(reports, rootPath) {
        this.reports = reports;
        this.rootPath = rootPath;
    }

    get errorCount() {
        return this._countReportsWith(SEVERITY.ERROR);
    }

    get warningCount() {
        return this._countReportsWith(SEVERITY.WARN);
    }

    private _countReportsWith(severity) {
        return this.reports.filter(i => i.severity === severity).length;
    }


    get messages() {
        return this.reports.sort(function(x1, x2) {
            return x1.line === x2.line ?
                (x1.column - x2.column) :
                (x1.line - x2.line);
        });
    }

    get filePath() {
        return this.rootPath;
    }
}

export function printReport(issues, rootPath, formatter, printFn) {
    if (issues.length === 0) {
        printFn('No issues found.');
        return;
    }
    const reports = new Reporter(issues, rootPath);
    printFn(formatter([reports]));
}
