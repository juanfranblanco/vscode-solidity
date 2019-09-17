import * as vscode from 'vscode';

export function errorCodeDiagnostic(document: vscode.TextDocument, collection: vscode.DiagnosticCollection, analysisResult: Array<any>): void {
    const diagnostics: vscode.Diagnostic[] = [];
    analysisResult.map(
        (entry) => {
            entry.issues
                .map(
                    issue => {
                        const position = {
                            start: {
                                line: 0,
                                column: 0,
                            },
                            end: {
                                line: 0,
                                column: 0,
                            },
                        };

                        // TODO: all the below should be better extracted
                        if (issue.decodedLocations) {
                            const decodedLocationsFiltered = issue.decodedLocations.filter(
                                decodedLocation => decodedLocation.length > 0);
                            decodedLocationsFiltered.map(
                                locations => {
                                    // vscode diagnostics starts from 0
                                    position.start.line = locations[0].line - 1;
                                    position.start.column = locations[0].column;
                                    position.end.line = locations[1].line - 1;
                                    position.end.column = locations[1].column;
                                    const message = `MythX ${issue.swcID}. ${issue.description.head}`;
                                    const range = new vscode.Range(new vscode.Position(position.start.line, position.start.column), new vscode.Position(position.end.line, position.end.column));
                                    const severity = issue.severity.toLowerCase() === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
                                    const diagnostic = new vscode.Diagnostic(range, message, severity);
                                    diagnostics.push(diagnostic);
                                },
                            );
                        }
                    },
                );
        },
    );
    collection.set(document.uri, diagnostics);
}
