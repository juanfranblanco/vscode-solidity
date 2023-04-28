import { ParsedDocument } from './ParsedDocument';
import { Location, Range, TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

export class FindTypeReferenceLocationResult {
    public isCurrentElementSelected: boolean;
    public location: Location;

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

    public isElementedSelected(element: any, offset: number): boolean {
        if (element !== undefined && element !== null) {
            if (element.start <= offset && offset <= element.end) {
                return true;
            }
        }
        return false;
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
}
