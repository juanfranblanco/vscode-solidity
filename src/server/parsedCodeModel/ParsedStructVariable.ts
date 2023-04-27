import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { ParsedStruct } from './ParsedStruct';
import { ParsedVariable } from './ParsedVariable';


export class ParsedStructVariable extends ParsedVariable {
    public struct: ParsedStruct;

    public createCompletionItem(): CompletionItem {
        const completitionItem = CompletionItem.create(this.name);
        const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
        completitionItem.detail = '(' + this.name + ' in ' + this.struct.name + ') '
            + typeString + ' ' + this.struct.name;
        return completitionItem;
    }
}
