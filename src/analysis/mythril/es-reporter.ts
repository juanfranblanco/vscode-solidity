// An eslint Reporter class. Objects of the Reporter class need
// to have the methods listed below...

/* FIXME: since I don't know how to export Info as a class we have
   this function which does everything and creates the an instance
   object internally. This may or may not be what we want to do in the
   future.
*/

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
