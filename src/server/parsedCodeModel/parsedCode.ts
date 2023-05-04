import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, Location, Range, TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { ParsedContract } from './parsedContract';

export class FindTypeReferenceLocationResult {
    public isCurrentElementSelected: boolean;
    public location: Location | Location[];

    public static create(isSelected: boolean, location: Location = null) {
        const result = new FindTypeReferenceLocationResult();
        result.location = location;
        result.isCurrentElementSelected = isSelected;
        return result;
    }
}

export class ParsedCode {
    public element: any;
    public name: string;
    public document: ParsedDocument;
    public contract: ParsedContract = null;

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

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
        if (this.isCurrentElementedSelected(offset)) {

            return FindTypeReferenceLocationResult.create(true);

        }
        return FindTypeReferenceLocationResult.create(false);
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
}
