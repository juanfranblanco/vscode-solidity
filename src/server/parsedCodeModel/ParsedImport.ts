import { Location, Range } from 'vscode-languageserver';
import { ParsedCode } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';
import { URI } from 'vscode-uri';


export class ParsedImport extends ParsedCode {
    public document: ParsedDocument;
    public from: string;

    public initialise(element: any, document: ParsedDocument) {
        this.document = document;
        this.element = element;
        this.from = element.from;
    }

    public getReferenceLocation(): Location {
        const path = this.document.sourceDocument.resolveImportPath(this.from);
        // note: we can use the path to find the referenced source document too.
         return Location.create(
            URI.file(path).toString(),
            Range.create(0, 0, 0, 0),
          );
    }
}


