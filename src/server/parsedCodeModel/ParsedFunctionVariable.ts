import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { ParsedFunction } from './ParsedFunction';
import { ParsedVariable } from './ParsedVariable';


export class ParsedFunctionVariable extends ParsedVariable {
    public function: ParsedFunction;

    public createCompletionItem(): CompletionItem {

        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
        completionItem.detail = '(Function variable in ' + this.function.name + ') '
                                            + typeString + ' ' + this.function.contract.name;
        return completionItem;
    }
}
