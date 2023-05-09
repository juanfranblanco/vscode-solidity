import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, Location, Range, TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { ParsedContract } from './parsedContract';

export class FindTypeReferenceLocationResult {
    public isCurrentElementSelected: boolean;
    public location: Location;
    public reference: ParsedCode;

    public static create(isSelected: boolean, location: Location = null, reference: ParsedCode = null) {
        const result = new FindTypeReferenceLocationResult();
        result.location = location;
        result.isCurrentElementSelected = isSelected;
        result.reference = reference;
        return result;
    }

    public static filterFoundResults(results: FindTypeReferenceLocationResult[]): FindTypeReferenceLocationResult[] {
        const foundResult = results.filter(x => x.isCurrentElementSelected === true);
        if (foundResult.length > 0) {
            const foundLocations = foundResult.filter(x => x.location !== null);
            if (foundLocations.length > 0) {
              return foundLocations;
            } else {
              return [FindTypeReferenceLocationResult.create(true)];
            }
        } else {
          return [];
        }
    }
}

export class ParsedCode {
    public element: any;
    public name: string;
    public document: ParsedDocument;
    public contract: ParsedContract = null;
    public isGlobal: boolean;

    public initialise(element: any, document: ParsedDocument, contract: ParsedContract = null, isGlobal = false) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal; // need to remove is global
        if (contract !== null && isGlobal === false) {
            this.isGlobal = true;
        }
    }

    public createFoundReferenceLocationResult(): FindTypeReferenceLocationResult {
        return FindTypeReferenceLocationResult.create(true, this.getLocation(), this);
    }

    public isTheSame(parsedCode: ParsedCode): boolean {
        return parsedCode === this;
    }

    public getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        }
    }

    public findElementByOffset(elements: Array<any>, offset: number): any {
        return elements.find(
          element => element.start <= offset && offset <= element.end,
        );
      }

    public isElementedSelected(element: any, offset: number): boolean {
        if (element !== undefined && element !== null) {
            if (element.start <= offset && offset <= element.end) {
                return true;
            }
        }
        return false;
    }

    public createCompletionItem(): CompletionItem {
        return null;
    }

    public isCurrentElementedSelected(offset: number): boolean {
        return this.isElementedSelected(this.element, offset);
    }

    public getLocation(): Location {
        const uri = URI.file(this.document.sourceDocument.absolutePath).toString();
        const document = TextDocument.create(uri, null, null, this.document.sourceDocument.unformattedCode);
        return Location.create(
            document.uri,
            Range.create(document.positionAt(this.element.start), document.positionAt(this.element.end)),
          );
    }

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {

            return  [FindTypeReferenceLocationResult.create(true)];

        }
        return [FindTypeReferenceLocationResult.create(false)];
    }

    public getAllReferencesToSelected(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            return this.getAllReferencesToThis();
        }
        return [];
    }

    public getAllReferencesToThis(): FindTypeReferenceLocationResult[] {
        const results: FindTypeReferenceLocationResult[] = [];
        results.push(FindTypeReferenceLocationResult.create(true, this.getLocation()));
        if (this.contract === null) {
            return results.concat(this.document.getAllReferencesToObject(this));
        } else {
            return results.concat(this.contract.getAllReferencesToObject(this));
        }
    }

    public findTypeInScope(name: string): ParsedCode {
        if (this.contract === null) {
            return this.document.findType(name);
        } else {
            return this.contract.findType(name);
        }
    }

    public findMethodsInScope(name: string): ParsedCode[] {
        if (this.contract === null) {
            return this.document.findMethodCalls(name);
        } else {
            return this.contract.findMethodCalls(name);
        }
    }

    public findMembersInScope(name: string): ParsedCode[] {
        if (this.contract === null) {
            return this.document.findMembersInScope(name);
        } else {
            return this.contract.findMembersInScope(name);
        }
    }

    public getInnerCompletionItems(): CompletionItem[] {
        return [];
    }

    public getInnerMembers(): ParsedCode[] {
        return [];
    }

    public getInnerMethodCalls(): ParsedCode[] {
        return [];
    }

    protected mergeArrays<Type>(first: Type[], second: Type[]): Type[] {
        for (let i = 0; i < second.length; i++) {
            if (first.indexOf(second[i]) === -1) {
            first.push(second[i]);
            }
        }
        return first;
    }
}
