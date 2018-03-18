import SoliumService from './solium';
import * as vscode from 'vscode';

export function lintAndfixCurrentDocument() {
    let linterType = vscode.workspace.getConfiguration('solidity').get<string>('linter');
    if (linterType === 'solium') {
        const soliumRules = vscode.workspace.getConfiguration('solidity').get<string>('soliumRules');
        const linter = new SoliumService(soliumRules, null);
        let editor = vscode.window.activeTextEditor;
        let sourceCode =  editor.document.getText();
        const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(sourceCode.length),
        );

        const result = linter.lintAndFix(sourceCode);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, fullRange, result.fixedSourceCode);
        return vscode.workspace.applyEdit(edit);
    }
}
