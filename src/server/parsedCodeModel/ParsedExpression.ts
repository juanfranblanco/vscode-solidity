import { ParsedContract } from './parsedContract';
import { FindTypeReferenceLocationResult, ParsedCode } from './parsedCode';
import { ParsedDeclarationType } from './parsedDeclarationType';
import { ParsedDocument } from './ParsedDocument';
import { IParsedExpressionContainer } from './IParsedExpressionContainer';
import { ParsedVariable } from './ParsedVariable';
import { ParsedFunction } from './ParsedFunction';

export enum ExpressionType {
  Call,
  Identifier,
}


export class ParsedExpression extends ParsedCode {

  public parent: ParsedExpression = null;
  public child: ParsedExpression = null;
  public expressionObjectType: ExpressionType;
  public reference: ParsedCode = null;
  public expressionType: ParsedDeclarationType = null;
  public expressionContainer: IParsedExpressionContainer = null;

  public static createFromMemberExpression(element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer): ParsedExpression {
    if (element.type === 'MemberExpression') {
      if (element.isArray === false) {
        let memberChildObject: ParsedExpression = null;
        if (element.property !== undefined && element.property !== null) {
          memberChildObject = this.createFromElement(element.property, document, contract, child, expressionContainer);
          if (child !== null) {
            child.parent = memberChildObject;
          }
        }
        let memberParentProperty: ParsedExpression = null;
        if (element.object !== undefined && element.object !== null) {
          memberParentProperty = this.createFromElement(element.object, document, contract, memberChildObject, expressionContainer);
          if (memberChildObject !== null) {
            memberChildObject.parent = memberParentProperty;
          }

        }
        return memberChildObject;

      } else {
        let memberChildObject: ParsedExpression = null;
        if (element.object !== undefined && element.object !== null) {
          memberChildObject = this.createFromElement(element.object, document, contract, child, expressionContainer);
          if (child !== null) {
            child.parent = memberChildObject;
          }
        }

        if (element.property !== undefined && element.property !== null) {
          if (Array.isArray(element.property)) {
            element.array.forEach(item => {
              expressionContainer.initialiseVariablesMembersEtc(item, element, null);
            });
          } else {
            expressionContainer.initialiseVariablesMembersEtc(element.property, element, null);
          }
        }
        return memberChildObject;
      }
    }
  }

  public static createFromElement(element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer): ParsedExpression {
    if (element.type !== undefined && element.type !== null) {
      switch (element.type) {
        case 'CallExpression':
          const callExpression = new ParsedExpressionCall();
          callExpression.initialise(element, document, contract, child, expressionContainer);
          if (child !== null) {
            child.parent = callExpression;
          }
          return callExpression;
          break;
        case 'MemberExpression': // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
          return this.createFromMemberExpression(element, document, contract, child, expressionContainer);
          break;
        case 'Identifier':
          const expressionIdentifier = new ParsedExpressionIdentifier();
          expressionIdentifier.initialise(element, document, contract, child, expressionContainer);
          if (child !== null) {
            child.parent = expressionIdentifier;
          }
          return expressionIdentifier;
          break;

      }
    }
    return null;
  }

  // tslint:disable-next-line:member-ordering
  public initialise(element: any, document: ParsedDocument, contract: ParsedContract, parent: ParsedExpression, expressionContainer: IParsedExpressionContainer) {
    this.name = element.name;
    this.parent = parent;
    this.document = document;
    this.contract = contract;
    this.expressionContainer = expressionContainer;
  }

  protected initialiseVariablesMembersEtc(statement: any, parentStatement: any) {
    if (statement.type !== undefined && statement.type !== null) {
      switch (statement.type) {
        case 'CallExpression': // e.g. Func(x, y)
          ParsedExpression.createFromElement(statement, this.document, this.contract, this, this.expressionContainer);
          break;
        case 'MemberExpression': // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
          ParsedExpression.createFromElement(statement, this.document, this.contract, this, this.expressionContainer);
          break;
        case 'Identifier':
          ParsedExpression.createFromElement(statement, this.document, this.contract, this, this.expressionContainer);
          break;
        default:
          for (const key in statement) {
            if (statement.hasOwnProperty(key)) {
              const element = statement[key];
              if (element instanceof Array) {
                // recursively drill down to collections e.g. statements, params
                element.forEach(innerElement => {
                  this.initialiseVariablesMembersEtc(innerElement, statement);
                });

              } else if (element instanceof Object) {
                // recursively drill down to elements with start/end e.g. literal type
                if (element.hasOwnProperty('start') && element.hasOwnProperty('end')) {
                  this.initialiseVariablesMembersEtc(
                    element,
                    statement,
                  );
                }
              }
            }
          }

      }
    }
  }
}


export class ParsedExpressionCall extends ParsedExpression {
  public arguments: ParsedExpression[];
  // tslint:disable-next-line:member-ordering
  public override initialise(element: any, document: ParsedDocument, contract: ParsedContract, child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer) {
    this.element = element;
    this.child = child;
    this.document = document;
    this.contract = contract;
    this.expressionObjectType = ExpressionType.Call;
    this.expressionContainer = expressionContainer;

    if (this.element.callee.type === 'Identifier') {
      this.name = this.element.callee.name;
    }
    if (this.element.callee.type === 'MemberExpression') {
      if (this.element.callee.property.type === 'Identifier') {
        this.name = this.element.callee.property.name;
      }
      this.initialiseVariablesMembersEtc(this.element.callee.object, this.element);
    }

    if (this.element.arguments !== undefined && this.element.arguments !== null) {
      this.element.arguments.forEach(arg => {
        this.expressionContainer.initialiseVariablesMembersEtc(arg, this.element, null);
      });
    }
  }

  public override getInnerMembers(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) { return this.expressionType.getInnerMembers(); }
    return [];
  }

  public override getInnerMethodCalls(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) { return this.expressionType.getInnerMethodCalls(); }
    return [];
  }

  public initReference() {
    if (this.reference == null) {
      if (this.parent === null) {
        const foundResults = this.findMethodsInScope(this.name);
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      } else {
        const foundResults = this.parent.getInnerMethodCalls().filter(x => x.name === this.name);
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      }
    }
  }

  public initExpressionType() {
    if (this.expressionType === null) {
      if (this.reference !== null) {
        const functionReference: ParsedFunction = <ParsedFunction>this.reference;
        if (functionReference.output !== undefined && functionReference.output.length > 0) {
          this.expressionType = functionReference.output[0].type;
        }
      }
    }
  }

  public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
    this.initReference();
    this.initExpressionType();
    if (this.isCurrentElementedSelected(offset)) {
      if (this.isElementedSelected(this.element.callee, offset)) {
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedTypeReferenceLocation(offset);
          }
        }
        if (this.reference !== null) {
          return FindTypeReferenceLocationResult.create(true, this.reference.getLocation());
        }
        return FindTypeReferenceLocationResult.create(true);
      }
    }
    return FindTypeReferenceLocationResult.create(false);
  }
}



export class ParsedExpressionIdentifier extends ParsedExpression {
  // tslint:disable-next-line:member-ordering
  public override initialise(element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer) {
    this.element = element;
    this.child = child;
    this.document = document;
    this.contract = contract;
    this.expressionObjectType = ExpressionType.Identifier;
    this.expressionContainer = expressionContainer;
    this.name = this.element.name;
  }

  public override getInnerMembers(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) { return this.expressionType.getInnerMembers(); }
    return [];
  }

  public override getInnerMethodCalls(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) { return this.expressionType.getInnerMethodCalls(); }
    return [];
  }

  public initReference() {
    if (this.reference == null) {
      if (this.parent === null) {
        const foundResults = this.expressionContainer.findMembersInScope(this.name);
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      } else {
        const foundResults = this.parent.getInnerMembers().filter(x => x.name === this.name);
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      }
    }
  }

  public initExpressionType() {
    if (this.expressionType === null) {
      if (this.reference !== null) {
        const variable: ParsedVariable = <ParsedVariable>this.reference;
        if (variable.type !== undefined) {
          this.expressionType = variable.type;
        }
      }
    }
  }

  public getSelectedTypeReferenceLocation(offset: number): FindTypeReferenceLocationResult {
    try {
      this.initReference();
      this.initExpressionType();
      if (this.isCurrentElementedSelected(offset)) {
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedTypeReferenceLocation(offset);
          }
        }
        if (this.reference !== null) {
          return FindTypeReferenceLocationResult.create(true, this.reference.getLocation());
        }
        return FindTypeReferenceLocationResult.create(true);
      } else { // in case the parent is a member and not part of the element
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedTypeReferenceLocation(offset);
          }
        }
      }
      return FindTypeReferenceLocationResult.create(false);
    } catch (error) {
      return FindTypeReferenceLocationResult.create(false);
    }
  }
}

