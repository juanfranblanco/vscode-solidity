import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';
import { ParsedFunction } from './ParsedFunction';


export class ParsedModifierArgument extends ParsedCode {
    public functionParent: ParsedFunction;
    public params: any;

    public initialise(element: any, functionParent: ParsedFunction, document: ParsedDocument) {
        this.functionParent = functionParent;
        this.element = element;
        this.name = element.name;
        this.document = document;
    }

    public isPublic(): boolean {
        return this.name === 'public';
    }

    public isPrivate(): boolean {
        return this.name === 'private';
    }

    public isExternal(): boolean {
        return this.name === 'external';
    }

    public isInternal(): boolean {
        return this.name === 'internal';
    }

    public isView(): boolean {
        return this.name === 'pure';
    }

    public isPure(): boolean {
        return this.name === 'view';
    }

    public isPayeable(): boolean {
        return this.name === 'payeable';
    }

    public IsCustomModifier(): boolean {
        return !(this.isPublic() || this.isExternal() || this.isPrivate() || this.isView() || this.isPure() || this.isPayeable() || this.isInternal());
    }

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
        if (this.isCurrentElementedSelected(offset)) {
            const results: FindTypeReferenceLocationResult[] = [];
            if (this.IsCustomModifier()) {
                if (this.functionParent.isGlobal) {
                    const foundResults = this.document.findMethodCalls(this.name);
                    if (foundResults.length > 0) {
                        return FindTypeReferenceLocationResult.create(true, foundResults[0].getLocation());
                    }
                } else {
                    const foundResults = this.functionParent.contract.findMethodCalls(this.name);
                    if (foundResults.length > 0) {
                        return FindTypeReferenceLocationResult.create(true, foundResults[0].getLocation());
                    }
                }
            }
            return FindTypeReferenceLocationResult.create(true);
        }
        return FindTypeReferenceLocationResult.create(false);
    }
}
