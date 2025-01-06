import { DocumentSymbol, Location, Range, SymbolKind } from 'vscode-languageserver';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';
import { URI } from 'vscode-uri';


export class ParsedImport extends ParsedCode {
    public from: string;
    public documentReference: ParsedDocument = null;
    public resolvedImportPath: string = null;

    public initialise(element: any, document: ParsedDocument) {
        this.document = document;
        this.element = element;
        this.from = element.from;
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
             return [FindTypeReferenceLocationResult.create(true, this.getReferenceLocation())];
        }
        return [FindTypeReferenceLocationResult.create(false)];
   }

   public initialiseDocumentReference(parsedDocuments: ParsedDocument[]) {
        if(this.resolvedImportPath === null) {
            this.resolvedImportPath = this.document.sourceDocument.resolveImportPath(this.from);
        }
        for (let index = 0; index < parsedDocuments.length; index++) {
            const element = parsedDocuments[index];
            if (element.sourceDocument.absolutePath === this.resolvedImportPath) {
                this.documentReference = element;
                if (this.document.importedDocuments.indexOf(element) < 0) {
                    this.document.addImportedDocument(element);
                }
            }
        }
   }


   public getDocumentsThatReference(document: ParsedDocument, processedDocuments: Set<string> = new Set()): ParsedDocument[] {
        if (this.documentReference !== null) {
            return this.documentReference.getDocumentsThatReference(document, processedDocuments);
        }
        return [];
   }

   public getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            return this.getAllReferencesToObject(this.documentReference);
        }
        return [];
    }

    public getReferenceLocation(): Location {
        if(this.resolvedImportPath === null) {
            this.resolvedImportPath = this.document.sourceDocument.resolveImportPath(this.from);
        }
        // note: we can use the path to find the referenced source document too.
         return Location.create(
            URI.file(this.resolvedImportPath).toString(),
            Range.create(0, 0, 0, 0),
          );
    }

    public toDocumentSymbol(): DocumentSymbol {
        const importRange = this.getRange();
        // Display the import details
        const resolvedPath = this.getResolvedImportPath();
        const detail = `Import from: ${this.from}\nResolved to: ${resolvedPath}`;

        return DocumentSymbol.create(
            `import "${this.from}"`,
            detail, // Additional metadata
            SymbolKind.File, // Represent imports as files
            importRange,
            importRange,
        );
    }

    private getResolvedImportPath(): string {
        if (this.resolvedImportPath === null) {
            this.resolvedImportPath = this.document.sourceDocument.resolveImportPath(this.from);
        }
        return this.resolvedImportPath;
    }
}


