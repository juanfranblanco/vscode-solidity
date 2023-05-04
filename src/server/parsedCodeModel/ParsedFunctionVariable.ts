import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { ParsedFunction } from './ParsedFunction';
import { ParsedVariable } from './ParsedVariable';


export class ParsedFunctionVariable extends ParsedVariable {
    public function: ParsedFunction;

    public override createCompletionItem(): CompletionItem {

        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Field;
        let name = '';
        if (this.function.isGlobal) {
            name = this.document.getGlobalPathInfo();
        } else {
            name = this.function.contract.name;
        }
        const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
        completionItem.detail = '(Function variable in ' + this.function.name + ') '
                                            + typeString + ' ' + name;
        return completionItem;
    }
}
