import * as vscode from 'vscode-languageserver';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';

export class SolidityDocumentSymbolProvider {
  /**
   * Provides DocumentSymbols for the given document.
   */
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    walker: CodeWalkerService
  ): vscode.DocumentSymbol[] | undefined {
    // Always use position (0, 0) for reusability
    const startOfDocument = vscode.Position.create(0, 0);
    const selectedDocument = walker.getSelectedDocument(document, startOfDocument);
    if (selectedDocument) {
      const documentSymbol = selectedDocument.toDocumentSymbol();
      return documentSymbol?.children || [];
    }

    return undefined;
  }

}
