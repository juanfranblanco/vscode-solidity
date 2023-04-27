import { ParsedCode } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';


export class ParsedImport extends ParsedCode {
    public document: ParsedDocument;
    public from: string;
    public initialise(element: any, document: ParsedDocument) {
        this.document = document;
        this.element = element;
        this.from = element.from;
    }
}


