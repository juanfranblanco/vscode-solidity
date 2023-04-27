
import { ParsedDocument } from './ParsedDocument';
import { ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';

export class ParsedDeclarationType extends ParsedCode {
    public isArray: boolean;
    public isMapping: boolean;
    public contract: ParsedContract = null;

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

    public findType(): ParsedCode {
        if (this.contract === null) {
            return this.document.findType(this.name);
        } else {
            return this.contract.findType(this.name);
        }
    }
}



