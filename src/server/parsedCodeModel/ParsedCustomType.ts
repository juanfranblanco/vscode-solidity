import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedDocument } from './ParsedDocument';
import { ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';

export class ParsedCustomType extends ParsedCode {
    public isType: string;
    public isGlobal: boolean;
    public contract: ParsedContract;

    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal;
        this.isType = element.isType;
    }


    public createCompletionItem(): CompletionItem {
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
        completionItem.detail = '(' + this.name + ' in ' + contractName + ') '
                                            + this.isType + ' ' + this.name;
        return completionItem;
    }
}


