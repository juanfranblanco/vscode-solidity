import { CompletionItem } from 'vscode-languageserver';
import { ParsedDocument } from './ParsedDocument';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';
import { ParsedUsing } from './parsedUsing';

export class ParsedDeclarationType extends ParsedCode {
    public isArray: boolean;
    public isMapping: boolean;
    public parentTypeName: any = null;
    public type: ParsedCode = null;

    public static create(literal: any, contract: ParsedContract, document: ParsedDocument): ParsedDeclarationType {
        const declarationType = new ParsedDeclarationType();
        declarationType.initialise(literal, document, contract);
        return declarationType;
    }

    public override initialise(element: any,  document: ParsedDocument, contract: ParsedContract, isGlobal = false) {
        super.initialise(element, document, contract, isGlobal);
        if (element.members !== undefined && element.members.length > 0) {
            this.name = element.members[0];
            this.parentTypeName = element.literal;
        } else {
            if (element.literal.literal !== undefined ) {
                this.name = element.literal.literal;
            } else {
            this.name = element.literal;
            }
        }
        this.isArray = element.array_parts.length > 0;
        this.isMapping = false;
        const literalType = element.literal;
        if (typeof literalType.type !== 'undefined')  {
             this.isMapping = literalType.type === 'MappingExpression';
             this.name = 'mapping'; // do something here
             // suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
        }
    }

    public override getInnerCompletionItems(): CompletionItem[] {
        const result: CompletionItem[] = [];
        this.getExtendedMethodCallsFromUsing().forEach(x => result.push(x.createCompletionItem()));
        const type = this.findType();
        if (type === null || type === undefined) {
            return result;
        }
        return result.concat(type.getInnerCompletionItems());
    }

    public override getInnerMembers(): ParsedCode[] {
        const type = this.findType();
        if (type === null || type === undefined) { return []; }
        return type.getInnerMembers();
    }

    public override getInnerMethodCalls(): ParsedCode[] {
        let result: ParsedCode[] = [];
        result = result.concat(this.getExtendedMethodCallsFromUsing());
        const type = this.findType();
        if (type === null || type === undefined) {
            return result;
        }
        return result.concat(type.getInnerMethodCalls());
    }

    public getExtendedMethodCallsFromUsing(): ParsedCode[] {

       let usings: ParsedUsing[] = [];
       if (this.contract !== null) {
        usings = this.contract.getAllUsing(this);
       } else {
        usings = this.document.getAllGlobalUsing(this);
       }

       let result: ParsedCode[] = [];
       usings.forEach(usingItem => {
        const foundLibrary = this.document.getAllContracts().find(x => x.name === usingItem.name);
        if (foundLibrary !== undefined) {
            const allfunctions = foundLibrary.getAllFunctions();
            const filteredFunctions = allfunctions.filter( x => {
                    if (x.input.length > 0 ) {
                        const typex = x.input[0].type;
                        let validTypeName = false;
                        if (typex.name === this.name || (this.name === 'address_payable' && typex.name === 'address')) {
                            validTypeName = true;
                        }
                        return typex.isArray === this.isArray && validTypeName && typex.isMapping === this.isMapping;
                    }
                    return false;
                });
            result = result.concat(filteredFunctions);
        }
    });
    return result;
    }

    public findType(): ParsedCode {
        if (this.type === null) {
        if (this.parentTypeName !== null) {
            const parentType = this.findTypeInScope(this.parentTypeName);
            if (parentType !== undefined) {
                this.type = parentType.findTypeInScope(this.name);
            }
        } else {
            this.type = this.findTypeInScope(this.name);
        }
        }
        return this.type;
    }

    public override getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        }
        const type = this.findType();
        if (this.type != null && this.type.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        }
        return [];
    }

}
