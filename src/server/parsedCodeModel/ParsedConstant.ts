import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { ParsedVariable } from './ParsedVariable';
import { ParsedParameter } from './ParsedParameter';


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
        completionItem.documentation = this.getMarkupInfo();
        this.completionItem = completionItem;
        }
        return this.completionItem;
    }


    public override getParsedObjectType(): string {
        return 'Constant';
    }

    public override getInfo(): string {
        return    '### ' + this.getParsedObjectType()  + ': ' +  this.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  '\t' +  this.getSignature() + ' \n\n' +
                  '### Type Info: \n' +
                  this.type.getInfo() + '\n';
    }

    public getSignature(): string {
        return ParsedParameter.getParamInfo(this.element);
    }
}
