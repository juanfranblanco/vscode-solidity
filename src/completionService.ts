'use strict';
import * as solparse from 'solparse-exp-jb';
import {ContractCollection} from './model/contractsCollection';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { initialiseProject } from './projectService';
import * as vscode from 'vscode-languageserver';
import {Contract2, DocumentContract, Function, SolidityCodeWalker, Variable} from './codeWalkerService';


// TODO implement caching, dirty on document change, reload, etc.
// store
// export class CompletionFile {
//    public path: string;
//    public imports: string[]
//    public inspectionResult : any
// }


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

    public createFunctionParamsSnippet(params: any, skipFirst: boolean = false): string {
        let paramsSnippet = '';
        let counter = 0;
        if (typeof params !== 'undefined' && params !== null) {
            params.forEach( parameterElement => {
               if(skipFirst && counter === 0) {
                  skipFirst = false; 
               } else {
                const typeString = this.getTypeString(parameterElement.literal);
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

    public createParamsInfo(params: any): string {
        let paramsInfo = '';
        if (typeof params !== 'undefined' && params !== null) {
            if (params.hasOwnProperty('params')) {
                params = params.params;
            }
            params.forEach( parameterElement => {
               const typeString = this.getTypeString(parameterElement.literal);
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

    public createFunctionEventCompletionItem(contractElement: any, type: string, contractName: string, skipFirstParamSnipppet: boolean = false): CompletionItem {

        const completionItem =  CompletionItem.create(contractElement.name);
        completionItem.kind = CompletionItemKind.Function;
        const paramsInfo = this.createParamsInfo(contractElement.params);
        const paramsSnippet = this.createFunctionParamsSnippet(contractElement.params, skipFirstParamSnipppet);
        let returnParamsInfo = this.createParamsInfo(contractElement.returnParams);
        if (returnParamsInfo !== '') {
            returnParamsInfo = ' returns (' + returnParamsInfo + ')';
        }
        completionItem.insertTextFormat = 2;
        completionItem.insertText = contractElement.name + '(' + paramsSnippet + ');';
        const info = '(' + type + ' in ' + contractName + ') ' + contractElement.name + '(' + paramsInfo + ')' + returnParamsInfo;
        completionItem.documentation = info;
        completionItem.detail = info;
        return completionItem;
    }

    public createParameterCompletionItem(contractElement: any, type: string, contractName: string): CompletionItem {

        const completionItem =  CompletionItem.create(contractElement.id);
        completionItem.kind = CompletionItemKind.Variable;
        const typeString = this.getTypeString(contractElement.literal);
        completionItem.detail = '(' + type + ' in ' + contractName + ') '
                                            + typeString + ' ' + contractElement.id;
        return completionItem;
    }

    public createVariableCompletionItem(contractElement: any, type: string, contractName: string): CompletionItem {

        const completionItem =  CompletionItem.create(contractElement.name);
        completionItem.kind = CompletionItemKind.Field;
        const typeString = this.getTypeString(contractElement.literal);
        completionItem.detail = '(' + type + ' in ' + contractName + ') '
                                            + typeString + ' ' + contractElement.name;
        return completionItem;
    }

    public createStructCompletionItem(contractElement: any, contractName: string): CompletionItem {

        const completionItem =  CompletionItem.create(contractElement.name);
        completionItem.kind = CompletionItemKind.Struct;
        //completionItem.insertText = contractName + '.' + contractElement.name;
        completionItem.insertText = contractElement.name;
        completionItem.detail = '(Struct in ' + contractName + ') '
                                            + contractElement.name;
        return completionItem;
    }

    public createEnumCompletionItem(contractElement: any, contractName: string): CompletionItem {

        const completionItem =  CompletionItem.create(contractElement.name);
        completionItem.kind = CompletionItemKind.Enum;
        //completionItem.insertText = contractName + '.' + contractElement.name;
        completionItem.insertText = contractElement.name;
        completionItem.detail = '(Enum in ' + contractName + ') '
                                            + contractElement.name;
        return completionItem;
    }
    
    // type "Contract, Libray, Abstract contract"
    public createContractCompletionItem(contractName: string, type: string): CompletionItem {

        const completionItem =  CompletionItem.create(contractName);
        completionItem.kind = CompletionItemKind.Class;
        completionItem.insertText = contractName;
        completionItem.detail = '(' + type + ' : ' + contractName + ') '
                        
        return completionItem;
    }

    public createInterfaceCompletionItem(contractName: string): CompletionItem {

        const completionItem =  CompletionItem.create(contractName);
        completionItem.kind = CompletionItemKind.Interface;
        completionItem.insertText = contractName;
        completionItem.detail = '( Interface : ' + contractName + ') '               
        return completionItem;
    }
  

    public getDocumentCompletionItems(documentText: string): CompletionItem[] {
        const completionItems = [];
        try {
            const result = solparse.parse(documentText);
            // console.log(JSON.stringify(result));
            // TODO struct, modifier
            result.body.forEach(element => {
                if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement' || element.type == 'InterfaceStatement') {
                    const contractName = element.name;
                    if (typeof element.body !== 'undefined' && element.body !== null) {
                        element.body.forEach(contractElement => {
                            if (contractElement.type === 'FunctionDeclaration') {
                                // ignore the constructor TODO add to contract initialiasation
                                if (contractElement.name !== contractName) {
                                    completionItems.push(
                                            this.createFunctionEventCompletionItem(contractElement, 'function', contractName ));
                                }
                            }

                            if (contractElement.type === 'EventDeclaration') {
                                completionItems.push(this.createFunctionEventCompletionItem(contractElement, 'event', contractName ));
                            }

                            if (contractElement.type === 'StateVariableDeclaration') {
                                completionItems.push(this.createVariableCompletionItem(contractElement, 'state variable', contractName));
                            }

                            if (contractElement.type === 'EnumDeclaration') {
                                completionItems.push(this.createEnumCompletionItem(contractElement, contractName));
                            }

                            if (contractElement.type === 'StructDeclaration') {
                                completionItems.push(this.createStructCompletionItem(contractElement, contractName));
                            }
                        });
                    }
                }
            });
        } catch (error) {
          // gracefule catch
          // console.log(error.message);
        }
        // console.log('file completion items' + completionItems.length);
        return completionItems;
    }


    public getAllCompletionItems2(packageDefaultDependenciesDirectory: string,
        packageDefaultDependenciesContractsDirectory: string,
        document: vscode.TextDocument,
        position: vscode.Position,
      ): CompletionItem[] {
        let completionItems = [];
        let triggeredByEmit = false;
        let triggeredByDotStart = 0;
        try {
        var walker = new SolidityCodeWalker(this.rootPath,  packageDefaultDependenciesDirectory,
            packageDefaultDependenciesContractsDirectory,
        );
        const offset = document.offsetAt(position);

        var documentContractSelected = walker.getAllContracts(document, position);

        const lines = document.getText().split(/\r?\n/g);
        triggeredByDotStart = this.getTriggeredByDotStart(lines, position);
        
        //triggered by emit is only possible with ctrl space
        triggeredByEmit = getAutocompleteVariableNameTrimmingSpaces(lines[position.line], position.character - 1) === 'emit';
        
        if(triggeredByDotStart > 0) {
            
            const globalVariableContext = GetContextualAutoCompleteByGlobalVariable(lines[position.line], triggeredByDotStart);
            
            if (globalVariableContext != null) {
                completionItems = completionItems.concat(globalVariableContext);
            } else {
                let autocompleteByDot = getAutocompleteTriggerByDotVariableName(lines[position.line], triggeredByDotStart - 1);
                // if triggered by variable //done
                // todo triggered by method (get return type) // done
                // todo triggered by property 
                // todo variable // method return is an array (push, length etc)
                // variable / method / property is an address or other specific type functionality (balance, etc)
                // variable / method / property type is extended by a library
                if(autocompleteByDot.name !== '') {

                    
                    // have we got a selected contract 
                    if(documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null )
                    {
                        let selectedContract = documentContractSelected.selectedContract;

                        if(autocompleteByDot.isVariable) {
                            //is triggered by this
                            if(autocompleteByDot.name === 'this') {

                                //add selectd contract completion items
                                this.addContractCompletionItems(selectedContract, completionItems);

                            } else {
                                // start finding the variable name

                                // get all structs to match type
                                let allStructs = documentContractSelected.selectedContract.getAllStructs();
                                let allContracts = documentContractSelected.allContracts;
                                let allEnums = documentContractSelected.selectedContract.getAllEnums();
                                let found = false;

                                let allVariables: Variable[] = documentContractSelected.selectedContract.getAllStateVariables();
                                let selectedFunction = documentContractSelected.selectedContract.getSelectedFunction(offset);
                                if(selectedFunction !== undefined) {
                                    selectedFunction.findVariableDeclarationsInScope(offset, null);
                                    //adding input parameters
                                    allVariables = allVariables.concat(selectedFunction.input);
                                    //ading all variables
                                    allVariables = allVariables.concat(selectedFunction.variablesInScope);
                                }

                                allVariables.forEach(item => {
                                    if(item.name === autocompleteByDot.name && !found) {
                                        found = true;
                                        //todo item arrays
                                        let foundStruct = allStructs.find(x => x.name === item.type.name);
                                        if(foundStruct !== undefined) {
                                            foundStruct.variables.forEach(property => {
                                                //own method refactor
                                                let completitionItem =  CompletionItem.create(property.name);
                                                const typeString = this.getTypeString(property.element.literal);
                                                completitionItem.detail = '(' + property.name + ' in ' + foundStruct.name + ') '
                                                + typeString + ' ' + foundStruct.name;
                                                completionItems.push(completitionItem);
                                            })
                                        } else {

                                            let foundContract = allContracts.find(x => x.name === item.type.name);
                                            if(foundContract !== undefined) {
                                                foundContract.initialiseExtendContracts(allContracts);
                                                this.addContractCompletionItems(foundContract, completionItems);
                                            } else {
                                                let allUsing = documentContractSelected.selectedContract.getAllUsing(item.type.name);
                                                allUsing.forEach(usingItem => {
                                                    let foundLibrary = allContracts.find(x => x.name === usingItem.name);
                                                    if(foundLibrary !== undefined) {
                                                        this.addAllLibraryExtensionsAsCompletionItems(foundLibrary, completionItems, item.type.name);
                                                    }
                                                });
                                            }
                                        } 
                                        
                                        
                                        //find in enum types
                                    }
                                });

                                if(!found) {
                                    allEnums.forEach(item => {
                                        if(item.name === autocompleteByDot.name) {
                                            found = true;
                                                item.items.forEach(property => {
                                                    let completitionItem =  CompletionItem.create(property);
                                                    completionItems.push(completitionItem);
                                                })
                                        }
                                    });
                                }
                            }

                        } // end is variable

                        if(autocompleteByDot.isMethod) {
                            let allStructs = documentContractSelected.selectedContract.getAllStructs();
                            let allContracts = documentContractSelected.allContracts;
                            let allEnums = documentContractSelected.selectedContract.getAllEnums();

                            let allfunctions: Function[] = documentContractSelected.selectedContract.getAllFunctions();
                            let found = false;

                            allfunctions.forEach(item => {
                                if(item.name === autocompleteByDot.name) {
                                    found = true;
                                    if(item.output.length === 1) {
                                        //todo return array
                                        let typeName = item.output[0].type.name;

                                        let foundStruct = allStructs.find(x => x.name === typeName);
                                        if(foundStruct !== undefined) {
                                            foundStruct.variables.forEach(property => {
                                                //own method refactor
                                                let completitionItem =  CompletionItem.create(property.name);
                                                const typeString = this.getTypeString(property.element.literal);
                                                completitionItem.detail = '(' + property.name + ' in ' + foundStruct.name + ') '
                                                + typeString + ' ' + foundStruct.name;
                                                completionItems.push(completitionItem);
                                            })
                                        } else {

                                            let foundContract = allContracts.find(x => x.name === typeName);
                                            if(foundContract !== undefined) {
                                                foundContract.initialiseExtendContracts(allContracts);
                                                this.addContractCompletionItems(foundContract, completionItems);
                                            } else {
                                                let allUsing = documentContractSelected.selectedContract.getAllUsing(typeName);
                                                allUsing.forEach(item => {
                                                    let foundLibrary = allContracts.find(x => x.name === item.name);
                                                    if(foundLibrary !== undefined) {
                                                        this.addAllLibraryExtensionsAsCompletionItems(foundLibrary, completionItems, typeName);
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
            return completionItems;
        }

        if(triggeredByEmit) {
           
            if(documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null ) {
                this.addAllEventsAsCompletionItems(documentContractSelected.selectedContract, completionItems);
            }

        } else {

            if(documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null ) {
                
                let selectedContract = documentContractSelected.selectedContract;
                this.addSelectedContractCompletionItems(selectedContract, completionItems, offset);
            }

            documentContractSelected.allContracts.forEach(x => {
            
                if(x.contractType === "ContractStatement") {
                completionItems.push(this.createContractCompletionItem(x.name, "Contract"));
            }
            
            if(x.contractType === "LibraryStatement") {
                    completionItems.push(this.createContractCompletionItem(x.name, "Library"));
                }

                if(x.contractType === "InterfaceStatement") {
                    completionItems.push(this.createInterfaceCompletionItem(x.name));
                }
            })
        }

    } catch (error) {
        // graceful catch
       // console.log(error);
    } finally {

        completionItems = completionItems.concat(GetCompletionTypes());
        completionItems = completionItems.concat(GetCompletionKeywords());
        completionItems = completionItems.concat(GeCompletionUnits());
        completionItems = completionItems.concat(GetGlobalFunctions());
        completionItems = completionItems.concat(GetGlobalVariables());
    }
    return completionItems;
    }

    private addContractCompletionItems(selectedContract: Contract2, completionItems: any[]) {
        this.addAllFunctionsAsCompletionItems(selectedContract, completionItems);

        this.addAllStateVariablesAsCompletionItems(selectedContract, completionItems);
    }

    private addSelectedContractCompletionItems(selectedContract: Contract2, completionItems: any[], offset: number) {
        this.addAllFunctionsAsCompletionItems(selectedContract, completionItems);

        this.addAllEventsAsCompletionItems(selectedContract, completionItems);

        this.addAllStateVariablesAsCompletionItems(selectedContract, completionItems);

        this.addAllStructsAsCompletionItems(selectedContract, completionItems);

        this.addAllEnumsAsCompletionItems(selectedContract, completionItems);

        let selectedFunction = selectedContract.getSelectedFunction(offset);

        if (selectedFunction !== undefined) {
            selectedFunction.findVariableDeclarationsInScope(offset, null);
            selectedFunction.input.forEach(parameter => {
                completionItems.push(this.createParameterCompletionItem(parameter.element, "function parameter", selectedFunction.contract.name));
            });
            selectedFunction.output.forEach(parameter => {
                completionItems.push(this.createParameterCompletionItem(parameter.element, "return parameter", selectedFunction.contract.name));
            });

            selectedFunction.variablesInScope.forEach(variable => {
                completionItems.push(this.createVariableCompletionItem(variable.element, "function variable", selectedFunction.contract.name));
            });
        }
    }

    private addAllEnumsAsCompletionItems(documentContractSelected: Contract2, completionItems: any[]) {
        let allEnums = documentContractSelected.getAllEnums();
        allEnums.forEach(item => {
            completionItems.push(
                this.createEnumCompletionItem(item.element, item.contract.name));
        });
    }

    private addAllStructsAsCompletionItems(documentContractSelected: Contract2, completionItems: any[]) {
        let allStructs = documentContractSelected.getAllStructs();
        allStructs.forEach(item => {
            completionItems.push(
                this.createStructCompletionItem(item.element, item.contract.name));
        });
    }

    private addAllEventsAsCompletionItems(documentContractSelected: Contract2, completionItems: any[]) {
        let allevents = documentContractSelected.getAllEvents();
        allevents.forEach(item => {
            completionItems.push(
                this.createFunctionEventCompletionItem(item.element, 'event', item.contract.name));
        });
    }

    private addAllStateVariablesAsCompletionItems(documentContractSelected: Contract2, completionItems: any[]) {
        let allStateVariables = documentContractSelected.getAllStateVariables();
        allStateVariables.forEach(item => {
            completionItems.push(
                this.createVariableCompletionItem(item.element, 'state variable', item.contract.name));
        });
    }

    private addAllFunctionsAsCompletionItems(documentContractSelected: Contract2, completionItems: any[]) {
        let allfunctions = documentContractSelected.getAllFunctions();
        allfunctions.forEach(item => {
            completionItems.push(
                this.createFunctionEventCompletionItem(item.element, 'function', item.contract.name));
        });
    }

    private addAllLibraryExtensionsAsCompletionItems(documentContractSelected: Contract2, completionItems: any[], typeName: string) {
        let allfunctions = documentContractSelected.getAllFunctions();
        let filteredFunctions = allfunctions.filter( x => {
            if(x.input.length > 0 ) {
                return x.input[0].type.name === typeName;
            }
            return false;
        });

        filteredFunctions.forEach(item => {
            completionItems.push(
                this.createFunctionEventCompletionItem(item.element, 'function', item.contract.name, true));
        });
    }

    public getTriggeredByDotStart(lines:string[], position: vscode.Position):number {
        let start = 0;
        let triggeredByDot = false;
        for (let i = position.character; i >= 0; i--) {
            if (lines[position.line[i]] === ' ') {
                triggeredByDot = false;
                i = 0;
                start = 0;
            }
            if (lines[position.line][i] === '.') {
                start = i;
                i = 0;
                triggeredByDot = true;
            }
        }
        return start;
    }

    public getAllCompletionItems(documentText: string,
                                documentPath: string,
                                packageDefaultDependenciesDirectory: string,
                                packageDefaultDependenciesContractsDirectory: string): CompletionItem[] {

        if (this.rootPath !== 'undefined' && this.rootPath !== null) {
            const contracts = new ContractCollection();
            contracts.addContractAndResolveImports(
                documentPath,
                documentText,
                initialiseProject(this.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory));
            let completionItems = [];
            contracts.contracts.forEach(contract => {
                completionItems = completionItems.concat(this.getDocumentCompletionItems(contract.code));
            });
            // console.log('total completion items' + completionItems.length);
            return completionItems;
        } else {
            return this.getDocumentCompletionItems(documentText);
        }
    }
}

export function GetCompletionTypes(): CompletionItem[] {
    const completionItems = [];
    const types = ['address', 'string', 'bytes', 'byte', 'int', 'uint', 'bool', 'hash'];
    for (let index = 8; index <= 256; index += 8) {
        types.push('int' + index);
        types.push('uint' + index);
        types.push('bytes' + index / 8);
    }
    types.forEach(type => {
        const completionItem =  CompletionItem.create(type);
        completionItem.kind = CompletionItemKind.Keyword;
        completionItem.detail = type + ' type';
        completionItems.push(completionItem);
    });
    // add mapping
    return completionItems;
}

function CreateCompletionItem(label: string, kind: CompletionItemKind, detail: string) {
    const completionItem = CompletionItem.create(label);
    completionItem.kind = kind;
    completionItem.detail = detail;
    return completionItem;
}

export function GetCompletionKeywords(): CompletionItem[] {
    const completionItems = [];
    const keywords = [ 'modifier', 'mapping', 'break', 'continue', 'delete', 'else', 'for',
    'if', 'new', 'return', 'returns', 'while', 'using',
    'private', 'public', 'external', 'internal', 'payable', 'nonpayable', 'view', 'pure', 'case', 'do', 'else', 'finally',
    'in', 'instanceof', 'return', 'throw', 'try', 'typeof', 'yield', 'void', 'virtual', 'override'] ;
    keywords.forEach(unit => {
        const completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Keyword;
        completionItems.push(completionItem);
    });

    completionItems.push(CreateCompletionItem('contract', CompletionItemKind.Class, null));
    completionItems.push(CreateCompletionItem('library', CompletionItemKind.Class, null));
    completionItems.push(CreateCompletionItem('storage', CompletionItemKind.Field, null));
    completionItems.push(CreateCompletionItem('memory', CompletionItemKind.Field, null));
    completionItems.push(CreateCompletionItem('var', CompletionItemKind.Field, null));
    completionItems.push(CreateCompletionItem('constant', CompletionItemKind.Constant, null));
    completionItems.push(CreateCompletionItem('constructor', CompletionItemKind.Constructor, null));
    completionItems.push(CreateCompletionItem('event', CompletionItemKind.Event, null));
    completionItems.push(CreateCompletionItem('import', CompletionItemKind.Module, null));
    completionItems.push(CreateCompletionItem('enum', CompletionItemKind.Enum, null));
    completionItems.push(CreateCompletionItem('struct', CompletionItemKind.Struct, null));
    completionItems.push(CreateCompletionItem('function', CompletionItemKind.Function, null));

    return completionItems;
}


export function GeCompletionUnits(): CompletionItem[] {
    const completionItems = [];
    const etherUnits = ['wei', 'finney', 'szabo', 'ether'] ;
    etherUnits.forEach(unit => {
        const completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Unit;
        completionItem.detail = unit + ': ether unit';
        completionItems.push(completionItem);
    });

    const timeUnits = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'years'];
    timeUnits.forEach(unit => {
        const completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Unit;

        if (unit !== 'years') {
            completionItem.detail = unit + ': time unit';
        } else {
            completionItem.detail = 'DEPRECATED: ' + unit + ': time unit';
        }
        completionItems.push(completionItem);
    });

    return completionItems;
}

export function GetGlobalVariables(): CompletionItem[] {
    return [
        {
            detail: 'Current block',
            kind: CompletionItemKind.Variable,
            label: 'block',
        },
        {
            detail: 'Current Message',
            kind: CompletionItemKind.Variable,
            label: 'msg',
        },
        {
            detail: '(uint): current block timestamp (alias for block.timestamp)',
            kind: CompletionItemKind.Variable,
            label: 'now',
        },
        {
            detail: 'Current transaction',
            kind: CompletionItemKind.Variable,
            label: 'tx',
        },
        {
            detail: 'ABI encoding / decoding',
            kind: CompletionItemKind.Variable,
            label: 'abi',
        },
    ];
}

export function GetGlobalFunctions(): CompletionItem[] {
    return [
        {
            detail: 'assert(bool condition): throws if the condition is not met - to be used for internal errors.',
            insertText: 'assert(${1:condition});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'assert',
        },
        {
            detail: 'gasleft(): returns the remaining gas',
            insertText: 'gasleft();',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'gasleft',
        },
        {
            detail: 'blockhash(uint blockNumber): hash of the given block - only works for 256 most recent, excluding current, blocks',
            insertText: 'blockhash(${1:blockNumber});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'blockhash',
        },
        {
            detail: 'require(bool condition): reverts if the condition is not met - to be used for errors in inputs or external components.',
            insertText: 'require(${1:condition});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'require',
        },
        {
            // tslint:disable-next-line:max-line-length
            detail: 'require(bool condition, string message): reverts if the condition is not met - to be used for errors in inputs or external components. Also provides an error message.',
            insertText: 'require(${1:condition}, ${2:message});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'require',
        },
        {
            detail: 'revert(): abort execution and revert state changes',
            insertText: 'revert();',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'revert',
        },
        {
            detail: 'addmod(uint x, uint y, uint k) returns (uint):' +
                    'compute (x + y) % k where the addition is performed with arbitrary precision and does not wrap around at 2**256',
            insertText: 'addmod(${1:x}, ${2:y}, ${3:k})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'addmod',
        },
        {
            detail: 'mulmod(uint x, uint y, uint k) returns (uint):' +
                    'compute (x * y) % k where the multiplication is performed with arbitrary precision and does not wrap around at 2**256',
            insertText: 'mulmod(${1:x}, ${2:y}, ${3:k})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'mulmod',
        },
        {
            detail: 'keccak256(...) returns (bytes32):' +
                    'compute the Ethereum-SHA-3 (Keccak-256) hash of the (tightly packed) arguments',
            insertText: 'keccak256(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'keccak256',
        },
        {
            detail: 'sha256(...) returns (bytes32):' +
                    'compute the SHA-256 hash of the (tightly packed) arguments',
            insertText: 'sha256(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'sha256',
        },
        {
            detail: 'sha3(...) returns (bytes32):' +
                    'alias to keccak256',
            insertText: 'sha3(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'sha3',
        },
        {
            detail: 'ripemd160(...) returns (bytes20):' +
                    'compute RIPEMD-160 hash of the (tightly packed) arguments',
            insertText: 'ripemd160(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'ripemd160',
        },
        {
            detail: 'ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address):' +
                    'recover the address associated with the public key from elliptic curve signature or return zero on error',
            insertText: 'ecrecover(${1:hash}, ${2:v}, ${3:r}, ${4:s})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'ecrecover',
        },

    ];
}

export function GetContextualAutoCompleteByGlobalVariable(lineText: string, wordEndPosition: number): CompletionItem[] {
    if (isAutocompleteTrigeredByVariableName('block', lineText, wordEndPosition)) {
        return getBlockCompletionItems();
    }
    if (isAutocompleteTrigeredByVariableName('msg', lineText, wordEndPosition)) {
        return getMsgCompletionItems();
    }
    if (isAutocompleteTrigeredByVariableName('tx', lineText, wordEndPosition)) {
        return getTxCompletionItems();
    }
    if (isAutocompleteTrigeredByVariableName('abi', lineText, wordEndPosition)) {
        return getAbiCompletionItems();
    }
    return null;
}

function isAutocompleteTrigeredByVariableName(variableName: string, lineText: string, wordEndPosition: number): Boolean {
    const nameLength = variableName.length;
    if (wordEndPosition >= nameLength
        // does it equal our name?
        && lineText.substr(wordEndPosition - nameLength, nameLength) === variableName) {
          return true;
        }
    return false;
}

export class AutocompleteByDot {
    public isVariable: boolean = false;
    public isMethod: boolean = false;
    public isArray: boolean = false;
    public isProperty: boolean = false;
    public innerName: string[]; // could be a property or a method
    public name: string = '';
}

function getAutocompleteTriggerByDotVariableName(lineText: string, wordEndPosition:number): AutocompleteByDot {
    let searching = true;
    let result: AutocompleteByDot = new AutocompleteByDot();
    //simpler way might be to find the first space or beginning of line
    //and from there split / match (but for now kiss or slowly)

    //todo multiple dimentions
    if(lineText[wordEndPosition] == ']' ) {
        result.isArray = true;
        let arrayBeginFound = false;
        while(!arrayBeginFound && wordEndPosition >= 0 ) {
            if(lineText[wordEndPosition] === '[') {
                arrayBeginFound = true;
            }
            wordEndPosition = wordEndPosition - 1;
        }
    }

    if(lineText[wordEndPosition] == ')' ) {
        result.isMethod = true;
        let methodParamBeginFound = false;
        while(!methodParamBeginFound && wordEndPosition >= 0 ) {
            if(lineText[wordEndPosition] === '(') {
                methodParamBeginFound = true;
            }
            wordEndPosition = wordEndPosition - 1;
        }
    }

    if(!result.isMethod && !result.isArray) {
        result.isVariable = true;
    }

    while(searching && wordEndPosition >= 0) {
        let currentChar = lineText[wordEndPosition];
        if(isAlphaNumeric(currentChar) || currentChar === '_' || currentChar === '$') {
            result.name = currentChar + result.name;
            wordEndPosition = wordEndPosition - 1;
        } else {
            if(currentChar === ' ') { // we only want a full word for a variable / method // this cannot be parsed due incomplete statements
                searching = false;
                return result;
            }
            searching = false;
            return result;
        }
    }
    return result;
}


function getAutocompleteVariableNameTrimmingSpaces(lineText: string, wordEndPosition:number): string {
    let searching = true;
    let result: string = '';
    if(lineText[wordEndPosition] === ' ' ) {
        let spaceFound = true;
        while(spaceFound && wordEndPosition >= 0 ) {
            wordEndPosition = wordEndPosition - 1;
            if(lineText[wordEndPosition] !== ' ') {
                spaceFound = false;
            }
        }
    }

    while(searching && wordEndPosition >= 0) {
        let currentChar = lineText[wordEndPosition];
        if(isAlphaNumeric(currentChar) || currentChar === '_' || currentChar === '$') {
            result = currentChar + result;
            wordEndPosition = wordEndPosition - 1;
        } else {
            if(currentChar === ' ') { // we only want a full word for a variable // this cannot be parsed due incomplete statements
                searching = false;
                return result;
            }
            searching = false;
            return '';
        }
    }
    return result;
}

function isAlphaNumeric(str) {
    var code, i, len;
  
    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58) && // numeric (0-9)
          !(code > 64 && code < 91) && // upper alpha (A-Z)
          !(code > 96 && code < 123)) { // lower alpha (a-z)
        return false;
      }
    }
    return true;
  };

function getBlockCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(address): Current block miner’s address',
            kind: CompletionItemKind.Property,
            label: 'coinbase',
        },
        {
            detail: '(bytes32): DEPRICATED In 0.4.22 use blockhash(uint) instead. Hash of the given block - only works for 256 most recent blocks excluding current',
            insertText: 'blockhash(${1:blockNumber});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'blockhash',
        },
        {
            detail: '(uint): current block difficulty',
            kind: CompletionItemKind.Property,
            label: 'difficulty',
        },
        {
            detail: '(uint): current block gaslimit',
            kind: CompletionItemKind.Property,
            label: 'gaslimit',
        },
        {
            detail: '(uint): current block number',
            kind: CompletionItemKind.Property,
            label: 'number',
        },
        {
            detail: '(uint): current block timestamp as seconds since unix epoch',
            kind: CompletionItemKind.Property,
            label: 'timestamp',
        },
    ];
}

function getTxCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(uint): gas price of the transaction',
            kind: CompletionItemKind.Property,
            label: 'gas',
        },
        {
            detail: '(address): sender of the transaction (full call chain)',
            kind: CompletionItemKind.Property,
            label: 'origin',
        },
    ];
}

function getMsgCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(bytes): complete calldata',
            kind: CompletionItemKind.Property,
            label: 'data',
        },
        {
            detail: '(uint): remaining gas DEPRICATED in 0.4.21 use gasleft()',
            kind: CompletionItemKind.Property,
            label: 'gas',
        },
        {
            detail: '(address): sender of the message (current call)',
            kind: CompletionItemKind.Property,
            label: 'sender',
        },
        {
            detail: '(bytes4): first four bytes of the calldata (i.e. function identifier)',
            kind: CompletionItemKind.Property,
            label: 'sig',
        },
        {
            detail: '(uint): number of wei sent with the message',
            kind: CompletionItemKind.Property,
            label: 'value',
        },
    ];
}

function getAbiCompletionItems(): CompletionItem[] {
    return [
        {
            detail: 'encode(..) returs (bytes): ABI-encodes the given arguments',
            insertText: 'encode(${1:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encode',
        },
        {
            detail: 'encodePacked(..) returns (bytes): Performes packed encoding of the given arguments',
            insertText: 'encodePacked(${1:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encodePacked',
        },
        {
            detail: 'encodeWithSelector(bytes4,...) returns (bytes): ABI-encodes the given arguments starting from the second and prepends the given four-byte selector',
            insertText: 'encodeWithSelector(${1:bytes4}, ${2:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encodeWithSelector',
        },
        {
            detail: 'encodeWithSignature(string,...) returns (bytes): Equivalent to abi.encodeWithSelector(bytes4(keccak256(signature), ...)`',
            insertText: 'encodeWithSignature(${1:signatureString}, ${2:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encodeWithSignature',
        },
    ];
}
