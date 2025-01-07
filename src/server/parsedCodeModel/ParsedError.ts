import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedParameter } from './ParsedParameter';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind, DocumentSymbol, SymbolKind } from 'vscode-languageserver';


export class ParsedError extends ParsedCode {
    public input: ParsedParameter[] = [];
    public id: any;
    private completionItem: CompletionItem = null;

    public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
        super.initialise(element, document, contract, isGlobal);
        this.name = element.name;
        this.initialiseParamters();
        this.id = element.id;
    }

    public toDocumentSymbol(): DocumentSymbol {
            const errorRange = this.getRange();
            const errorSymbol = DocumentSymbol.create(
                this.name,
                this.getSimpleInfo(),
                SymbolKind.Class,
                errorRange,
                errorRange,
            );
            errorSymbol.children = this.input.map(param => param.toDocumentSymbolType('Input Parameter'));
            return errorSymbol;
        }

        public override getSimpleInfo(): string {
            const params = this.input
                .map(param => `${param.name}: ${param.type.getSimpleInfo()}`)
                .join(', ');
            return `Error ${this.name}(${params})`;
        }

    public initialiseParamters() {
        this.input = ParsedParameter.extractParameters(this.element.params, this.contract, this.document, this);
    }

    public override createCompletionItem(): CompletionItem {
        if (this.completionItem === null) {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Function;

        const paramsSnippet = ParsedParameter.createFunctionParamsSnippet(this.element.params, false);
        completionItem.insertTextFormat = 2;
        completionItem.insertText = this.name + '(' + paramsSnippet + ');';

        completionItem.documentation = this.getMarkupInfo();

        this.completionItem = completionItem;
    }
    return this.completionItem;
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            let results: FindTypeReferenceLocationResult[] = [];
            this.input.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
            const foundResult = FindTypeReferenceLocationResult.filterFoundResults(results);
            if (foundResult.length > 0) {
                return foundResult;
            } else {
                return [FindTypeReferenceLocationResult.create(true)];
            }
        }
            return [FindTypeReferenceLocationResult.create(false)];
    }

    public override getSelectedItem(offset: number): ParsedCode {
        let selectedItem: ParsedCode = null;
        if (this.isCurrentElementedSelected(offset)) {
           let allItems: ParsedCode[] = [];
           allItems = allItems.concat(this.input);
           selectedItem = allItems.find(x => x.getSelectedItem(offset));
           if (selectedItem !== undefined && selectedItem !== null) { return selectedItem; }
           return this;
        }
        return selectedItem;
    }

    public override getParsedObjectType(): string {
        return 'Error';
     }

     public override getInfo(): string {
         const elementType = this.getParsedObjectType();
        return    '### ' + elementType  + ': ' +  this.name + '\n' +
                  '#### ' + this.getContractNameOrGlobal() + '\n' +
                  '\t' +  this.getSignature() + ' \n\n' +
                  this.getComment();
      }

      public getDeclaration(): string {
         return 'error';
      }
      public getSignature(): string {
        const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
        return this.getDeclaration() + ' ' +  this.name + '(' + paramsInfo + ') \n\t\t';
      }


}
