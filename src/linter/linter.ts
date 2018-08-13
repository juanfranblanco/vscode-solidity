import * as vscode from 'vscode-languageserver';

export default interface Linter {
    setIdeRules(rules: any);
    validate(filePath: string, documentText: string): vscode.Diagnostic[];
}
