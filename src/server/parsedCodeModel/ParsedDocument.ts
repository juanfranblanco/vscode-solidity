import { ParsedEnum } from './ParsedEnum';
import { ParsedEvent } from './ParsedEvent';
import { ParsedFunction } from './ParsedFunction';
import { ParsedStruct } from './ParsedStruct';
import { ParsedContract } from './parsedContract';
import { ParsedUsing } from './parsedUsing';
import { ParsedImport } from './ParsedImport';
import { ParsedError } from './ParsedError';
import { ParsedConstant } from './ParsedConstant';
import { SourceDocument } from '../../common/model/sourceDocument';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedCustomType } from './ParsedCustomType';
import { URI } from 'vscode-uri';
import { CompletionItem, Location, Range, TextDocument } from 'vscode-languageserver';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';


export class ParsedDocument {

    public allContracts: ParsedContract[] = [];
    public innerContracts: ParsedContract[] = [];
    public functions: ParsedFunction[]  = [];
    public events: ParsedEvent[]  = [];
    public enums: ParsedEnum[]  = [];
    public usings: ParsedUsing[]  = [];
    public structs: ParsedStruct[]  = [];
    public importedDocuments: ParsedDocument[] = [];
    public imports: ParsedImport[] = [];
    public errors: ParsedError[] = [];
    public constants: ParsedConstant[] = [];
    public customTypes: ParsedCustomType [] = [];

    public selectedFunction: ParsedFunction;
    public selectedContract: ParsedContract;
    public selectedEvent: ParsedEvent;
    public selectedEnum: ParsedEnum;
    public selectedStruct: ParsedStruct;
    public selectedUsing: ParsedUsing;
    public selectedImport: ParsedImport;
    public selectedError: ParsedError;
    public selectedConstant: ParsedConstant;
    public selectedElement: any;

    public sourceDocument: SourceDocument;
    public fixedSource: string = null;
    public element: any;

    public getAllGlobalFunctions(): ParsedFunction[] {
        let returnItems: ParsedFunction[] = [];
        returnItems = returnItems.concat(this.functions);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalFunctions());
        });
        return returnItems;
    }

    public getAllGlobalErrors(): ParsedError[] {
        let returnItems: ParsedError[] = [];
        returnItems = returnItems.concat(this.errors);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalErrors());
        });
        return returnItems;
    }

    public getAllGlobalStructs(): ParsedStruct[] {
        let returnItems: ParsedStruct[] = [];
        returnItems = returnItems.concat(this.structs);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalStructs());
        });
        return returnItems;
    }

    public getAllGlobalEnums(): ParsedEnum[] {
        let returnItems: ParsedEnum[] = [];
        returnItems = returnItems.concat(this.enums);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalEnums());
        });
        return returnItems;
    }

    public getAllGlobalConstants(): ParsedConstant[] {
        let returnItems: ParsedConstant[] = [];
        returnItems = returnItems.concat(this.constants);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalConstants());
        });
        return returnItems;
    }

    public getAllGlobalEvents(): ParsedEvent[] {
        let returnItems: ParsedEvent[] = [];
        returnItems = returnItems.concat(this.events);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalEvents());
        });
        return returnItems;
    }

    public getAllGlobalCustomTypes(): ParsedCustomType[] {
        let returnItems: ParsedCustomType[] = [];
        returnItems = returnItems.concat(this.customTypes);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.getAllGlobalCustomTypes());
        });
        return returnItems;
    }

    public getAllGlobalUsing(type: ParsedDeclarationType): ParsedUsing[] {
        let returnItems: ParsedUsing[] = [];
        returnItems = returnItems.concat(this.usings.filter(x => {
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

        this.importedDocuments.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllGlobalUsing(type));
        });
        return returnItems.filter((v, i) => {
            return returnItems.map(mapObj => mapObj['name']).indexOf(v['name']) === i;
        });
    }


    public initialise(documentElement: any, selectedElement: any = null, sourceDocument: SourceDocument, fixedSource: string = null) {
            this.element = documentElement;
            this.sourceDocument = sourceDocument;

            this.fixedSource = fixedSource;
            this.selectedElement = selectedElement;

            documentElement.body.forEach(element => {

                if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement' || element.type === 'InterfaceStatement') {
                    const contract = new ParsedContract();
                    contract.initialise(element, this);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedContract = contract;
                    }
                    this.allContracts.push(contract);
                    this.innerContracts.push(contract);
                }

                if (element.type === 'FileLevelConstant') {
                    const constant = new ParsedConstant();
                    constant.initialise(element, this);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedConstant = constant;
                    }
                    this.constants.push(constant);
                }

                if (element.type === 'ImportStatement') {
                    const importDocument = new ParsedImport();
                    importDocument.initialise(element, this);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedImport = importDocument;
                    }
                    this.imports.push(importDocument);
                }

                if (element.type === 'FunctionDeclaration') {
                    const functionDocument = new ParsedFunction();
                    functionDocument.initialise(element, null, this, true);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedFunction = functionDocument;
                    }
                    this.functions.push(functionDocument);
                }

                if (element.type === 'EventDeclaration') {
                    const eventDocument = new ParsedEvent();
                    eventDocument.initialise(element, null, this, true);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedEvent = eventDocument;
                    }
                    this.events.push(eventDocument);
                }

                if (element.type === 'EnumDeclaration') {
                    const enumDocument = new ParsedEnum();
                    enumDocument.initialise(element, null, this, true);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedEnum = enumDocument;
                    }
                    this.enums.push(enumDocument);
                }

                if (element.type === 'StructDeclaration') {
                    const struct = new ParsedStruct();
                    struct.initialise(element, null, this, true);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedStruct = struct;
                    }
                    this.structs.push(struct);
                }

                if (element.type === 'TypeDeclaration') {
                    const customType = new ParsedCustomType();
                    customType.initialise(element, null, this, true);
                    this.customTypes.push(customType);
                }

                if (element.type === 'ErrorDeclaration') {
                    const documentError = new ParsedError();
                    documentError.initialise(element, null, this, true);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedError = documentError;
                    }
                    this.errors.push(documentError);
                }

                if (element.type === 'UsingStatement') {
                    const using = new ParsedUsing();
                    using.initialise(element, null, this, true);
                    if (this.matchesElement(selectedElement, element)) {
                        this.selectedUsing = using;
                    }
                    this.usings.push(using);
                }
            });

          }

    public findContractByName(name: string): ParsedContract {
        for (const contract of this.allContracts) {
            if (contract.name === name) {
                return contract;
            }
        }
        return null;
    }

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
            const results: FindTypeReferenceLocationResult[] = [];
            this.functions.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.errors.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.events.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.innerContracts.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.structs.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.usings.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.customTypes.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.constants.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.imports.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));

            const foundResult = results.find(x => x.isCurrentElementSelected === true);
            if (foundResult === undefined) {
                return FindTypeReferenceLocationResult.create(true);
            } else {
                return foundResult;
            }
    }

    public findType(name: string): ParsedCode {
        let typesParsed: ParsedCode[] = [];
        typesParsed = typesParsed.concat(this.getAllGlobalConstants())
                         .concat(this.getAllGlobalCustomTypes())
                         .concat(this.getAllGlobalStructs())
                         .concat(this.getAllGlobalEnums())
                         .concat(this.allContracts);
        return typesParsed.find(x => x.name === name);
    }

    public getLocation() {
        const uri = URI.file(this.sourceDocument.absolutePath).toString();
        const document = TextDocument.create(uri, null, null, this.sourceDocument.code);
        return Location.create(
            document.uri,
            Range.create(document.positionAt(this.element.start), document.positionAt(this.element.end)),
          );
    }

    public getGlobalPathInfo(): string {
        return this.sourceDocument.absolutePath + ' global';
    }

    public getAllGlobalFunctionCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalFunctions().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalEventsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalEvents().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalErrorsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalErrors().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalStructsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalStructs().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalEnumsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalEnums().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalCustomTypesCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalCustomTypes().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalConstantCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.getAllGlobalConstants().forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllGlobalContractsCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.allContracts.forEach(x => completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getSelectedDocumentCompletionItems(offset: number): CompletionItem[] {
        let completionItems: CompletionItem[] = [];
        completionItems = completionItems.concat(this.getAllGlobalFunctionCompletionItems());
        completionItems = completionItems.concat(this.getAllGlobalEventsCompletionItems());
        completionItems = completionItems.concat(this.getAllGlobalStructsCompletionItems());
        completionItems = completionItems.concat(this.getAllGlobalEnumsCompletionItems());
        completionItems = completionItems.concat(this.getAllGlobalCustomTypesCompletionItems());
        completionItems = completionItems.concat(this.getAllGlobalConstantCompletionItems());
        completionItems = completionItems.concat(this.getAllGlobalContractsCompletionItems());

        if (this.selectedFunction !== undefined) {
            this.selectedFunction.findVariableDeclarationsInScope(offset);
            this.selectedFunction.input.forEach(parameter => {
                completionItems.push(parameter.createCompletionItem('function parameter', this.getGlobalPathInfo()));
            });
            this.selectedFunction.output.forEach(parameter => {
                completionItems.push(parameter.createCompletionItem('return parameter', this.getGlobalPathInfo()));
            });

            this.selectedFunction.variablesInScope.forEach(variable => {
                completionItems.push(variable.createCompletionItem());
            });
        }
        return completionItems;
    }


    private matchesElement(selectedElement: any, element: any) {
        return selectedElement !== null && selectedElement === element;
    }
}

