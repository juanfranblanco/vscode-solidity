import { ParsedContract } from './parsedContract';
import { ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedStructVariable } from './ParsedStructVariable';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

export class ParsedStruct extends ParsedCode {
    public variables: ParsedStructVariable[] = [];
    public contract: ParsedContract;
    public isGlobal: boolean;

    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal;

        if (this.element.body !== 'undefined') {
            this.element.body.forEach(structBodyElement => {
                if (structBodyElement.type === 'DeclarativeExpression') {
                    const variable = new ParsedStructVariable();
                    variable.element = structBodyElement;
                    variable.name = structBodyElement.name;
                    variable.type = ParsedDeclarationType.create(structBodyElement.literal);
                    variable.struct = this;
                    this.variables.push(variable);
                }
            });
        }
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
        completionItem.detail = '(Struct in ' + contractName + ') '
                                            + this.name;
        return completionItem;
    }

    public getDotCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.variables.forEach(x =>  completionItems.push(x.createCompletionItem()));
        return completionItems;
    }
}
