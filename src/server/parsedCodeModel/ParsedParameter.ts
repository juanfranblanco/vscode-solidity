import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedVariable } from './ParsedVariable';
import { ParsedCodeTypeHelper } from './ParsedCodeTypeHelper';
import { CompletionItem, CompletionItemKind, DocumentSymbol, Hover, MarkupContent, MarkupKind, SymbolKind } from 'vscode-languageserver';
import { ParsedDocument } from './ParsedDocument';
import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';


export class ParsedParameter extends ParsedVariable {
    public parent: ParsedCode;
    private completionItem: CompletionItem = null;

    public static extractParameters(params: any, contract: ParsedContract, document: ParsedDocument, parent: ParsedCode): ParsedParameter[] {
        const parameters: ParsedParameter[] = [];
        if (typeof params !== 'undefined' && params !== null) {
            if (params.hasOwnProperty('params')) {
                params = params.params;
            }
            params.forEach(parameterElement => {
                const parameter: ParsedParameter = new ParsedParameter();
                parameter.initialiseParameter(parameterElement, contract, document, parent);
                parameters.push(parameter);

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

                const currentParamInfo = ParsedParameter.getParamInfo(parameterElement);
                if (paramsInfo === '') {
                    paramsInfo = currentParamInfo;
                } else {
                    paramsInfo = paramsInfo + ',\n\t\t\t\t' + currentParamInfo;
                }
            });
        }
        return paramsInfo;
    }

    public static getParamInfo(parameterElement: any) {
        const typeString = ParsedCodeTypeHelper.getTypeString(parameterElement.literal);

        let currentParamInfo = '';
        if (typeof parameterElement.id !== 'undefined' && parameterElement.id !== null) { // no name on return parameters
            currentParamInfo = typeString + ' ' + parameterElement.id;
        } else {
            currentParamInfo = typeString;
        }
        return currentParamInfo;
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

    public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            if (this.type.isCurrentElementedSelected(offset)) {
                 return this.type.getAllReferencesToSelected(offset, documents);
            } else {
                 return this.getAllReferencesToThis(documents);
            }
        }
        return [];
    }

    public override getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        } else {
            return this.type.getAllReferencesToObject(parsedCode);
        }
    }

    public override getAllReferencesToThis(documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        const results: FindTypeReferenceLocationResult[] = [];
        results.push(this.createFoundReferenceLocationResult());
        return results.concat(this.parent.getAllReferencesToObject(this));
    }

    public initialiseParameter(element: any, contract: ParsedContract, document: ParsedDocument, parent: ParsedCode) {
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.contract = contract;
        this.parent = parent;

        const type = ParsedDeclarationType.create(element.literal, contract, document);
        this.element = element;
        this.type = type;
        if (typeof element.id !== 'undefined' && element.id !== null) { // no name on return parameters
            this.name = element.id;
        }
    }

    public createParamCompletionItem(type: string, contractName: string): CompletionItem {
        if (this.completionItem === null) {
            let id = '[parameter name not set]';
            if (this.element.id !== null) {
                id = this.element.id;
            }
            const completionItem =  CompletionItem.create(id);
            completionItem.kind = CompletionItemKind.Variable;
            completionItem.documentation = this.getMarkupInfo();
            this.completionItem = completionItem;
        }
        return this.completionItem;
    }

    public override getParsedObjectType(): string {
        return 'Parameter';
    }

    public override getInfo(): string {
        let name = 'Name not set';
        if (this.name !== undefined) {
            name = this.name;
        }
        return    '### ' + this.getParsedObjectType()  + ': ' +  name + '\n' +
                  '#### ' + this.parent.getParsedObjectType() + ': ' + this.parent.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  '### Type Info: \n' +
                  this.type.getInfo() + '\n';
    }

    public getSignature(): string {
        return ParsedParameter.getParamInfo(this.element);
    }

    public toDocumentSymbolType(parameterType: string): DocumentSymbol {
        const name = this.name || 'Unnamed';
        const paramRange = this.getRange();
        return DocumentSymbol.create(
          name,
          `${parameterType}: ${this.type.getSimpleInfo()}`,
          SymbolKind.Variable,
          paramRange,
          paramRange,
        );
    }

}
