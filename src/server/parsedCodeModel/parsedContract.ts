import { ParsedStateVariable } from './ParsedStateVariable';
import { ParsedEnum } from './ParsedEnum';
import { ParsedStruct } from './ParsedStruct';
import { ParsedEvent } from './ParsedEvent';
import { ParsedFunction } from './ParsedFunction';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedUsing } from './parsedUsing';
import { ParsedError } from './ParsedError';
import { ParsedDocument } from './ParsedDocument';
import { ParsedConstant } from './ParsedConstant';
import { ParsedCustomType } from './ParsedCustomType';
import { CompletionItem, CompletionItemKind, Location, Range, TextDocument } from 'vscode-languageserver';
import { ParsedContractIs } from './ParsedContractIs';

export enum ContractType {
    contract,
    interface,
    library,
}

export class ParsedContract extends ParsedCode {

    public functions: ParsedFunction[] = [];
    public enums: ParsedEnum[] = [];
    public events: ParsedEvent[] = [];
    public stateVariables: ParsedStateVariable[] = [];
    public contractIsStatements: ParsedContractIs[] = [];
    public errors: ParsedError[] = [];
    public structs: ParsedStruct[] = [];
    public using: ParsedUsing[] = [];
    public customTypes: ParsedCustomType[] = [];

    public contractElementType: string;
    public constructorFunction: ParsedFunction = new ParsedFunction();
    public fallbackFunction: ParsedFunction = new ParsedFunction();
    public receiveFunction: ParsedFunction = new ParsedFunction();
    public extendsContracts: ParsedContract[] = [];

    public contractType: ContractType = ContractType.contract;
    public isAbstract: boolean;

    public initialise(element: any, document: ParsedDocument) {
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.contractElementType = element.type;

        if (this.element.is_abstract !== undefined || this.element.is_abstract !== null) {
            this.isAbstract = this.element.is_abstract;
        } else {
            this.isAbstract = false;
        }

        if (element.type === 'ContractStatement') {
            this.contractType = ContractType.contract;
        }

        if (element.type === 'LibraryStatement') {
            this.contractType = ContractType.library;
        }

        if (element.type === 'InterfaceStatement') {
            this.contractType = ContractType.interface;
        }
        this.initialiseChildren();
    }

    public initialiseExtendContracts() {
        this.contractIsStatements.forEach(isStatement => {
                const contractReference = isStatement.initialiseContractReference();
                if (contractReference !== undefined && contractReference !== null) {
                    this.extendsContracts.push(contractReference); }
                });
    }

    public isConstructorSelected(offset: number) {
        const element = this.constructorFunction.element;
        return this.isElementedSelected(element, offset);
    }

    public isFallbackSelected(offset: number) {
        const element = this.fallbackFunction.element;
        return this.isElementedSelected(element, offset);
    }

    public isReceivableSelected(offset: number) {
        const element = this.receiveFunction.element;
        return this.isElementedSelected(element, offset);
    }

    public getSelectedIsStatement(offset: number): ParsedContractIs {
        const foundContractIs  = this.contractIsStatements.find(x => {
            return x.isCurrentElementedSelected(offset);
        });
        return foundContractIs;
    }

    public getSelectedStructDeclaration(offset: number): ParsedStruct {
        const found  = this.structs.find(x => {
            return x.isCurrentElementedSelected(offset);
        });
        return found;
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
        if (this.isCurrentElementedSelected(offset)) {
            const results: FindTypeReferenceLocationResult[] = [];
            this.functions.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.errors.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.events.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.stateVariables.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.structs.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.using.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.customTypes.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.contractIsStatements.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));

            const foundResult = results.find(x => x.isCurrentElementSelected === true);
            if (foundResult === undefined) {
                return FindTypeReferenceLocationResult.create(true);
            } else {
                return foundResult;
            }
        }
        return FindTypeReferenceLocationResult.create(false);
    }

    public findType(name: string): ParsedCode {
        let typesParsed: ParsedCode[] = [];
        typesParsed = typesParsed.concat(this.getAllConstants())
                         .concat(this.getAllCustomTypes())
                         .concat(this.getAllStructs())
                         .concat(this.getAllEnums())
                         .concat(this.document.allContracts);
        return typesParsed.find(x => x.name === name);
    }

    public findMethodCalls(name: string): ParsedCode[] {
        let typesParsed: ParsedCode[] = [];
        typesParsed = typesParsed.concat(this.getAllFunctions());
        return typesParsed.filter(x => x.name === name);
    }

    public getSelectedFunction(offset: number) {
        let selectedFunction = this.functions.find(x => {
            const element = x.element;
            if (element !== undefined || element !== null) {
                if (element.start <= offset && offset <= element.end) {
                    return true;
                }
            }
            return false;
        });

        if (selectedFunction === undefined) { // nothing
            if (this.isConstructorSelected(offset)) {
                selectedFunction = this.constructorFunction;
            } else {
                if (this.isFallbackSelected(offset)) {
                    selectedFunction = this.fallbackFunction;
                } else {
                    if (this.isReceivableSelected(offset)) {
                        selectedFunction = this.receiveFunction;
                    }
                }
            }
        }
        return selectedFunction;
    }

    public getAllFunctions(): ParsedFunction[] {
        let returnItems: ParsedFunction[] = [];
        returnItems = returnItems.concat(this.functions);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllFunctions());
        });
        returnItems = returnItems.concat(this.document.getAllGlobalFunctions());
        return returnItems;
    }



    public getAllStructs(): ParsedStruct[] {
        let returnItems: ParsedStruct[] = [];
        returnItems = returnItems.concat(this.structs);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllStructs());
        });
        returnItems = returnItems.concat(this.document.getAllGlobalStructs());
        return returnItems;
    }

    public getAllErrors(): ParsedError[] {
        let returnItems: ParsedError[] = [];
        returnItems = returnItems.concat(this.errors);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllErrors());
        });
        returnItems = returnItems.concat(this.document.getAllGlobalErrors());
        return returnItems;
    }

    public getAllEnums(): ParsedEnum[] {
        let returnItems: ParsedEnum[] = [];
        returnItems = returnItems.concat(this.enums);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllEnums());
        });
        returnItems = returnItems.concat(this.document.getAllGlobalEnums());
        return returnItems;
    }

    public getAllCustomTypes(): ParsedCustomType[] {
        let returnItems: ParsedCustomType[] = [];
        returnItems = returnItems.concat(this.customTypes);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllCustomTypes());
        });
        returnItems = returnItems.concat(this.document.getAllGlobalCustomTypes());
        return returnItems;
    }

    public getAllStateVariables(): ParsedStateVariable[] {
        let returnItems: ParsedStateVariable[] = [];
        returnItems = returnItems.concat(this.stateVariables);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllStateVariables());
        });
        return returnItems;
    }

    public getAllConstants(): ParsedConstant[] {
        return this.document.getAllGlobalConstants();
    }

    public getAllEvents(): ParsedEvent[] {
        let returnItems: ParsedEvent[] = [];
        returnItems = returnItems.concat(this.events);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllEvents());
        });
        returnItems = returnItems.concat(this.document.getAllGlobalEvents());
        return returnItems;
    }

    public getAllUsing(type: ParsedDeclarationType): ParsedUsing[] {
        let returnItems: ParsedUsing[] = [];
        returnItems = returnItems.concat(this.using.filter(x => {
            if (x.forStar === true) { return true; }
            if (x.for !== null) {
                let validTypeName = false;
                if (x.for.name === type.name || (type.name === 'address_payable' && x.for.name === 'address')) {
                    validTypeName = true;
                }
                return x.for.isArray === type.isArray && validTypeName && x.for.isMapping === type.isMapping;
            }
            return false;

        }));

        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllUsing(type));
        });

        returnItems = returnItems.concat(this.document.getAllGlobalUsing(type));
        return returnItems.filter((v, i) => {
            return returnItems.map(mapObj => mapObj['name']).indexOf(v['name']) === i;
        });
    }

    public initialiseChildren() {
        if (typeof this.element.is !== 'undefined' && this.element.is !== null) {
            this.element.is.forEach(isElement => {
                const isStatement = new ParsedContractIs();
                isStatement.initialise(isElement, this, this.document, false);
                this.contractIsStatements.push(isStatement);
            });
        }

        if (typeof this.element.body !== 'undefined' && this.element.body !== null) {
            this.element.body.forEach(contractElement => {
                if (contractElement.type === 'FunctionDeclaration') {
                    const functionContract = new ParsedFunction();
                    functionContract.initialise(contractElement, this, this.document, false);
                    if (functionContract.name === functionContract.contract.name) {
                        this.constructorFunction = functionContract;
                    } else {
                        this.functions.push(functionContract);
                    }
                }

                if (contractElement.type === 'ModifierDeclaration') {
                    const functionContract = new ParsedFunction();
                    functionContract.initialise(contractElement, this, this.document, false);
                    functionContract.isModifier = true;
                    this.functions.push(functionContract);
                }

                if (contractElement.type === 'ConstructorDeclaration') {
                    const functionContract = new ParsedFunction();
                    functionContract.initialise(contractElement, this, this.document, false);
                    this.constructorFunction = functionContract;
                }

                if (contractElement.type === 'FallbackDeclaration') {
                    const functionContract = new ParsedFunction();
                    functionContract.initialise(contractElement, this, this.document, false);
                    this.fallbackFunction = functionContract;
                }

                if (contractElement.type === 'ReceiveDeclaration') {
                    const functionContract = new ParsedFunction();
                    functionContract.initialise(contractElement, this, this.document, false);
                    this.receiveFunction = functionContract;
                }

                if (contractElement.type === 'EventDeclaration') {
                    const eventContract = new ParsedEvent();
                    eventContract.initialise(contractElement, this, this.document, false);
                    this.events.push(eventContract);
                }

                if (contractElement.type === 'StateVariableDeclaration') {
                    const stateVariable = new ParsedStateVariable();
                    stateVariable.initialise(contractElement, this, this.document);
                    this.stateVariables.push(stateVariable);
                }

                if (contractElement.type === 'EnumDeclaration') {
                    const enumContract = new ParsedEnum();
                    enumContract.initialise(contractElement, this, this.document, false);
                    this.enums.push(enumContract);
                }

                if (contractElement.type === 'StructDeclaration') {
                    const struct = new ParsedStruct();
                    struct.initialise(contractElement, this, this.document, false);
                    this.structs.push(struct);
                }

                if (contractElement.type === 'TypeDeclaration') {
                    const customType = new ParsedCustomType();
                    customType.initialise(contractElement, this, this.document, false);
                    this.customTypes.push(customType);
                }

                if (contractElement.type === 'ErrorDeclaration') {
                    const error = new ParsedError();
                    error.initialise(contractElement, null, this.document, false);
                    /*
                    if (selectedElement === contractElement) {
                        this.selectedError = error;
                    }*/
                    this.errors.push(error);
                }

                if (contractElement.type === 'UsingStatement') {
                    const using = new ParsedUsing();
                    using.initialise(contractElement, this, this.document, false);
                    this.using.push(using);
                }
            });
        }
    }

    public createCompletionItem(): CompletionItem {

        const completionItem =  CompletionItem.create(this.name);
        if (this.contractType === ContractType.interface) {
            completionItem.kind = CompletionItemKind.Interface;
        } else {
            completionItem.kind = CompletionItemKind.Class;
        }

        completionItem.insertText = this.name;
        completionItem.detail = '(' + this.getContractTypeName(this.contractType)  + ' : ' + this.name + ') in ' + this.document.sourceDocument.absolutePath;

        return completionItem;
    }

    public getAllFunctionCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllFunctions().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllEventsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllEvents().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllErrorsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllErrors().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllStructsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllStructs().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllEnumsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllEnums().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllCustomTypesCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllCustomTypes().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllConstantCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllConstants().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }


    public getAllStateVariableCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllStateVariables().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getDotCompletionItems(): CompletionItem[] {
        let completionItems: CompletionItem[] = [];
        completionItems = completionItems.concat(this.getAllFunctionCompletionItems());
        completionItems = completionItems.concat(this.getAllStateVariableCompletionItems());
        return completionItems;
    }

    public getSelectedContractCompletionItems(offset: number): CompletionItem[] {
        let completionItems: CompletionItem[] = [];
        completionItems = completionItems.concat(this.getAllFunctionCompletionItems());
        completionItems = completionItems.concat(this.getAllEventsCompletionItems());
        completionItems = completionItems.concat(this.getAllStateVariableCompletionItems());
        completionItems = completionItems.concat(this.getAllStructsCompletionItems());
        completionItems = completionItems.concat(this.getAllEnumsCompletionItems());
        completionItems = completionItems.concat(this.getAllCustomTypesCompletionItems());
        completionItems = completionItems.concat(this.getAllConstantCompletionItems());
        completionItems = completionItems.concat(this.document.getAllGlobalContractsCompletionItems());

        const selectedFunction = this.getSelectedFunction(offset);

        if (selectedFunction !== undefined) {
            selectedFunction.findVariableDeclarationsInScope(offset);
            selectedFunction.input.forEach(parameter => {
                completionItems.push(parameter.createCompletionItem('function parameter', selectedFunction.contract.name));
            });
            selectedFunction.output.forEach(parameter => {
                completionItems.push(parameter.createCompletionItem('return parameter', selectedFunction.contract.name));
            });

            selectedFunction.variablesInScope.forEach(variable => {
                completionItems.push(variable.createCompletionItem());
            });
        }
        return completionItems;
    }

    public getContractTypeName(contractType: ContractType) {
        switch (contractType) {
            case ContractType.contract:
                return 'Contract';
            case ContractType.interface:
                return 'Interface';
            case ContractType.library:
                return 'Library';
            default:
                break;
        }
    }

}
