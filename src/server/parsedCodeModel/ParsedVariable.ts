import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';

export class ParsedVariable extends ParsedCode {
    public type: ParsedDeclarationType;

}
