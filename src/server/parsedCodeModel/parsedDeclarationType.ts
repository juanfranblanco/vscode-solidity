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
    public mappingValueType: string = null;
    public mappingKeyType: string = null;

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
             this.name = 'mapping'; // 保持语义正确
             // Extract key and value types from mapping expression
             if (this.isMapping) {
                 this.mappingKeyType = this.getTypeString(literalType.from);
                 this.mappingValueType = this.getTypeString(literalType.to);
             }
             // suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
        }
    }

    private getTypeString(literal: any): string {
        if (typeof literal === 'string') {
            return literal;
        }

        if (literal && typeof literal.literal !== 'undefined') {
            return literal.literal;
        }

        if (literal && typeof literal.name !== 'undefined') {
            return literal.name;
        }

        return 'unknown';
    }

    public override getInnerCompletionItems(): CompletionItem[] {
        const result: CompletionItem[] = [];
        this.getExtendedMethodCallsFromUsing().forEach(x => result.push(x.createCompletionItem()));

        // 对于映射类型，返回值类型的自动补全项
        if (this.isMapping && this.mappingValueType !== null) {
            const valueType = this.findTypeInScope(this.mappingValueType);
            if (valueType !== null && valueType !== undefined) {
                return result.concat(valueType.getInnerCompletionItems());
            }
        }

        const type = this.findType();
        if (type === null || type === undefined) {
            return result;
        }
        return result.concat(type.getInnerCompletionItems());
    }

    public override getInnerMembers(): ParsedCode[] {
        // 对于映射类型，返回值类型的成员
        if (this.isMapping && this.mappingValueType !== null) {
            const valueType = this.findTypeInScope(this.mappingValueType);
            if (valueType !== null && valueType !== undefined) {
                return valueType.getInnerMembers();
            }
        }

        const type = this.findType();
        if (type === null || type === undefined) { return []; }
        return type.getInnerMembers();
    }

    public override getInnerMethodCalls(): ParsedCode[] {
        let result: ParsedCode[] = [];
        result = result.concat(this.getExtendedMethodCallsFromUsing());

        // 对于映射类型，返回值类型的方法调用
        if (this.isMapping && this.mappingValueType !== null) {
            const valueType = this.findTypeInScope(this.mappingValueType);
            if (valueType !== null && valueType !== undefined) {
                return result.concat(valueType.getInnerMethodCalls());
            }
        }

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

    public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            const type = this.findType();
            return type.getAllReferencesToThis(documents);
        }
        return [];
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

    public getInfo(): string {
        let returnString = '';
        if (this.isArray) { returnString = '### Array \n'; }
        if (this.isMapping) {
            returnString = '### Mapping (' + this.mappingKeyType + ' => ' + this.mappingValueType + ') \n';
        }
        const type = this.findType();
        if (this.type != null) {
            return returnString + type.getInfo();
        }
        return returnString + '### ' + this.name;
    }

    public override getSimpleInfo(): string {
        let returnString = '';
        if (this.isArray) { returnString = 'Array:'; }
        if (this.isMapping) { returnString = 'Mapping:'; }
        const type = this.findType();
        if (this.type != null) {
            return returnString + type.getSimpleInfo();
        }
        return returnString + ' ' + this.name;
    }

}
