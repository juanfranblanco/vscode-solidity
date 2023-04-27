
import { ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedContract } from './parsedContract';
import { ParsedDocument } from './ParsedDocument';

export class ParsedUsing extends ParsedCode {
    public for: ParsedDeclarationType;
    public forStar = false;
    public contract: ParsedContract;
    public isGlobal: boolean;

    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.library;
        this.document = document;
        this.isGlobal = isGlobal;

        if (element.for === '*') {
            this.forStar = true;
            this.for = null;
        } else {
            this.for = ParsedDeclarationType.create(element.for);
        }
    }
}


