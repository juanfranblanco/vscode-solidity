import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';
import { convertDocumentSymbolsToSymbolInformation } from './utils/convertDocumentSymbolsToSymbolInformation';
import { SymbolInformation } from 'vscode-languageserver-types';

export class SolidityWorkspaceSymbolProvider {
  public provideWorkspaceSymbols(
    query: string,
    walker: CodeWalkerService,
  ): SymbolInformation[] {

    walker.initialiseChangedDocuments();

    const allSymbols: SymbolInformation[] = [];

    for (const parsed of walker.getParsedDocumentsCache()) {
      const uri = URI.file(parsed.sourceDocument.absolutePath);
      const documentSymbol = parsed.toDocumentSymbol();
      if (documentSymbol) {
        allSymbols.push(
          ...convertDocumentSymbolsToSymbolInformation([documentSymbol], uri),
        );
      }
    }

    return allSymbols.filter(symbol =>
      symbol.name.toLowerCase().includes(query.toLowerCase()),
    );
  }
}
