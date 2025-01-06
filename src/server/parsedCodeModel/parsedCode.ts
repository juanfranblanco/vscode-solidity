import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, Location, Range, Position, Hover, MarkupKind, MarkupContent } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { ParsedContract } from './parsedContract';
import { HoverFeature } from 'vscode-languageclient/lib/common/hover';

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
    public name = '';
    public document: ParsedDocument;
    public contract: ParsedContract = null;
    public isGlobal: boolean;
    public supportsNatSpec = true;
    public comment: string = null;

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

    public getHover(): Hover {
        const doc: MarkupContent = this.getMarkupInfo();
        return {
            contents: doc,
        }; }

    public getMarkupInfo(): MarkupContent {
        return {
            kind: MarkupKind.Markdown,
            value: this.getInfo(),
        };
    }

    public getInfo(): string {
        return '### ' + this.name + '\n' + this.getComment();
    }

    public getSelectedItem(offset: number): ParsedCode {
        if (this.isCurrentElementedSelected(offset)) { return this; }
        return null;
    }

    public generateNatSpec(): string {
        return null;
    }

   public isCommentLine(document: TextDocument, line: number): boolean {
        if (line === 0) {
            return false;
        }
        const txt: string = document.getText(this.getLineRange(line)).trimStart();
        if (!txt.startsWith('///') && !txt.startsWith('*') &&
            !txt.startsWith('/**') && !txt.startsWith('/*!') && !txt.startsWith('*/') ) {
            return false;
        } else {
            return true;
        }
    }

    public extractContractName(text: string): string | null {
        const pattern = /@inheritdoc\s+(\w+)/;
        const matches = text.match(pattern);
    
        if (matches && matches.length > 1) {
            // The second element in the array will be the contract/interface name
            return matches[1];
        }
    
        return null;
    }

    public getLineRange(lineNumber: number){
        return Range.create(Position.create(lineNumber, 0), Position.create(lineNumber + 1, 0));
    }

    public getContractNameOrGlobal(): string {
        if (this.contract != null) {
            return this.contract.getContractTypeName(this.contract.contractType) + ': ' + this.contract.name;
          } else {
           return 'Global';
        }
    }



    public getComment(): string {
        if (this.comment === null && this.supportsNatSpec) {
            const uri = URI.file(this.document.sourceDocument.absolutePath).toString();
            const document = TextDocument.create(uri, null, null, this.document.sourceDocument.unformattedCode);
            const position = document.positionAt(this.element.start);
            let comment = '';
            let currentLine = position.line - 1;
            while (this.isCommentLine(document, currentLine)) {
                let lineText = document.getText(this.getLineRange(currentLine)).trimStart()
                
                currentLine = currentLine - 1;
                let contractName = this.extractContractName(lineText);
                if(contractName && this.contract !== null) {
                    comment = '\t' + lineText + this.contract.getInheritedComment(this.name, contractName) + comment;
                } else {
                    comment = '\t' + lineText + comment;
                }
            }
            this.comment = comment;
         }
        return this.comment;
    }

    public createFoundReferenceLocationResult(): FindTypeReferenceLocationResult {
        return FindTypeReferenceLocationResult.create(true, this.getLocation(), this);
    }

    public createNotFoundReferenceLocationResult(): FindTypeReferenceLocationResult {
        return FindTypeReferenceLocationResult.create(false);
    }

    public createFoundReferenceLocationResultNoLocation(): FindTypeReferenceLocationResult {
        return FindTypeReferenceLocationResult.create(true, null, this);
    }

    public isTheSame(parsedCode: ParsedCode): boolean {
        try {
        const sameObject =  parsedCode === this;
        const sameDocReference =
        (this.document.sourceDocument.absolutePath === parsedCode.document.sourceDocument.absolutePath
            && this.name === parsedCode.name && this.element.start === parsedCode.element.start && this.element.end === parsedCode.element.end);
            return sameObject || sameDocReference;
        } catch(error) {
            // console.log(error);
        }
    }

    public getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
        if (this.isTheSame(parsedCode)) {
            return [this.createFoundReferenceLocationResult()];
        }
        return [];
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

    public getRange(): Range {
        const uri = URI.file(this.document.sourceDocument.absolutePath).toString();
        const document = TextDocument.create(uri, null, null, this.document.sourceDocument.unformattedCode);
        return Range.create(document.positionAt(this.element.start), document.positionAt(this.element.end));
    }

    public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {

            return  [FindTypeReferenceLocationResult.create(true)];

        }
        return [FindTypeReferenceLocationResult.create(false)];
    }

    public getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            return this.getAllReferencesToThis(documents);
        }
        return [];
    }

    public getAllReferencesToThis(documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
        let results: FindTypeReferenceLocationResult[] = [];
        results.push(this.createFoundReferenceLocationResult());
        let documentsToSearch: ParsedDocument[] = [];
    
        documents.forEach(x => {
            documentsToSearch.push(...x.getDocumentsThatReference(this.document));
        });
        documentsToSearch = [...new Set(documentsToSearch)];
    
        documentsToSearch.forEach(x => {
            results.push(...x.getAllReferencesToObject(this));
        });
    
        return results;
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

    public getParsedObjectType(): string {
       return '';
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
