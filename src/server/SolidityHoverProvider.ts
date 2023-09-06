import * as vscode from 'vscode-languageserver';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';



export class SolidityHoverProvider {

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService ): vscode.Hover | undefined {

    const offset = document.offsetAt(position);
    const documentContractSelected = walker.getSelectedDocument(document, position);
    if (documentContractSelected !== null) {
      const item = documentContractSelected.getSelectedItem(offset);
      if (item !== null) { return item.getHover(); }
    }
    return undefined;
  }
}
