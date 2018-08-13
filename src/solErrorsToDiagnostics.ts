import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';

export interface CompilerError {
    diagnostic: any;
    fileName: string;
}

    export function getDiagnosticSeverity(severity: string): DiagnosticSeverity {
        switch (severity) {
            case ' Error':
                return DiagnosticSeverity.Error;
            case ' Warning':
                return DiagnosticSeverity.Warning;
            default:
                return DiagnosticSeverity.Error;
        }
    }

    export function errorToDiagnostic(error: any): CompilerError {
        const errorSplit = error.split(':');
        let fileName = errorSplit[0];
        let index = 1;

        // a full path in windows includes a : for the drive
        if (process.platform === 'win32') {
            fileName = errorSplit[0] + ':' + errorSplit[1];
            index = 2;
        }

        // tslint:disable-next-line:radix
        const line = parseInt(errorSplit[index]);
        // tslint:disable-next-line:radix
        const column = parseInt(errorSplit[index + 1]);
        const severity = this.getDiagnosticSeverity(errorSplit[index + 2]);
        const errorMessage = errorSplit[index + 3];
        return {
            diagnostic: {
                message: errorMessage,
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
