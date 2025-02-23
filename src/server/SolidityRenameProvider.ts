import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';
import { SolidityReferencesProvider } from './SolidityReferencesProvider';

export class SolidityRenameProvider {
    public provideRenameEdits(
        document: TextDocument,
        position: vscode.Position,
        newName: string,
        walker: CodeWalkerService
    ): vscode.WorkspaceEdit | undefined {
        const referenceProvider = new SolidityReferencesProvider();
        const references = referenceProvider.provideReferences(document, position, walker);

        if (!references || references.length === 0) {
            return undefined;
        }

        const workspaceEdit: vscode.WorkspaceEdit = { changes: {} };

        for (const reference of references) {
            const uri = reference.uri; 
            const range = reference.range; 

            const textEdit: vscode.TextEdit = {
                range: range,
                newText: newName,
            };

            if (!workspaceEdit.changes![uri]) {
                workspaceEdit.changes![uri] = [];
            }
            workspaceEdit.changes![uri].push(textEdit);
        }

        return workspaceEdit;
    }
}