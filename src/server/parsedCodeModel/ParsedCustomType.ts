import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedDocument } from './ParsedDocument';
import { ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';

export class ParsedCustomType extends ParsedCode {
    public isType: string;
    private completionItem: CompletionItem = null;

    public override initialise(element: any,  document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
        super.initialise(element, document, contract, isGlobal);
        this.element = element;
        this.isType = element.isType;
    }


    public override createCompletionItem(): CompletionItem {
        if (this.completionItem === null) {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        let contractName = '';
        if (!this.isGlobal) {
            contractName = this.contract.name;
        } else {
            contractName = this.document.getGlobalPathInfo();
        }
        const typeString = this.isType;
        completionItem.insertText = this.name;
        completionItem.documentation = this.getMarkupInfo();
        this.completionItem = completionItem;
        }
        return this.completionItem;
    }


    public override getParsedObjectType(): string {
        return 'Custom Type';
    }

    public override getInfo(): string {
        return    '### ' + this.getParsedObjectType()  + ': ' +  this.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  '### Type Info: \n' +
                  this.isType + '\n';
    }

}


