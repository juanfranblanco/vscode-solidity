
import { ParsedCode } from './parsedCode';

export class ParsedDeclarationType extends ParsedCode {
    public isArray: boolean;
    public isMapping: boolean;
    public static create(literal: any): ParsedDeclarationType {
        const declarationType = new ParsedDeclarationType();
        declarationType.initialise(literal);
        return declarationType;
    }

    public initialise(literal: any) {
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
}



