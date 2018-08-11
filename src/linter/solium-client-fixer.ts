import SoliumService from './solium';
import { workspace, window, Range, WorkspaceEdit } from 'vscode';

export function lintAndfixCurrentDocument(): Thenable<boolean> {
    const linterType = workspace.getConfiguration('solidity').get<string>('linter');
    if (linterType === 'solium') {
        const soliumRules = workspace.getConfiguration('solidity').get<string>('soliumRules');
        const linter = new SoliumService(soliumRules, null);
        const editor = window.activeTextEditor;
        const sourceCode = editor.document.getText();
        const fullRange = new Range(
            editor.document.positionAt(0),
            editor.document.positionAt(sourceCode.length),
        );
        const result = linter.lintAndFix(sourceCode);
        const edit = new WorkspaceEdit();
        edit.replace(editor.document.uri, fullRange, result.fixedSourceCode);

        return workspace.applyEdit(edit);
    }
}
