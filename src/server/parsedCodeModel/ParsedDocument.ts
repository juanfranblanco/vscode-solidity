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
import { CompletionItem, Hover, Location, Range, TextDocument } from 'vscode-languageserver';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedExpression } from './ParsedExpression';
import { IParsedExpressionContainer } from './IParsedExpressionContainer';


export class ParsedDocument extends ParsedCode implements IParsedExpressionContainer {

    public innerContracts: ParsedContract[] = [];
    public functions: ParsedFunction[] = [];
    public events: ParsedEvent[] = [];
    public enums: ParsedEnum[] = [];
    public usings: ParsedUsing[] = [];
    public structs: ParsedStruct[] = [];
    public importedDocuments: ParsedDocument[] = [];
    public imports: ParsedImport[] = [];
    public errors: ParsedError[] = [];
    public constants: ParsedConstant[] = [];
    public customTypes: ParsedCustomType[] = [];
    public expressions: ParsedExpression[] = [];

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

    

    public getDocumentsThatReference(document: ParsedDocument, processedDocuments: Set<string> = new Set()): ParsedDocument[] {
        let returnItems: ParsedDocument[] = [];

        // Check if this document has already been processed
        if (processedDocuments.has(this.sourceDocument.absolutePath)) {
            return returnItems;
        }

        // Add the current document to the processed set
        processedDocuments.add(this.sourceDocument.absolutePath);

        if (this.isTheSame(document) || this.sourceDocument.absolutePath === document.sourceDocument.absolutePath) {
            returnItems.push(this);
        } else {
            this.imports.forEach(importedDoc => {
                returnItems = returnItems.concat(importedDoc.getDocumentsThatReference(document, processedDocuments));
            });

            if (returnItems.length > 0) {
                returnItems.push(this);
            }
        }

        return returnItems;
    }

    public addImportedDocument(document: ParsedDocument) {
        if (!this.importedDocuments.includes(document) && this !== document) {
            this.importedDocuments.push(document);
        }
    }

    public getAllContracts(): ParsedContract[] {
        let returnItems: ParsedContract[] = [];
        returnItems = returnItems.concat(this.innerContracts);
        this.importedDocuments.forEach(document => {
            returnItems = returnItems.concat(document.innerContracts);
        });
        return returnItems;
    }

    public getAllGlobalFunctions(): ParsedFunction[] {
        let returnItems: ParsedFunction[] = [];
        returnItems = returnItems.concat(this.functions);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.functions);
        });
        return returnItems;
    }

    public getAllGlobalErrors(): ParsedError[] {
        let returnItems: ParsedError[] = [];
        returnItems = returnItems.concat(this.errors);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.errors);
        });
        return returnItems;
    }

    public getAllGlobalStructs(): ParsedStruct[] {
        let returnItems: ParsedStruct[] = [];
        returnItems = returnItems.concat(this.structs);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.structs);
        });
        return returnItems;
    }

    public getAllGlobalEnums(): ParsedEnum[] {
        let returnItems: ParsedEnum[] = [];
        returnItems = returnItems.concat(this.enums);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.enums);
        });
        return returnItems;
    }

    public getAllGlobalConstants(): ParsedConstant[] {
        let returnItems: ParsedConstant[] = [];
        returnItems = returnItems.concat(this.constants);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.constants);
        });
        return returnItems;
    }

    public getAllGlobalEvents(): ParsedEvent[] {
        let returnItems: ParsedEvent[] = [];
        returnItems = returnItems.concat(this.events);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.events);
        });
        return returnItems;
    }

    public getAllGlobalCustomTypes(): ParsedCustomType[] {
        let returnItems: ParsedCustomType[] = [];
        returnItems = returnItems.concat(this.customTypes);
        this.importedDocuments.forEach(document => {
            returnItems = this.mergeArrays(returnItems, document.customTypes);
        });
        return returnItems;
    }

    public getAllGlobalUsing(type: ParsedDeclarationType, processedDocuments: Set<string> = new Set()): ParsedUsing[] {
        let returnItems: ParsedUsing[] = [];

        // Add the current document to the processed set
        processedDocuments.add(this.sourceDocument?.absolutePath);

        // Filter the 'using' declarations based on the specified type
        returnItems = returnItems.concat(this.usings.filter(x => {
            // existing filter logic
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

        // Process each imported document if not already processed
        this.importedDocuments.forEach(document => {
            if (!processedDocuments.has(document.sourceDocument?.absolutePath)) {
                returnItems = this.mergeArrays(returnItems, document.getAllGlobalUsing(type, processedDocuments));
            }
        });

        // Remove duplicate 'using' declarations
        return returnItems.filter((v, i, self) => {
            return self.findIndex(item => item.name === v.name) === i;
        });
    }

    public initialiseDocumentReferences(documents: ParsedDocument[]) {
        this.importedDocuments = [];
        this.imports.forEach(x => x.initialiseDocumentReference(documents));
        this.innerContracts.forEach(x => x.initialiseExtendContracts());
    }


    public initialiseDocument(documentElement: any, selectedElement: any = null, sourceDocument: SourceDocument, fixedSource: string = null) {
        this.element = documentElement;
        this.sourceDocument = sourceDocument;
        this.document = this;
        this.fixedSource = fixedSource;
        this.selectedElement = selectedElement;
        if (this.element !== undefined && this.element !== null) {
            this.initialiseVariablesMembersEtc(this.element, null, null);
        }

        documentElement.body.forEach(element => {

            if (element.type === 'ContractStatement' || element.type === 'LibraryStatement' || element.type === 'InterfaceStatement') {
                const contract = new ParsedContract();
                contract.initialise(element, this);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedContract = contract;
                }
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
                functionDocument.initialise(element, this, null, true);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedFunction = functionDocument;
                }
                this.functions.push(functionDocument);
            }

            if (element.type === 'ModifierDeclaration') {
                const functionDocument = new ParsedFunction();
                functionDocument.initialise(element, this, null, true);
                functionDocument.isModifier = true;
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedFunction = functionDocument;
                }
                this.functions.push(functionDocument);
            }

            if (element.type === 'EventDeclaration') {
                const eventDocument = new ParsedEvent();
                eventDocument.initialise(element, this, null, true);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedEvent = eventDocument;
                }
                this.events.push(eventDocument);
            }

            if (element.type === 'EnumDeclaration') {
                const enumDocument = new ParsedEnum();
                enumDocument.initialise(element, this, null, true);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedEnum = enumDocument;
                }
                this.enums.push(enumDocument);
            }

            if (element.type === 'StructDeclaration') {
                const struct = new ParsedStruct();
                struct.initialise(element, this, null, true);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedStruct = struct;
                }
                this.structs.push(struct);
            }

            if (element.type === 'TypeDeclaration') {
                const customType = new ParsedCustomType();
                customType.initialise(element, this, null, true);
                this.customTypes.push(customType);
            }

            if (element.type === 'ErrorDeclaration') {
                const documentError = new ParsedError();
                documentError.initialise(element, this, null, true);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedError = documentError;
                }
                this.errors.push(documentError);
            }

            if (element.type === 'UsingStatement') {
                const using = new ParsedUsing();
                using.initialise(element, this, null, true);
                if (this.matchesElement(selectedElement, element)) {
                    this.selectedUsing = using;
                }
                this.usings.push(using);
            }
        });

    }


    public findContractByName(name: string): ParsedContract {
        for (const contract of this.getAllContracts()) {
            if (contract.name === name) {
                return contract;
            }
        }
        return null;
    }

    public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        let results: FindTypeReferenceLocationResult[] = [];
        if (this.isCurrentElementedSelected(offset)) {
            this.functions.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.innerContracts.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.errors.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.events.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.structs.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.usings.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.customTypes.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.constants.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.imports.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
            this.expressions.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
        }
        return results;
    }

    public override getHover(): Hover {
        return null;
    }


    public override getSelectedItem(offset: number): ParsedCode {
        let selectedItem: ParsedCode = null;
        if (this.isCurrentElementedSelected(offset)) {
            let allItems: ParsedCode[] = [];
            allItems = allItems.concat(this.functions)
                .concat(this.innerContracts)
                .concat(this.errors)
                .concat(this.events)
                .concat(this.structs)
                .concat(this.usings)
                .concat(this.customTypes)
                .concat(this.constants)
                .concat(this.imports)
                .concat(this.expressions);

            for (const item of allItems) {
                if (item === null) { continue; }
                selectedItem = item.getSelectedItem(offset);
                if (selectedItem !== null) { return selectedItem; }

            }
            return this;
        }
        return selectedItem;
    }

    public override getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        let results: FindTypeReferenceLocationResult[] = [];
        this.functions.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.errors.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.events.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.innerContracts.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.structs.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.usings.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.customTypes.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.constants.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.imports.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));
        this.expressions.forEach(x => results = this.mergeArrays(results, x.getAllReferencesToObject(parsedCode)));

        return results;
    }

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        let results: FindTypeReferenceLocationResult[] = [];
        this.functions.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.errors.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.events.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.innerContracts.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.structs.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.usings.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.customTypes.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.constants.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.imports.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
        this.expressions.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));

        const foundResult = FindTypeReferenceLocationResult.filterFoundResults(results);
        if (foundResult.length > 0) {
            return foundResult;
        } else {
            return [FindTypeReferenceLocationResult.create(true)];
        }
    }

    public findType(name: string): ParsedCode {
        let typesParsed: ParsedCode[] = [];
        typesParsed = typesParsed.concat(this.getAllGlobalConstants())
            .concat(this.getAllGlobalCustomTypes())
            .concat(this.getAllGlobalStructs())
            .concat(this.getAllGlobalEnums())
            .concat(this.getAllContracts());
        return typesParsed.find(x => x.name === name);
    }

    public override getInnerMembers(): ParsedCode[] {
        let typesParsed: ParsedCode[] = [];
        typesParsed = typesParsed.concat(this.getAllGlobalConstants()).concat(this.getAllGlobalEnums()).concat(this.getAllGlobalCustomTypes());
        return typesParsed;
    }

    public findMembersInScope(name: string): ParsedCode[] {
        return this.getInnerMembers().filter(x => x.name === name);
    }

    public findMethodCalls(name: string): ParsedCode[] {
        let typesParsed: ParsedCode[] = [];
        typesParsed = typesParsed.concat(this.getAllGlobalFunctions()).concat(this.getAllGlobalErrors()).concat((this.getAllContracts()));
        return typesParsed.filter(x => x.name === name);
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
        this.getAllContracts().forEach(x => completionItems.push(x.createCompletionItem()));
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
            const variablesInScope = this.selectedFunction.findVariableDeclarationsInScope(offset);
            this.selectedFunction.input.forEach(parameter => {
                completionItems.push(parameter.createParamCompletionItem('function parameter', this.getGlobalPathInfo()));
            });
            this.selectedFunction.output.forEach(parameter => {
                completionItems.push(parameter.createParamCompletionItem('return parameter', this.getGlobalPathInfo()));
            });

            variablesInScope.forEach(variable => {
                completionItems.push(variable.createCompletionItem());
            });
        }
        return completionItems;
    }

    public initialiseVariablesMembersEtc(statement: any, parentStatement: any, child: ParsedExpression) {
        try {
            if (statement !== undefined && statement !== null && statement.type !== undefined && statement.type !== null) {
                switch (statement.type) {
                    case 'CallExpression': // e.g. Func(x, y)
                        const callExpression = ParsedExpression.createFromElement(statement, this, null, child, this);
                        this.expressions.push(callExpression);
                        break;
                    case 'MemberExpression': // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
                        const memberCreated = ParsedExpression.createFromMemberExpression(statement, this, null, child, this);
                        if (memberCreated !== undefined) {
                            this.expressions.push(memberCreated);
                        } else {
                            console.log(statement);
                        }
                        break;
                    case 'Identifier':
                        const identifier = ParsedExpression.createFromElement(statement, this, null, child, this);
                        this.expressions.push(identifier);
                        break;
                    case 'FunctionDeclaration':
                        break;
                    case 'ContractStatement':
                        break;
                    case 'LibraryStatement':
                        break;
                    case 'InterfaceStatement':
                        break;
                    default:
                        for (const key in statement) {
                            if (statement.hasOwnProperty(key)) {
                                const element = statement[key];
                                if (element instanceof Array) {
                                    // recursively drill down to collections e.g. statements, params
                                    element.forEach(innerElement => {
                                        this.initialiseVariablesMembersEtc(innerElement, statement, null);
                                    });
                                } else if (element instanceof Object) {
                                    // recursively drill down to elements with start/end e.g. literal type
                                    if (
                                        element.hasOwnProperty('start') && element.hasOwnProperty('end')
                                    ) {
                                        this.initialiseVariablesMembersEtc(
                                            element,
                                            statement,
                                            null,
                                        );
                                    }
                                }
                            }
                        }
                }
            }
        } catch (error) {
            console.log(error.message);
            console.log(error.stack);
        }
    }

    private matchesElement(selectedElement: any, element: any) {
        return selectedElement !== null && selectedElement === element;
    }
}

