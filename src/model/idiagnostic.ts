import { Range, DiagnosticSeverity } from 'vscode-languageserver/lib/main';

export interface IDiagnostic {
    message: string;
    range: Range;
    severity: DiagnosticSeverity;
}
