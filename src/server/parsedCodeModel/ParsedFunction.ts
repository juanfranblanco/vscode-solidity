import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedParameter } from './ParsedParameter';
import { ParsedFunctionVariable } from './ParsedFunctionVariable';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind, Location } from 'vscode-languageserver';
import { ParsedModifierArgument } from './ParsedModifierArgument';

export class ParsedFunction extends ParsedCode {
    public input: ParsedParameter[] = [];
    public output: ParsedParameter[] = [];
    public modifiers: ParsedModifierArgument[] = [];
    public variablesInScope: ParsedFunctionVariable[] = [];
    public contract: ParsedContract;
    public isGlobal: boolean;
    public isModifier: boolean;

    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.document = document;
        this.isGlobal = isGlobal;
        this.initialiseParameters();
        this.initialiseModifiers();
    }

    public initialiseParameters() {
        this.input = ParsedParameter.extractParameters(this.element.params, this.contract, this.document, this);
        this.output = ParsedParameter.extractParameters(this.element.returnParams, this.contract, this.document, this);
    }

    public initialiseModifiers() {
        if (this.element.modifiers !== undefined && this.element.modifiers !== null) {
            this.element.modifiers.forEach(element => {
                const parsedModifier = new ParsedModifierArgument();
                parsedModifier.initialise(element, this, this.document);
                this.modifiers.push(parsedModifier);
        });
        }
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
        let closingSemi = ';';
        if (this.isModifier) {
            closingSemi = '';
        }

        completionItem.insertText = this.name + '(' + paramsSnippet + ')' + closingSemi;
        let functionType = 'Function';
        if (this.isModifier) {
            functionType = 'Modifier';
        }
        const info = '(' + functionType + ' in ' + contractName  + ') ' + this.name + '(' + paramsInfo + ')' + returnParamsInfo;
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
            this.modifiers.forEach(x => results.push(x.getSelectedTypeReferenceLocation(offset)));
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

    /*
    private provideDefinitionInStatement(
        document: TextDocument,
        documentStatements: Array<any>,
        statement: any,
        parentStatement: any,
        offset: number,
        contracts: SourceDocumentCollection,
      ): Location | Location[] {
        switch (statement.type) {
          case 'Type':
            // handle nested type and resolve to inner type when applicable e.g. mapping(uint => Struct)
            if (statement.literal instanceof Object && statement.literal.start <= offset && offset <= statement.literal.end) {
              return this.provideDefinitionInStatement(
                document,
                documentStatements,
                statement.literal,
                statement,
                offset,
                contracts,
              );
            } else {
              return this.provideDefinitionForType(
                document,
                documentStatements,
                statement,
                contracts,
              );
            }
          case 'Identifier':
            switch (parentStatement.type) {
              case 'CallExpression': // e.g. Func(x, y)
                if (parentStatement.callee === statement) {
                  // TODO: differentiate function, event, and struct construction
                  return this.provideDefinitionForCallee(
                    contracts,
                    statement.name,
                  );
                }
                break;
              case 'MemberExpression': // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
                if (parentStatement.object === statement) {
                  // NB: it is possible to have f(x).y but the object statement would not be an identifier
                  // therefore we can safely assume this is a variable instead
                  return this.provideDefinitionForVariable(
                    contracts,
                    statement.name,
                  );
                } else if (parentStatement.property === statement) {
                  return Promise.all([
                    // TODO: differentiate better between following possible cases
                    // TODO: provide field access definition, which requires us to know the type of object
                    // Consider find the definition of object first and recursive upward till declarative expression for type inference

                    // array or mapping access via variable i.e. arr[i] map[k]
                    this.provideDefinitionForVariable(
                      contracts,
                      statement.name,
                    ),
                    // func call in the form of obj.func(arg)
                    this.provideDefinitionForCallee(
                      contracts,
                      statement.name,
                    ),
                  ]).then(locationsArray => Array.prototype.concat.apply([], locationsArray));
                }
                break;
              default:
                return this.provideDefinitionForVariable(
                  contracts,
                  statement.name,
                );
            }
            break;
          default:
            for (const key in statement) {
              if (statement.hasOwnProperty(key)) {
                const element = statement[key];
                if (element instanceof Array) {
                  // recursively drill down to collections e.g. statements, params
                  const inner = this.findElementByOffset(element, offset);
                  if (inner !== undefined) {
                    return this.provideDefinitionInStatement(
                      document,
                      documentStatements,
                      inner,
                      statement,
                      offset,
                      contracts,
                    );
                  }
                } else if (element instanceof Object) {
                  // recursively drill down to elements with start/end e.g. literal type
                  if (
                    element.hasOwnProperty('start') && element.hasOwnProperty('end') &&
                    element.start <= offset && offset <= element.end
                  ) {
                    return this.provideDefinitionInStatement(
                      document,
                      documentStatements,
                      element,
                      statement,
                      offset,
                      contracts,
                    );
                  }
                }
              }
            }
            // handle modifier last now that params have not been selected
            if (statement.type === 'ModifierArgument') {
              return this.provideDefinitionForCallee(contracts, statement.name);
            }
            break;
        }
      }
        */



}
