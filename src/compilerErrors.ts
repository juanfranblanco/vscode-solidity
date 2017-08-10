
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

function getDiagnosticSeverity(severity: string): DiagnosticSeverity {
    switch (severity) {
        case ' Error':
            return DiagnosticSeverity.Error;
        case ' Warning':
            return DiagnosticSeverity.Warning;
        default:
            return DiagnosticSeverity.Error;
    }
}

interface CompilerError {
    diagnostic: any;
    fileName: string;
}

export function errorToDiagnostic(error: any): CompilerError {
    let errorSplit = error.split(':');
    let fileName = errorSplit[0];
    let index = 1;

    // a full path in windows includes a : for the drive
    if (process.platform === 'win32') {
        fileName = errorSplit[0] + ':' + errorSplit[1];
        index = 2;
    }

    let line = parseInt(errorSplit[index]);
    let column = parseInt(errorSplit[index + 1]);
    let severity = getDiagnosticSeverity(errorSplit[index + 2]);
 
    return {
        diagnostic: {
            message: error,
            range: {
                end: {
                    character: column,
                    line: line - 1,
                },
                start: {
                    character: column,
                    line: line - 1,
                },
            },
            severity: severity,
        },
        fileName: fileName,
    };
}
