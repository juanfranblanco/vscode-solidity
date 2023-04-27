import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedVariable } from './ParsedVariable';


export class ParsedConstant extends ParsedVariable {
    public from: string;
    public initialise(element: any, document: ParsedDocument) {
        this.document = document;
        this.element = element;
        this.name = element.name;
        this.type = ParsedDeclarationType.create(element.literal, null, document);
    }

    public createCompletionItem(): CompletionItem {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        const info = this.document.getGlobalPathInfo();
        completionItem.insertText = this.name;
        completionItem.detail = '(Constant in ' + info + ') '
                                            + this.name + ' ' + this.type.name;
        return completionItem;
    }
}
