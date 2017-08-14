import * as solparse from 'solparse';
import * as projectService from './projectService';
import {ContractCollection} from './model/contractsCollection';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

export class CompletionService {

    public rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    public getTypeString(literal: any) {
        const isArray = literal.array_parts.length > 0;
        let isMapping = false;
        const literalType = literal.literal;
        let suffixType = '';

        if (typeof literalType.type !== 'undefined')  {
             isMapping = literalType.type === 'MappingExpression';
             if (isMapping) {
                suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
            }
        }

        if (isArray) {
            suffixType = suffixType + '[]';
        }

        if (isMapping) {
            return 'mapping' + suffixType;
        }

        return literalType + suffixType;
    }

    public createFunctionEventCompletionItem(contractElement: any, type: string, contractName: string): CompletionItem {
        let completionItem =  CompletionItem.create(contractElement.name);
        completionItem.kind = CompletionItemKind.Function;
        let paramsInfo = '';
        let paramsSnippet = '';
        let counter = 0;
        if (typeof contractElement.params !== 'undefined' && contractElement.params !== null) {
            contractElement.params.forEach( parameterElement => {
                counter = counter + 1;
                let currentParamSnippet = '${' + counter + ':' + parameterElement.id + '}';
                const typeString = this.getTypeString(parameterElement.literal);

                let currentParamInfo = typeString + ' ' + parameterElement.id;
                if (paramsInfo === '') {
                    paramsInfo = currentParamInfo;
                    paramsSnippet =  currentParamSnippet;
                }else {
                    paramsInfo = paramsInfo + ', ' + currentParamInfo;
                    paramsSnippet = paramsSnippet + ', ' + currentParamSnippet;
                }
            });
        }
        completionItem.insertTextFormat = 2;
        completionItem.insertText = contractElement.name + '(' + paramsSnippet + ');';
        const info = '(' + type + ' in ' + contractName + ') ' + contractElement.name + '(' + paramsInfo + ')';
        completionItem.documentation = info;
        completionItem.detail = info;
        return completionItem;
    }

    public getDocumentCompletionItems(documentText: string): CompletionItem[] {
        let completionItems = [];
        let result = solparse.parse(documentText);
        // console.log(JSON.stringify(result));
        // TODO struct, modifier
        // Find imports
        result.body.forEach(element => {
            if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement') {
                let contractName = element.name;
                if (typeof element.body !== 'undefined' && element.body !== null) {
                    element.body.forEach(contractElement => {
                        if (contractElement.type === 'FunctionDeclaration') {
                            // ignore the constructor TODO add to contract initialiasation
                            if (contractElement.name !== contractName) {
                                completionItems.push(this.createFunctionEventCompletionItem(contractElement, 'function', contractName ));
                            }
                        }

                        if (contractElement.type === 'EventDeclaration') {
                            completionItems.push(this.createFunctionEventCompletionItem(contractElement, 'event', contractName ));
                        }

                        if (contractElement.type === 'StateVariableDeclaration') {
                            let completionItem =  CompletionItem.create(contractElement.name);
                            completionItem.kind = CompletionItemKind.Field;
                            const typeString = this.getTypeString(contractElement.literal);
                            completionItem.detail = '(state variable in ' + contractName + ') ' + typeString + ' ' + contractElement.name;
                            completionItems.push(completionItem);
                        }
                    });
                }
            }
        });
        // console.log('file completion items' + completionItems.length);
        return completionItems;
    }

    public getAllCompletionItems(documentText: string, documentPath: string): CompletionItem[] {
        const contracts = new ContractCollection();
        contracts.addContractAndResolveImports(
            documentPath,
            documentText,
            projectService.initialiseProject(this.rootPath));
        let completionItems = [];
        contracts.contracts.forEach(contract => {
            completionItems = completionItems.concat(this.getDocumentCompletionItems(contract.code));
        });
        // console.log('total completion items' + completionItems.length);
        return completionItems;
    }

}

