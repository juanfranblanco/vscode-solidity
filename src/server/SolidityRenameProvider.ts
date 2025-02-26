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
    ): vscode.WorkspaceEdit | undefined {
        const referenceProvider = new SolidityReferencesProvider();
        const references = referenceProvider.provideReferences(document, position, walker);

        if (!references || references.length === 0) {
            return undefined;
        }

        const uniqueReferences = this.deduplicateReferences(references);

        const preciseReferences = uniqueReferences.map(ref =>
            this.getPreciseIdentifierLocation(document, ref)
        );

        const workspaceEdit: vscode.WorkspaceEdit = { changes: {} };

        for (const reference of preciseReferences) {
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

    private getPreciseIdentifierLocation(document: TextDocument, location: vscode.Location): vscode.Location {
        const range = location.range;
        const text = document.getText(range);

        // exact match refex
        const match = text.match(/(?:\w+\s+)+(\w+)(?:\s*;|\s*=|\s*\()/);

        if (match && match.index !== undefined && match[1]) {
            const identifierStart = match.index + match[0].indexOf(match[1]);
            const identifierLength = match[1].length;

            // Calculate the new range that contains only the identifier
            const startPos = document.positionAt(document.offsetAt(range.start) + identifierStart);
            const endPos = document.positionAt(document.offsetAt(range.start) + identifierStart + identifierLength);

            return {
                uri: location.uri,
                range: {
                    start: startPos,
                    end: endPos
                }
            };
        }

        return location;
    }

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
