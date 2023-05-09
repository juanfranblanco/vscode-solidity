import { CompletionItem, CompletionItemKind, Location } from 'vscode-languageserver';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';

export class ParsedVariable extends ParsedCode {
    public type: ParsedDeclarationType;

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
          if (this.isCurrentElementedSelected(offset)) {
                const foundType = this.type.findType();
                if (foundType !== undefined) {
                    return [FindTypeReferenceLocationResult.create(true, foundType.getLocation())];
                } else {
                    return [FindTypeReferenceLocationResult.create(true)];
                }
          }
          return [FindTypeReferenceLocationResult.create(false)];
    }

    public override getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        } else {
            return this.type.getAllReferencesToObject(parsedCode);
        }
    }

}
