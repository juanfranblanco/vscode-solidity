import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedParameter } from './ParsedParameter';
import { ParsedFunctionVariable } from './ParsedFunctionVariable';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind, Location } from 'vscode-languageserver';
import { ParsedModifierArgument } from './ParsedModifierArgument';
import { ParsedExpression } from './ParsedExpression';
import { IParsedExpressionContainer } from './IParsedExpressionContainer';

export class ParsedFunction extends ParsedCode implements IParsedExpressionContainer {
  public input: ParsedParameter[] = [];
  public output: ParsedParameter[] = [];
  public modifiers: ParsedModifierArgument[] = [];
  public isModifier: boolean;
  public variables: ParsedFunctionVariable[] = [];
  public expressions: ParsedExpression[] = [];

  public override getAllReferencesToSelected(offset: number): FindTypeReferenceLocationResult[] {
    let results: FindTypeReferenceLocationResult[] = [];
    if (this.isCurrentElementedSelected(offset)) {
      this.input.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset)));
      this.output.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset)));
      this.expressions.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset)));
      this.variables.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset)));
      this.modifiers.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset)));

      if (results.length === 0) {
        results = results.concat(this.getAllReferencesToThis());
      }
    }
    return results;
  }

  public override getAllReferencesToObject(parsedCode: ParsedCode): FindTypeReferenceLocationResult[] {
    let results: FindTypeReferenceLocationResult[] = [];
    if (this.isTheSame(parsedCode)) {
      results.push(this.createFoundReferenceLocationResult());
    }
    this.expressions.forEach(x => results = results.concat(x.getAllReferencesToObject(parsedCode)));
    this.input.forEach(x => results = results.concat(x.getAllReferencesToObject(parsedCode)));
    this.output.forEach(x => results = results.concat(x.getAllReferencesToObject(parsedCode)));
    this.variables.forEach(x => results = results.concat(x.getAllReferencesToObject(parsedCode)));
    this.modifiers.forEach(x => results = results.concat(x.getAllReferencesToObject(parsedCode)));

    return results;
  }

  public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
    super.initialise(element, document, contract, isGlobal);
    this.name = element.name;
    this.initialiseParameters();
    this.initialiseModifiers();
    if (this.element.body !== undefined && this.element.body !== null) {
      this.initialiseVariablesMembersEtc(this.element.body, null, null);
    }
  }

  public initialiseParameters() {
    this.input = ParsedParameter.extractParameters(this.element.params, this.contract, this.document, this);
    this.output = ParsedParameter.extractParameters(this.element.returnParams, this.contract, this.document, this);
  }

  public initialiseModifiers() {
    if (this.element.modifiers !== undefined && this.element.modifiers !== null) {
      this.element.modifiers.forEach(element => {
        const parsedModifier = new ParsedModifierArgument();
        parsedModifier.initialiseModifier(element, this, this.document);
        this.modifiers.push(parsedModifier);
      });
    }
  }


  public findVariableDeclarationsInScope(offset: number): ParsedFunctionVariable[] {
    let result: ParsedFunctionVariable[] = [];
    if (this.element.is_abstract === false || this.element.is_abstract === undefined) {
      if (this.element.body !== 'undefined' && this.element.body.type === 'BlockStatement') {
        result = result.concat(this.findVariableDeclarationsInInnerScope(offset, this.element.body));
      }
    }
    return result;
  }

  public findAllLocalAndGlobalVariablesByName(offset: number, name: string): ParsedCode[] {
    return this.findAllLocalAndGlobalVariables(offset).filter(x => x.name === name);
  }

  public findAllLocalAndGlobalVariables(offset: number): ParsedCode[] {
    const result: ParsedCode[] = [];
    return result.concat(this.findVariableDeclarationsInScope(offset))
      .concat(this.contract.getInnerMembers());
  }

  public override getInnerMembers(): ParsedCode[] {
    const result: ParsedCode[] = [];
    if (this.contract !== null) {
    return result.concat(this.variables)
      .concat(this.contract.getInnerMembers()).concat(this.input).concat(this.output);
    } else {
      return result.concat(this.variables)
      .concat(this.document.getInnerMembers()).concat(this.input).concat(this.output);
    }
  }

  public override findMembersInScope(name: string): ParsedCode[] {
    return this.getInnerMembers().filter(x => x.name === name);
  }


  public findVariableDeclarationsInInnerScope(offset: number, block: any): ParsedFunctionVariable[] {

    let result: ParsedFunctionVariable[] = [];
    if (block !== undefined && block !== null) {
      if (this.isElementedSelected(block, offset)) {
        if (block.body !== 'undefined') {
          block.body.forEach(blockBodyElement => {
            if (blockBodyElement.type === 'ExpressionStatement') {
              const expression = blockBodyElement.expression;
              const foundVar = this.createVariableInScopeFromExpression(expression);
              if (foundVar !== null) {
                result.push(foundVar);
              }
            }

            if (blockBodyElement.type === 'ForStatement') {
              if (this.isElementedSelected(blockBodyElement, offset)) {
                const foundVar = this.createVariableInScopeFromExpression(blockBodyElement.init);
                if (foundVar !== null) {
                  result.push(foundVar);
                }
                result = result.concat(this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.body));
              }
            }

            if (blockBodyElement.type === 'IfStatement') {
              if (this.isElementedSelected(blockBodyElement, offset)) {
                result = result.concat(this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.consequent));
                result = result.concat(this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.alternate));
              }
            }
          });
        }
      }

    }
    return result;
  }

  public createCompletionItem(skipFirstParamSnipppet = false): CompletionItem {

    const completionItem = CompletionItem.create(this.name);
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
    const info = '(' + functionType + ' in ' + contractName + ') ' + this.name + '(' + paramsInfo + ')' + returnParamsInfo;
    completionItem.documentation = info;
    completionItem.detail = info;
    return completionItem;
  }

  public override getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult[] {
    if (this.isCurrentElementedSelected(offset)) {
      let results: FindTypeReferenceLocationResult[] = [];
      this.input.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
      this.output.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
      this.variables.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
      this.modifiers.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));
      this.expressions.forEach(x => results = this.mergeArrays(results, x.getSelectedTypeReferenceLocation(offset)));

      const foundResult = FindTypeReferenceLocationResult.filterFoundResults(results);
      if (foundResult.length > 0) {
          return foundResult;
      } else {
        return [FindTypeReferenceLocationResult.create(true)];
      }
    }
    return [FindTypeReferenceLocationResult.create(false)];
  }


  public initialiseVariablesMembersEtc(statement: any, parentStatement: any, child: ParsedExpression) {
    try {

      if (statement !== undefined && statement.type !== undefined && statement.type !== null) {
        switch (statement.type) {
          case 'DeclarativeExpression':
            const variable = new ParsedFunctionVariable();
            variable.element = statement;
            variable.name = statement.name;
            variable.document = this.document;
            variable.type = ParsedDeclarationType.create(statement.literal, this.contract, this.document);
            variable.function = this;
            this.variables.push(variable);
            break;
          case 'CallExpression': // e.g. Func(x, y)
            const callExpression = ParsedExpression.createFromElement(statement, this.document, this.contract, child, this);
            this.expressions.push(callExpression);
            break;
          case 'MemberExpression': // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
            const memberCreated = ParsedExpression.createFromMemberExpression(statement, this.document, this.contract, child, this);
            if (memberCreated !== undefined) {
              this.expressions.push(memberCreated);
            } else {
              console.log(statement);
            }
            break;
          case 'Identifier':
            const identifier = ParsedExpression.createFromElement(statement, this.document, this.contract, child, this);
            this.expressions.push(identifier);
            break;
          default:
            for (const key in statement) {
              if (statement.hasOwnProperty(key)) {
                const element = statement[key];
                if (element instanceof Array) {
                  // recursively drill down to collections e.g. statements, params
                  element.forEach(innerElement => {
                    this.initialiseVariablesMembersEtc(innerElement, statement, null);
                  });

                } else if (element instanceof Object) {
                  // recursively drill down to elements with start/end e.g. literal type
                  if (
                    element.hasOwnProperty('start') && element.hasOwnProperty('end')
                  ) {
                    this.initialiseVariablesMembersEtc(
                      element,
                      statement,
                      null,
                    );
                  }
                }
              }
            }
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  private createVariableInScopeFromExpression(expression: any): ParsedFunctionVariable {
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
      return variable;
    }
    return null;
  }
}
