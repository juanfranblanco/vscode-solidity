import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDocument } from './ParsedDocument';
import { ParsedFunction } from './ParsedFunction';


export class ParsedModifierArgument extends ParsedCode {
    public functionParent: ParsedFunction;
    public params: any;

    public initialiseModifier(element: any, functionParent: ParsedFunction, document: ParsedDocument) {
        this.functionParent = functionParent;
        this.contract = functionParent.contract;
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

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            const results: FindTypeReferenceLocationResult[] = [];
            if (this.IsCustomModifier()) {
                const foundResults =  this.findMethodsInScope(this.name);
                    if (foundResults.length > 0) {
                        foundResults.forEach(x => {
                                results.push(FindTypeReferenceLocationResult.create(true, x.getLocation()));
                            });
                    }
                return results;
            }
            return [FindTypeReferenceLocationResult.create(true)];
        }
        return [FindTypeReferenceLocationResult.create(false)];
    }

    public getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.IsCustomModifier()) {
            if (parsedCode instanceof ParsedFunction) {
                const functModifider = <ParsedFunction>parsedCode;
                if (functModifider.isModifier && functModifider.name === this.name) {
                    return [this.createFoundReferenceLocationResult()];
                }
            }
        }
        return [];
    }

    public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            let results: FindTypeReferenceLocationResult[] = [];
            if (this.IsCustomModifier()) {
                const foundResults =  this.findMethodsInScope(this.name);
                foundResults.forEach(x => results = results.concat(x.getAllReferencesToThis(documents)));
                return results;
            }
        }
        return [];
    }

    public override getParsedObjectType(): string {
        return 'Modifier Argument';
    }

    public override getInfo(): string {

        if (this.IsCustomModifier()) {
            const foundResults =  this.findMethodsInScope(this.name);
            if (foundResults.length > 0 ) {
             return '### ' + this.getParsedObjectType()  + ': ' +  this.name + '\n' +
                  '#### ' + this.functionParent.getParsedObjectType() + ': ' + this.functionParent.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  '### Type Info: \n' +
                  foundResults[0].getInfo() + '\n';
            }

        return    '### ' + this.getParsedObjectType()  + ': ' +  this.name + '\n' +
                  '#### ' + this.functionParent.getParsedObjectType() + ': ' + this.functionParent.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' 
        }
    }

}
