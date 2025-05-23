import {
    DocumentSymbol,
    SymbolInformation,
    SymbolKind,
    Location,
    Range,
  } from 'vscode-languageserver-types';

  import { URI } from 'vscode-uri';

  export function convertDocumentSymbolsToSymbolInformation(
    symbols: DocumentSymbol[],
    uri: URI,
    containerName?: string,
  ): SymbolInformation[] {
    const result: SymbolInformation[] = [];

    for (const symbol of symbols) {
      result.push({
        name: symbol.name,
        kind: symbol.kind,
        location: Location.create(uri.toString(), symbol.selectionRange),
        containerName,
      });

      if (symbol.children && symbol.children.length > 0) {
        result.push(
          ...convertDocumentSymbolsToSymbolInformation(
            symbol.children,
            uri,
            symbol.name,
          ),
        );
      }
    }

    return result;
  }
