import { CompletionItem, CompletionItemKind, DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { ParsedFunction } from './ParsedFunction';
import { ParsedVariable } from './ParsedVariable';
import { FindTypeReferenceLocationResult } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';
import { ParsedParameter } from './ParsedParameter';


export class ParsedFunctionVariable extends ParsedVariable {
    public function: ParsedFunction;
    private completionItem: CompletionItem = null;

    public override createCompletionItem(): CompletionItem {

        if (this.completionItem === null) {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        let name = '';
        if (this.function.isGlobal) {
            name = this.document.getGlobalPathInfo();
        } else {
            name = this.function.contract.name;
        }
        const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
        completionItem.detail = '(Function variable in ' + this.function.name + ') '
                                            + typeString + ' ' + name;
            this.completionItem = completionItem;
        }
        return this.completionItem;
    }

    public override getAllReferencesToThis(): FindTypeReferenceLocationResult[] {
        const results: FindTypeReferenceLocationResult[] = [];
        results.push(this.createFoundReferenceLocationResult());
        return results.concat(this.function.getAllReferencesToObject(this));
    }

    public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            if (this.type.isCurrentElementedSelected(offset)) {
                 return this.type.getAllReferencesToSelected(offset, documents);
            } else {
                 return this.getAllReferencesToThis();
            }
        }
        return [];
    }

    public override getParsedObjectType(): string {
        return 'Function Variable';
    }

    public override getInfo(): string {
        return    '### ' + this.getParsedObjectType()  + ': ' +  this.name + '\n' +
                  '#### ' + this.function.getParsedObjectType() + ': ' + this.function.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  '### Type Info: \n' +
                  this.type.getInfo() + '\n';
    }

    public getSignature(): string {
        return ParsedParameter.getParamInfo(this.element);
    }

    public toDocumentSymbolType(): DocumentSymbol {
        const name = this.name || 'Unnamed';
        const varRange = this.getRange();
        return DocumentSymbol.create(
          name,
          `Variable: ${this.type.getSimpleInfo()}`,
          SymbolKind.Variable,
          varRange,
          varRange,
        );
    }
}

