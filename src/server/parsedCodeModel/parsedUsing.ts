
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedContract } from './parsedContract';
import { ParsedDocument } from './ParsedDocument';

export class ParsedUsing extends ParsedCode {
    public for: ParsedDeclarationType;
    public forStar = false;

    public initialise(element: any,  document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.library.literal;
        this.document = document;
        this.isGlobal = isGlobal;

        if (element.for === '*') {
            this.forStar = true;
            this.for = null;
        } else {
            this.for = ParsedDeclarationType.create(element.for, this.contract, this.document);
        }
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
             if (this.for !== null) {
                const foundType = this.for.findType();
                if (foundType !== undefined) {
                    return [FindTypeReferenceLocationResult.create(true, foundType.getLocation())];
                }
               return [FindTypeReferenceLocationResult.create(true)];
             }
        }
        return [FindTypeReferenceLocationResult.create(false)];
   }
}


