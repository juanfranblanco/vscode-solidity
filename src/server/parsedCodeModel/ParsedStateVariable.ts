import { CompletionItem, CompletionItemKind, DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { ParsedContract } from './parsedContract';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedVariable } from './ParsedVariable';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';


export class ParsedStateVariable extends ParsedVariable {
    private completionItem: CompletionItem = null;

    public initialise(element: any, document: ParsedDocument, contract: ParsedContract) {
        super.initialise(element, document, contract);
        this.name = element.name;
        this.type = ParsedDeclarationType.create(element.literal, contract, document);
    }

    public createCompletionItem(): CompletionItem {
        if (this.completionItem === null) {
            const completionItem =  CompletionItem.create(this.name);
            completionItem.kind = CompletionItemKind.Field;
            completionItem.documentation = this.getMarkupInfo();
            this.completionItem = completionItem;
        }
         return this.completionItem;
    }

     public toDocumentSymbolType(): DocumentSymbol {
        const name = this.name || 'Unnamed';
                   const range = this.getRange();
                   const symbol = DocumentSymbol.create(
                       name,
                       this.type.getSimpleInfo(),
                       SymbolKind.Variable,
                       range,
                       range,
                   );
                   return symbol;
               }

    public override getParsedObjectType(): string {
        return 'State Variable';
    }

    public override getInfo(): string {
        return    '### ' + this.getParsedObjectType()  + ': ' +  this.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  this.getComment() + '\n' +
                  '### Type Info: \n' +
                  this.type.getInfo() + '\n';
    }
}


