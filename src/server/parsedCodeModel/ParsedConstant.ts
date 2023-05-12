import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedVariable } from './ParsedVariable';


export class ParsedConstant extends ParsedVariable {
    public from: string;
    private completionItem: CompletionItem = null;
    public override initialise(element: any, document: ParsedDocument) {
        super.initialise(element, document);
        this.name = element.name;
        this.type = ParsedDeclarationType.create(element.literal, null, document);
    }

    public override createCompletionItem(): CompletionItem {
        if (this.completionItem === null) {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        const info = this.document.getGlobalPathInfo();
        completionItem.insertText = this.name;
        completionItem.detail = '(Constant in ' + info + ') '
                                            + this.name + ' ' + this.type.name;
        this.completionItem = completionItem;
        }
        return this.completionItem;
    }
}
