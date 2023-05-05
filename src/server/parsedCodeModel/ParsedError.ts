import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedParameter } from './ParsedParameter';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';


export class ParsedError extends ParsedCode {

    public input: ParsedParameter[] = [];
    public contract: ParsedContract;
    public isGlobal: boolean;

    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.isGlobal = isGlobal;
        this.document = document;
        this.initialiseParamters();
    }

    public initialiseParamters() {
        this.input = ParsedParameter.extractParameters(this.element.params, this.contract, this.document, this);
    }

    public override createCompletionItem(): CompletionItem {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Function;
        // completionItem.insertText = contractName + '.' + contractElement.name;

        const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
        const paramsSnippet = ParsedParameter.createFunctionParamsSnippet(this.element.params, false);
        completionItem.insertTextFormat = 2;
        let contractName = '';
        if (!this.isGlobal) {
            contractName = this.contract.name;
        } else {
            contractName = this.document.getGlobalPathInfo();
        }
        completionItem.insertText = this.name + '(' + paramsSnippet + ');';
        const info = '(Error in ' + contractName + ') ' + this.name + '(' + paramsInfo + ')';
        completionItem.documentation = info;
        completionItem.detail = info;
        return completionItem;
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

}
