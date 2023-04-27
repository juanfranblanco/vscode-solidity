import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedParameter } from './ParsedParameter';
import { ParsedFunctionVariable } from './ParsedFunctionVariable';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';




export class ParsedFunction extends ParsedCode {
    public input: ParsedParameter[] = [];
    public output: ParsedParameter[] = [];
    public variablesInScope: ParsedFunctionVariable[] = [];
    public contract: ParsedContract;
    public isGlobal: boolean;

    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal;
        this.initialiseParamters();
    }
    public initialiseParamters() {
        this.input = ParsedParameter.extractParameters(this.element.params, this.contract, this.document, this);
        this.output = ParsedParameter.extractParameters(this.element.returnParams, this.contract, this.document, this);
    }

    public findVariableDeclarationsInScope(offset: number) {

        if (this.element.is_abstract === false || this.element.is_abstract === undefined) {
            if (this.element.body !== 'undefined' && this.element.body.type === 'BlockStatement') {
                this.findVariableDeclarationsInInnerScope(offset, this.element.body);
            }
        }
    }

    public findVariableDeclarationsInInnerScope(offset: number, block: any) {

        if (block !== undefined && block !== null) {
            if (this.isElementedSelected(block, offset)) {
                if (block.body !== 'undefined') {
                    block.body.forEach(blockBodyElement => {
                        if (blockBodyElement.type === 'ExpressionStatement') {
                            const expression = blockBodyElement.expression;
                            this.addVariableInScopeFromExpression(expression);
                        }

                        if (blockBodyElement.type === 'ForStatement') {
                            if (this.isElementedSelected(blockBodyElement, offset)) {
                                this.addVariableInScopeFromExpression(blockBodyElement.init);
                                this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.body);
                            }
                        }

                        if (blockBodyElement.type === 'IfStatement') {
                            if (this.isElementedSelected(blockBodyElement, offset)) {
                                this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.consequent);
                                this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.alternate);
                            }
                        }
                    });
                }
            }

        }
    }

    public createCompletionItem(skipFirstParamSnipppet = false): CompletionItem {

        const completionItem =  CompletionItem.create(this.name);
        completionItem.kind = CompletionItemKind.Function;
        const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
        const paramsSnippet = ParsedParameter.createFunctionParamsSnippet(this.element.params, skipFirstParamSnipppet);
        let returnParamsInfo = ParsedParameter.createParamsInfo(this.element.returnParams);
        if (returnParamsInfo !== '') {
            returnParamsInfo = ' returns (' + returnParamsInfo + ')';
        }
        let contractName = '';
        if (!this.isGlobal) {
            contractName = this.contract.name;
        } else {
            contractName = this.document.getGlobalPathInfo();
        }
        completionItem.insertTextFormat = 2;
        completionItem.insertText = this.name + '(' + paramsSnippet + ');';
        const info = '(Function in ' + contractName  + ') ' + this.name + '(' + paramsInfo + ')' + returnParamsInfo;
        completionItem.documentation = info;
        completionItem.detail = info;
        return completionItem;
    }

    public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
        if (this.isCurrentElementedSelected(offset)) {
            const results: FindTypeReferenceLocationResult[] = [];
            this.input.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.output.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            this.findVariableDeclarationsInScope(offset);
            this.variablesInScope.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
            // TODO method calls and everything else variables is a small workaround
            const foundResult = results.find(x => x.isCurrentElementSelected === true);
            if (foundResult === undefined) {
                return FindTypeReferenceLocationResult.create(true);
            } else {
                return foundResult;
            }
        }
        return FindTypeReferenceLocationResult.create(false);
   }

    private addVariableInScopeFromExpression(expression: any) {
        let declarationStatement = null;
        if (expression.type === 'AssignmentExpression') {
            if (expression.left.type === 'DeclarativeExpression') {
                declarationStatement = expression.left;
            }
        }

        if (expression.type === 'DeclarativeExpression') {
            declarationStatement = expression;
        }

        if (declarationStatement !== null) {
            const variable = new ParsedFunctionVariable();
            variable.element = declarationStatement;
            variable.name = declarationStatement.name;
            variable.document = this.document;
            variable.type = ParsedDeclarationType.create(declarationStatement.literal, this.contract, this.document);
            variable.function = this;
            this.variablesInScope.push(variable);
        }
    }




}
