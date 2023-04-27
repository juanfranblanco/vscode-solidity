import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedContract } from './parsedContract';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedVariable } from './ParsedVariable';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';




export class ParsedStateVariable extends ParsedVariable {
    public contract: ParsedContract;
    public initialise(element: any, contract: ParsedContract, document: ParsedDocument) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.type = ParsedDeclarationType.create(element.literal, contract, document);
    }

    public createCompletionItem(): CompletionItem {

        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
        completionItem.detail = '(State variable in ' + this.contract.name + ') '
                                            + typeString + ' ' + this.contract.name;
        return completionItem;
    }
}


