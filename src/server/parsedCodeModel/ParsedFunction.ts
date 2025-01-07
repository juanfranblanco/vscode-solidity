import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedParameter } from './ParsedParameter';
import { ParsedFunctionVariable } from './ParsedFunctionVariable';
import { ParsedDocument } from './ParsedDocument';
import { CompletionItem, CompletionItemKind, DocumentSymbol, Location, SymbolKind } from 'vscode-languageserver';
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
  public isConstructor = false;
  public isFallback = false;
  public isReceive = false;
  public id: any;
  private completionItem: CompletionItem = null;

  public override getAllReferencesToSelected(offset: number, documents: ParsedDocument[]): FindTypeReferenceLocationResult[] {
    let results: FindTypeReferenceLocationResult[] = [];
    if (this.isCurrentElementedSelected(offset)) {
      this.input.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
      this.output.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
      this.expressions.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
      this.variables.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));
      this.modifiers.forEach(x => results = results.concat(x.getAllReferencesToSelected(offset, documents)));

      if (results.length === 0) {
        if (this.isElementedSelected(this.id, offset)) {
          return this.getAllReferencesToThis(documents);
        }
      }
    }
    return results;
  }

  public override getSelectedItem(offset: number): ParsedCode {
    let selectedItem: ParsedCode = null;
    if (this.isCurrentElementedSelected(offset)) {
       let allItems: ParsedCode[] = [];
       allItems = allItems.concat(this.input)
                          .concat(this.output)
                          .concat(this.expressions)
                          .concat(this.variables)
                          .concat(this.modifiers);
       for (const item of allItems) {
          if(item === null) { continue; }
          selectedItem = item.getSelectedItem(offset);
          if (selectedItem !== null) { return selectedItem; }
        }
       return this;
    }
    return selectedItem;
  }

  public toDocumentSymbol(): DocumentSymbol {
    const functionRange = this.getRange();
    const functionSymbol = DocumentSymbol.create(
      this.name || this.getParsedObjectType(),
      this.getSimpleInfo(),
      this.getSymbolKind(),
      functionRange,
      functionRange,
    );

    functionSymbol.children = [
      ...this.input.map(param => param.toDocumentSymbolType('Input Parameter')),
      ...this.output.map(param => param.toDocumentSymbolType('Output Parameter')),
      ...this.variables.map(variable => variable.toDocumentSymbolType()),
    ];
    return functionSymbol;
  }

  public getSimpleInfo(): string {
    const params = this.input.map(param => `${param.name}: ${param.type.getSimpleInfo()}`).join(', ');
    const returns = this.output.map(param => param.type.getSimpleInfo()).join(', ');
    const modifiers = this.modifiers.map(mod => mod.name).join(' ');
    const visibility = this.isModifier ? 'Modifier' :
                       this.isConstructor ? 'Constructor' :
                       this.isFallback ? 'Fallback' :
                       this.isReceive ? 'Receive' : 'Function';

    return `${visibility} ${this.name}(${params})${returns ? ' returns (' + returns + ')' : ''}${modifiers ? ' ' + modifiers : ''}`;
}

  public getSymbolKind(): SymbolKind {
    if (this.isConstructor) { return SymbolKind.Constructor; }
    if (this.isReceive) { return SymbolKind.Method; }
    if (this.isFallback) { return SymbolKind.Method; }
    if (this.isModifier) { return SymbolKind.Property; }
    return SymbolKind.Function;
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

  public override generateNatSpec(): string {

      return '/**\n' +
            '* @notice ' + this.name.split(/(?=[A-Z])/).map(x => x.toLowerCase()).join(' ') + ' \n' +
            '* @dev extra info for developers \n';
      /**
     * @dev Clears a ConsiderationItem from storage.
     *
     * @param item the ConsiderationItem to clear.
     */
  }

  public generateSelectedNatspec(offset: number): string {
    return this.generateNatSpec();
  }

  public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, isGlobal: boolean) {
    super.initialise(element, document, contract, isGlobal);
    this.supportsNatSpec = true;
    this.id = element.id;
    if (!this.isConstructor && !this.isReceive && !this.isFallback) {
      this.name = element.name;
    } else {
      this.name = '';
    }
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
    if (this.completionItem === null) {
    const completionItem = CompletionItem.create(this.name);
    completionItem.kind = CompletionItemKind.Function;
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

    completionItem.documentation = this.getMarkupInfo();
    // completionItem.detail = this.getDetail();
    this.completionItem = completionItem;
  }
  return this.completionItem;
  }

  public getDetail() {
    let functionType = 'Function';
    if (this.isModifier) {
      functionType = 'Modifier';
    }
    return functionType  + ': ' +  this.name + '\n' +
              this.getContractNameOrGlobal() + '\n';
  }

  public override getInfo(): string {
    const functionType = this.getParsedObjectType();
    return    '### ' + functionType  + ': ' +  this.name + '\n' +
              '#### ' + this.getContractNameOrGlobal() + '\n' +
              '\t' +  this.getSignature() + ' \n\n' +
              this.getComment();
  }

  public override getParsedObjectType(): string {
    if (this.isModifier) {
      return 'Modifier';
    }
    if (this.isConstructor) {
      return 'Constructor';
    }

    if (this.isReceive) {
      return 'Receive';
    }

    if (this.isFallback) {
      return 'Fallback';
    }
    return 'Function';
  }

  public getDeclaration(): string {
    if (this.isModifier) {
      return 'modifier';
    }
    if (this.isConstructor) {
      return 'constructor';
    }

    if (this.isReceive) {
      return 'receive';
    }

    if (this.isFallback) {
      return 'fallback';
    }
    return 'function';
  }

  public getSignature(): string {
    const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
    let returnParamsInfo = ParsedParameter.createParamsInfo(this.element.returnParams);
    if (returnParamsInfo !== '') {
      returnParamsInfo = ' returns (' + returnParamsInfo + ')';
    }
    return this.getDeclaration() + ' ' +  this.name + '(' + paramsInfo + ') \n\t\t\t\t' +  this.modifiers.map(x => x.name).join(' ')  + returnParamsInfo;
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

      if (statement !== undefined && statement !== null && statement.type !== undefined && statement.type !== null) {
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
      console.log(error.message);
      console.log(error.stack);
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
