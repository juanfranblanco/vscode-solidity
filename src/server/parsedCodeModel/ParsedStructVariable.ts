import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { ParsedStruct } from './ParsedStruct';
import { ParsedVariable } from './ParsedVariable';
import { ParsedContract } from './parsedContract';
import { ParsedDocument } from './ParsedDocument';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { FindTypeReferenceLocationResult } from './parsedCode';


export class ParsedStructVariable extends ParsedVariable {
    public struct: ParsedStruct;
    private completionItem: CompletionItem = null;

    public initialiseStructVariable(element: any, contract: ParsedContract, document: ParsedDocument, struct: ParsedStruct ) {
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.type = ParsedDeclarationType.create(element.literal, contract, document);
        this.struct = struct;
    }
    public createCompletionItem(): CompletionItem {
        if (this.completionItem === null) {
            const completitionItem = CompletionItem.create(this.name);
            const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
            completitionItem.detail = '(' + this.name + ' in ' + this.struct.name + ') '
                + typeString + ' ' + this.struct.name;
            this.completionItem = completitionItem;
        }
        return this.completionItem;
    }
}
