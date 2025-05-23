import * as vscode from 'vscode-languageserver';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';



export class SolidityReferencesProvider {

  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Location[] {

    const offset = document.offsetAt(position);
    walker.initialiseChangedDocuments();
    
    const documentContractSelected = walker.getSelectedDocument(document, position);
    const references = documentContractSelected.getAllReferencesToSelected(offset, [].concat(documentContractSelected, walker.parsedDocumentsCache));
    const foundLocations = references.filter(x => x != null && x.location !== null).map(x => x.location);
    return <vscode.Location[]>foundLocations;
  }

  public removeDuplicates(foundLocations: any[], keys: string[]) {
    return Object.values(foundLocations.reduce((r, o: any) => {
      const key = keys.map(k => o[k]).join('|');
      // tslint:disable-next-line:curly
      if (r[key])
        r[key].condition = [].concat(r[key].condition, o.condition);



      // tslint:disable-next-line:curly
      else
        r[key] = { ...o };
      return r;
    }, {}));
  }
}
