
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedContract } from './parsedContract';
import { ParsedDocument } from './ParsedDocument';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver';

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
                    return [foundType.createFoundReferenceLocationResult()];
                }
               return [this.createFoundReferenceLocationResultNoLocation()];
             }
        }
        return [this.createNotFoundReferenceLocationResult()];
   }

   public toDocumentSymbol(): DocumentSymbol {
    const usingRange = this.getRange();

    // Detail about the `for` type or `*` for global applicability
    const forTypeDetail = this.forStar
        ? 'for *'
        : `for ${this.for?.name || 'unknown'}`;

    return DocumentSymbol.create(
        `using ${this.name} ${forTypeDetail}`, // Display name in Outline view
        `Library: ${this.name}, ${forTypeDetail}`, // Additional details
        SymbolKind.Namespace, // `using` is closely related to a namespace
        usingRange,
        usingRange,
    );
}
}


