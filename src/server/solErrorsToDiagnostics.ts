'use strict';
import { DiagnosticSeverity } from 'vscode-languageserver';

export interface CompilerError {
    diagnostic: any;
    fileName: string;
}

    export function getDiagnosticSeverity(severity: string): DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return DiagnosticSeverity.Error;
            case 'warning':
                return DiagnosticSeverity.Warning;
            case 'info':
                return DiagnosticSeverity.Information;
            default:
                return DiagnosticSeverity.Error;
        }
    }

    export function errorToDiagnostic(error: any): CompilerError {

        if(error.sourceLocation.file !== undefined || error.sourceLocation.file !== null) {
            let fileName = error.sourceLocation.file;
            
            const errorMessage = error.message;
            const severity = this.getDiagnosticSeverity(error.severity);
            const errorSplit = error.formattedMessage.substr(error.formattedMessage.indexOf(fileName)).split(':');
            let index = 1;
             // a full path in windows includes a : for the drive
             if (process.platform === 'win32') {
                index = 2;
            }

            // tslint:disable-next-line:radix
            const line = parseInt(errorSplit[index]);
            // tslint:disable-next-line:radix
            const column = parseInt(errorSplit[index + 1]);
            return {
                diagnostic: {
                    message: errorMessage,
                    range: {
                        end: {
                            character: column + error.sourceLocation.end - error.sourceLocation.start - 1,
                            line: line - 1,
                        },
                        start: {
                            character: column - 1,
                            line: line - 1,
                        },
                    },
                    severity: severity,
                },
                fileName: fileName,
            };

        } else {

            const errorSplit = error.formattedMessage.split(':');
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
            const severity = this.getDiagnosticSeverity(error.severity);
            const errorMessage = error.message;
            return {
                diagnostic: {
                    message: errorMessage,
                    range: {
                        end: {
                            character: column + error.sourceLocation.end - error.sourceLocation.start - 1,
                            line: line - 1,
                        },
                        start: {
                            character: column - 1,
                            line: line - 1,
                        },
                    },
                    severity: severity,
                },
                fileName: fileName,
            };

        }
    }
