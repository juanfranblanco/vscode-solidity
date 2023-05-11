import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedStructVariable } from './ParsedStructVariable';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind, Location } from 'vscode-languageserver';

export class ParsedStruct extends ParsedCode {
    public properties: ParsedStructVariable[] = [];
    public id: any;

    public initialise(element: any, document: ParsedDocument,  contract: ParsedContract, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.id = element.id;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal;

        if (this.element.body !== 'undefined') {
            this.element.body.forEach(structBodyElement => {
                if (structBodyElement.type === 'DeclarativeExpression') {
                    const variable = new ParsedStructVariable();
                    variable.initialiseStructVariable(structBodyElement, this.contract, this.document, this);
                    this.properties.push(variable);
                }
            });
        }
    }

    public getInnerMembers(): ParsedCode[] {
        return this.properties;
    }

    public getVariableSelected(offset: number) {
       return this.properties.find(x => {
            return x.isCurrentElementedSelected(offset);
        });
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
             const variableSelected = this.getVariableSelected(offset);
              if (variableSelected !== undefined) {
                  return variableSelected.getSelectedTypeReferenceLocation(offset);
              } else {
                  return [FindTypeReferenceLocationResult.create(true)];
              }
        }
        return [FindTypeReferenceLocationResult.create(false)];
    }

    public createCompletionItem(): CompletionItem {
        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Enum;
        let contractName = '';
        if (!this.isGlobal) {
            contractName = this.contract.name;
        } else {
            contractName = this.document.getGlobalPathInfo();
        }
        completionItem.insertText = this.name;
        completionItem.detail = '(Struct in ' + contractName + ') '
                                            + this.name;
        return completionItem;
    }

    public override getInnerCompletionItems(): CompletionItem[] {
        const completionItems: CompletionItem[] = [];
        this.properties.forEach(x =>  completionItems.push(x.createCompletionItem()));
        return completionItems;
    }

    public getAllReferencesToSelected(offset: number): FindTypeReferenceLocationResult[] {
        if (this.isCurrentElementedSelected(offset)) {
            if (this.isElementedSelected(this.id, offset)) {
                return this.getAllReferencesToThis();
              }
            const selectedProperty = this.getSelectedProperty(offset);
            if (selectedProperty !== undefined) {
                return selectedProperty.getAllReferencesToThis();
            } else {
                return this.getAllReferencesToThis();
            }
        }
        return [];
    }

    public getSelectedProperty(offset: number) {
        return this.properties.find(x => x.isCurrentElementedSelected(offset));
    }
}
