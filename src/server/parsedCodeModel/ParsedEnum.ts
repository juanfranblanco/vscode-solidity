import { ParsedContract } from './parsedContract';
import { ParsedCode } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';




export class ParsedEnum extends ParsedCode {
    public items: string[] = [];
    public contract: ParsedContract;
    public isGlobal: boolean;
    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal;
        element.members.forEach(member => { this.items.push(member); });
    }

    public createCompletionItem(): CompletionItem {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Enum;
        let contractName = '';
        if (!this.isGlobal) {
            contractName = this.contract.name;
        } else {
            contractName = this.document.getGlobalPathInfo();
        }
        completionItem.insertText = this.name;
        completionItem.detail = '(Enum in ' + contractName + ') '
                                            + this.name;
        return completionItem;
    }

    public getDotCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.items.forEach(property =>  completionItems.push(CompletionItem.create(property)));
        return completionItems;
    }
}

