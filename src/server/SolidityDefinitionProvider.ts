import * as vscode from 'vscode-languageserver';
import { CodeWalkerService } from './parsedCodeModel/codeWalkerService';



export class SolidityDefinitionProvider {

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): Thenable<vscode.Location | vscode.Location[]> {

    const offset = document.offsetAt(position);
    const documentContractSelected = walker.getSelectedDocument(document, position);
    const references = documentContractSelected.getSelectedTypeReferenceLocation(offset);
    const foundLocations = references.filter(x => x.location !== null).map(x => x.location);
    const keys = ['range', 'uri'];
    const result = this.removeDuplicates(foundLocations, keys);

    return Promise.resolve(<vscode.Location[]>result);
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
