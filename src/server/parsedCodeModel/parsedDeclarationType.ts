import { ParsedDocument } from './ParsedDocument';
import { ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';

export class ParsedDeclarationType extends ParsedCode {
    public isArray: boolean;
    public isMapping: boolean;
    public parentTypeName: any = null;
    public type: ParsedCode = null;

    public static create(literal: any, contract: ParsedContract, document: ParsedDocument): ParsedDeclarationType {
        const declarationType = new ParsedDeclarationType();
        declarationType.initialise(literal, contract, document);
        return declarationType;
    }

    public initialise(literal: any, contract: ParsedContract, document: ParsedDocument) {
        this.contract = contract;
        this.document = document;
        this.element = literal;
        if (literal.members !== undefined && literal.members.length > 0) {
            this.name = literal.members[0];
            this.parentTypeName = literal.literal;
        } else {
            this.name = literal.literal;
        }
        this.isArray = literal.array_parts.length > 0;
        this.isMapping = false;
        const literalType = literal.literal;
        if (typeof literalType.type !== 'undefined')  {
             this.isMapping = literalType.type === 'MappingExpression';
             this.name = 'mapping'; // do something here
             // suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
        }
    }

    public override getInnerMembers(): ParsedCode[] {
        const type = this.findType();
        if (type === null || type === undefined) { return []; }
        return type.getInnerMembers();
    }

    public override getInnerMethodCalls() {
        const type = this.findType();
        if (type === null || type === undefined) {
            return [];
        }
        return type.getInnerMethodCalls();
    }

    public findType(): ParsedCode {
        if (this.type === null){
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

}
