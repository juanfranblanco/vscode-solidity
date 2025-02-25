import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';
import { SolidityReferencesProvider } from './SolidityReferencesProvider';

export class SolidityRenameProvider {
    public provideRenameEdits(
        document: TextDocument,
        position: vscode.Position,
        newName: string,
        walker: CodeWalkerService,
        connect: any
    ): vscode.WorkspaceEdit | undefined {
        const referenceProvider = new SolidityReferencesProvider();
        const references = referenceProvider.provideReferences(document, position, walker);
        
    
        if (!references || references.length === 0) {
            return undefined;
        }
    
        // Remove duplicates using a custom function
        const uniqueReferences = this.deduplicateReferences(references);
    
        const workspaceEdit: vscode.WorkspaceEdit = { changes: {} };
    
        for (const reference of uniqueReferences) {
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
    
    /**
     * Removes duplicate references based on URI and range values
     */
    private deduplicateReferences(references: vscode.Location[]): vscode.Location[] {
        const uniqueMap = new Map<string, vscode.Location>();
        
        for (const reference of references) {
            const key = `${reference.uri}|${reference.range.start.line}|${reference.range.start.character}|${reference.range.end.line}|${reference.range.end.character}`;
            
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, reference);
            }
        }
        return Array.from(uniqueMap.values());
    }
}