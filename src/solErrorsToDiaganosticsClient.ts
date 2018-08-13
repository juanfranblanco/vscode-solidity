import * as vscode from 'vscode';
import { errorToDiagnostic } from './solErrorsToDiagnostics';
import * as vscodeserver from 'vscode-languageserver';

interface ErrorWarningCounts {
    errors: number;
    warnings: number;
}

export function errorsToDiagnostics(diagnosticCollection: vscode.DiagnosticCollection, errors: any): ErrorWarningCounts {
        let errorWarningCounts: ErrorWarningCounts = {errors: 0, warnings: 0};
        let diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

        errors.forEach(error => {
            let {diagnostic, fileName} = errorToDiagnostic(error);

            let targetUri = vscode.Uri.file(fileName);
            let diagnostics = diagnosticMap.get(targetUri);

            if (!diagnostics) {
                diagnostics = [];
            }

            diagnostics.push(diagnostic);
            diagnosticMap.set(targetUri, diagnostics);
        });

        let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];

        diagnosticMap.forEach((diags, uri) => {
            errorWarningCounts.errors += diags.filter((diagnostic) => diagnostic.severity === vscodeserver.DiagnosticSeverity.Error).length;
            errorWarningCounts.warnings += diags.filter((diagnostic) => diagnostic.severity === vscodeserver.DiagnosticSeverity.Warning).length;

            entries.push([uri, diags]);
        });

        diagnosticCollection.set(entries);

        return errorWarningCounts;
    }
