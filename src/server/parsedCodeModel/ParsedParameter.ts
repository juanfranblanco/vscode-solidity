import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedVariable } from './ParsedVariable';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';




export class ParsedParameter extends ParsedVariable {

    public static extractParameters(params: any): ParsedParameter[] {
        const parameters: ParsedParameter[] = [];
        if (typeof params !== 'undefined' && params !== null) {
            if (params.hasOwnProperty('params')) {
                params = params.params;
            }
            params.forEach(parameterElement => {
                const parameter: ParsedParameter = new ParsedParameter();
                const type = ParsedDeclarationType.create(parameterElement.literal);
                parameter.element = parameterElement;
                parameter.type = type;
                if (typeof parameterElement.id !== 'undefined' && parameterElement.id !== null) { // no name on return parameters
                    parameter.name = parameterElement.id;
                } parameters.push(parameter);

            });
        }
        return parameters;
    }

    public static createParamsInfo(params: any): string {
        let paramsInfo = '';
        if (typeof params !== 'undefined' && params !== null) {
            if (params.hasOwnProperty('params')) {
                params = params.params;
            }
            params.forEach( parameterElement => {
               const typeString = ParsedCodeTypeHelper.getTypeString(parameterElement.literal);
                let currentParamInfo = '';
                if (typeof parameterElement.id !== 'undefined' && parameterElement.id !== null ) { // no name on return parameters
                    currentParamInfo = typeString + ' ' + parameterElement.id;
                } else {
                    currentParamInfo = typeString;
                }
                if (paramsInfo === '') {
                    paramsInfo = currentParamInfo;
                } else {
                    paramsInfo = paramsInfo + ', ' + currentParamInfo;
                }
            });
        }
        return paramsInfo;
    }

    public static createFunctionParamsSnippet(params: any, skipFirst = false): string {
        let paramsSnippet = '';
        let counter = 0;
        if (typeof params !== 'undefined' && params !== null) {
            params.forEach( parameterElement => {
               if (skipFirst && counter === 0) {
                  skipFirst = false;
               } else {
                const typeString = ParsedCodeTypeHelper.getTypeString(parameterElement.literal);
                counter = counter + 1;
                const currentParamSnippet = '${' + counter + ':' + parameterElement.id + '}';
                    if (paramsSnippet === '') {
                        paramsSnippet = currentParamSnippet;
                    } else {
                        paramsSnippet = paramsSnippet + ', ' + currentParamSnippet;
                    }
                }
            });
        }
        return paramsSnippet;
    }

    public createCompletionItem(type: string, contractName: string): CompletionItem {
        let id = '[parameter name not set]';
        if (this.element.id !== null) {
            id = this.element.id;
        }
        const completionItem =  CompletionItem.create(id);
        completionItem.kind = CompletionItemKind.Variable;
        const typeString = ParsedCodeTypeHelper.getTypeString(this.element.literal);
        completionItem.detail = '(' + type + ' in ' + contractName + ') '
                                            + typeString + ' ' + id;
        return completionItem;
    }
}
