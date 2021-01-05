import * as path from 'path';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { Contract } from './model/contract';
import { ContractCollection } from './model/contractsCollection';
import { Project } from './model/project';
import { initialiseProject } from './projectService';
import * as solparse from 'solparse-exp-jb';


export class ParsedCode {
    public element: any;
    public name: string;
    public location: vscode.Location;

    protected isElementedSelected(element:any, offset:number): boolean{
        if(element !== undefined && element !== null) {
            if(element.start <= offset && offset <= element.end) 
                return true;;
        }
        return false;
    }
}

export class DeclarationType extends ParsedCode {
    static create(literal: any): DeclarationType {
        const declarationType = new DeclarationType();
        declarationType.initialise(literal);
        return declarationType;
    }
    public isArray: boolean;
    public isMapping: boolean;

    public initialise(literal: any) {
        this.element = literal;
        if(literal.members !== undefined && literal.members.length > 0) {
            this.name = literal.members[0];    
        } else {
            this.name = literal.literal;
        }
        const isArray = literal.array_parts.length > 0;
        this.isMapping = false;
        const literalType = literal.literal;
        if (typeof literalType.type !== 'undefined')  {
             this.isMapping = literalType.type === 'MappingExpression';
             this.name = 'mapping'; // do something here
             // suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
        }
    }
}

export class Contract2 extends ParsedCode 
{
    public functions: Function[] = [];
    public enums: Enum[] = [];
    public events: Event[] = [];
    public stateVariables: StateVariable[] = []
    public structs: Struct[] = [];
    public contractType: string;
    public constructorFunction: Function = new Function();
    public fallbackFunction: Function = new Function();
    public receiveFunction: Function = new Function();
    public extendsContracts: Contract2[] = [];
    public extendsContractNames: string[] = [];

    public initialise(element:any) {
        this.element = element;
        this.name = element.name;
        this.location; //
        this.contractType = element.type;
        this.initialiseChildren();                
    }

    public initialiseExtendContracts(contracts:Contract2[]){
        if(this.extendsContracts.length === 0 && this.extendsContractNames.length > 0) {
            this.extendsContractNames.forEach(contractName => {
               let contractMatched =  contracts.find(x => x.name === contractName);
               if(contractMatched !== undefined && contractMatched !== null) {
                    contractMatched.initialiseExtendContracts(contracts);
                    this.extendsContracts.push(contractMatched);
               }
            });
        }
    }

    public isConstructorSelected(offset:number) {
        let element = this.constructorFunction.element;
        return this.isElementedSelected(element, offset);
    }

    public isFallbackSelected(offset:number) {
        let element = this.fallbackFunction.element;
        return this.isElementedSelected(element, offset);
    }

    public isReceivableSelected(offset:number) {
        let element = this.receiveFunction.element;
        return this.isElementedSelected(element, offset);
    }

    public getSelectedFunction(offset:number) {
        let selectedFunction =  this.functions.find(x => {
            let element = x.element;
            if(element !== undefined || element !== null) {
               if(element.start <= offset && offset <= element.end) 
                    return true;;
            }
            return false;
        });
        if(selectedFunction === undefined) { //nothing
            if(this.isConstructorSelected(offset)) {
                selectedFunction = this.constructorFunction;
            } else {
                if(this.isFallbackSelected(offset)) {
                    selectedFunction = this.fallbackFunction;
                } else {
                    if(this.isReceivableSelected(offset)) {
                        selectedFunction = this.receiveFunction;
                    }
                }
            }
        }
        return selectedFunction;
    }

    public getAllFunctions() : Function[] {
        let returnItems: Function[] = [];
        returnItems = returnItems.concat(this.functions);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllFunctions());
         });
        return returnItems;
    }

    public getAllStructs() : Struct[] {
        let returnItems: Struct[] = [];
        returnItems = returnItems.concat(this.structs);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllStructs());
         });
        return returnItems;
    }

    public getAllEnums() : Enum[] {
        let returnItems: Enum[] = [];
        returnItems = returnItems.concat(this.enums);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllEnums());
         });
        return returnItems;
    }

    public getAllStateVariables() : StateVariable[] {
        let returnItems: StateVariable[] = [];
        returnItems = returnItems.concat(this.stateVariables);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllStateVariables());
         });
        return returnItems;
    }

    public getAllEvents() : Event[] {
        let returnItems: Event[] = [];
        returnItems = returnItems.concat(this.events);
        this.extendsContracts.forEach(contract => {
            returnItems = returnItems.concat(contract.getAllEvents());
         });
        return returnItems;
    }

    public initialiseChildren(){
        if (typeof this.element.is !== 'undefined' && this.element.is !== null) {
            this.element.is.forEach(isElement => { 
                this.extendsContractNames.push(isElement.name);
            });
        }

        if (typeof this.element.body !== 'undefined' && this.element.body !== null) {
            this.element.body.forEach(contractElement => {
                if (contractElement.type === 'FunctionDeclaration') {
                    const functionContract = new Function();
                    functionContract.initialise(contractElement, this);
                    if (functionContract.name === functionContract.contract.name) {
                        this.constructorFunction = functionContract;
                    } else {
                        this.functions.push(functionContract);
                    }
                }

                if (contractElement.type === 'ConstructorDeclaration') {
                    const functionContract = new Function();
                    functionContract.initialise(contractElement, this);
                    this.constructorFunction = functionContract;
                }

                if (contractElement.type === 'FallbackDeclaration') {
                    const functionContract = new Function();
                    functionContract.initialise(contractElement, this);
                    this.fallbackFunction = functionContract;
                }

                if (contractElement.type === 'ReceiveDeclaration') {
                    const functionContract = new Function();
                    functionContract.initialise(contractElement, this);
                    this.receiveFunction = functionContract;
                }

                if (contractElement.type === 'EventDeclaration') {
                    let eventContract = new Event();
                    eventContract.initialise(contractElement, this);
                    this.events.push(eventContract);
                }

                if (contractElement.type === 'StateVariableDeclaration') {
                    let stateVariable = new StateVariable();
                    stateVariable.initialise(contractElement, this);
                    this.stateVariables.push(stateVariable);
                }

                if (contractElement.type === 'EnumDeclaration') {
                    let enumContract = new Enum();
                    enumContract.initialise(contractElement, this);
                    this.enums.push(enumContract);
                }

                if (contractElement.type === 'StructDeclaration') {
                    let struct = new Struct();
                    struct.initialise(contractElement, this);
                    this.structs.push(struct);
                }
            });
        }
    }
}

export class Function extends ParsedCode {
    public input:     Parameter[] = [];
    public output:    Parameter[] = [];
    public variablesInScope: FunctionVariable[] = [];
    public contract:  Contract2;

    public initialise(element:any, contract:Contract2) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.location; //
        this.initialiseParamters();                
    }
    public initialiseParamters(){
        this.input = Parameter.extractParameters(this.element.params);
        this.output = Parameter.extractParameters(this.element.returnParams);
    }

    public findVariableDeclarationsInScope(offset:number, block:any){
    
        if(this.element.is_abstract === false || this.element.is_abstract === undefined) {
            if(this.element.body !== 'undefined' && this.element.body.type === 'BlockStatement') {
                this.findVariableDeclarationsInInnerScope(offset, this.element.body);
            }
        }
    }

    public findVariableDeclarationsInInnerScope(offset:number, block:any){
        
        if(block !== undefined && block !== null) {
            if(this.isElementedSelected(block, offset)) {
                if(block.body !== 'undefined') {
                        block.body.forEach(blockBodyElement => {
                            if (blockBodyElement.type === 'ExpressionStatement') {
                                let expression = blockBodyElement.expression;
                                this.addVariableInScopeFromExpression(expression);
                            }

                            if (blockBodyElement.type === 'ForStatement') {
                                if(this.isElementedSelected(blockBodyElement, offset)) {
                                    this.addVariableInScopeFromExpression(blockBodyElement.init);
                                    this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.body);
                                }
                            }

                            if (blockBodyElement.type === 'IfStatement') {
                                if(this.isElementedSelected(blockBodyElement, offset)) {
                                    this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.consequent);
                                    this.findVariableDeclarationsInInnerScope(offset, blockBodyElement.alternate);
                                }
                            }
                        });
                }
            }
                
        }
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
            let variable = new FunctionVariable();
            variable.element = declarationStatement;
            variable.name = declarationStatement.name;
            variable.type = DeclarationType.create(declarationStatement.literal);
            variable.function = this;
            this.variablesInScope.push(variable);
        }
    }
}

export class Event extends ParsedCode {
    public initialise(element:any, contract:Contract2) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.location; //
        this.initialiseParamters();                
    }

    public initialiseParamters(){
        this.input = Parameter.extractParameters(this.element.params);
    }

    public input:     Parameter[] = [];
    public contract:  Contract2;
}

export class Struct extends ParsedCode {
    public variables:     StructVariable[] = [];
    public contract:  Contract2;

    public initialise(element:any, contract:Contract2) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.location; // 

        if(this.element.body !== 'undefined') {
            this.element.body.forEach(structBodyElement => {
                    if(structBodyElement.type === 'DeclarativeExpression'){
                        let variable = new StructVariable();
                        variable.element = structBodyElement;
                        variable.name = structBodyElement.name;
                        variable.type = DeclarationType.create(structBodyElement.literal);
                        variable.struct = this;
                        this.variables.push(variable);
                    }
                });
        }
    }
}

export class Enum extends ParsedCode {
    public items:     string[] = [];
    public contract:  Contract2;
    public initialise(element:any, contract:Contract2) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.location; //
        element.members.forEach(member => { this.items.push(member) });    
    }
}

export class Variable extends ParsedCode {
    public type:  DeclarationType;
}

export class StructVariable extends Variable {
    public struct: Struct;
}

export class FunctionVariable extends Variable {
    public function: Function;
}

export class StateVariable extends Variable {
    public initialise(element:any, contract:Contract2) {
        this.contract = contract;
        this.element = element;
        this.name = element.name;
        this.location; //  
        this.type = DeclarationType.create(element.literal);            
    }
    public contract: Contract2;
}

export class Parameter extends Variable {
    
    static extractParameters(params: any) : Parameter[] {
        const parameters: Parameter[] = [];
        if (typeof params !== 'undefined' && params !== null) {
            if (params.hasOwnProperty('params')) {
                params = params.params;
            }
            params.forEach( parameterElement => {
               const parameter: Parameter = new Parameter();
               const type = DeclarationType.create(parameterElement.literal);
               parameter.element = parameterElement;
               parameter.type = type;
               if (typeof parameterElement.id !== 'undefined' && parameterElement.id !== null ) { // no name on return parameters
                    parameter.name = parameterElement.id;
               }           parameters.push(parameter);
    
            });
        }
        return parameters;
    }
}

export class DocumentContract {
    public allContracts: Contract2[] = []; 
    public selectedContract: Contract2;
}


export class SolidityCodeWalker {
  private rootPath: string;
  private packageDefaultDependenciesDirectory: string;
  private packageDefaultDependenciesContractsDirectory: string;
  private project: Project;

  constructor(
    rootPath: string,
    packageDefaultDependenciesDirectory: string,
    packageDefaultDependenciesContractsDirectory: string,
  ) {
    this.rootPath = rootPath;
    
    this.packageDefaultDependenciesDirectory = packageDefaultDependenciesDirectory;
    this.packageDefaultDependenciesContractsDirectory = packageDefaultDependenciesContractsDirectory;

    if (this.rootPath !== 'undefined' && this.rootPath !== null) {
      this.project = initialiseProject(
        this.rootPath,
        this.packageDefaultDependenciesDirectory,
        this.packageDefaultDependenciesContractsDirectory,
      );
    }
  }

  public getAllContracts(
    document: vscode.TextDocument,
    position: vscode.Position,): DocumentContract {
      
        let documentContract:DocumentContract = new DocumentContract();
        const documentText = document.getText();
        const contractPath = URI.parse(document.uri).fsPath;
        const contracts = new ContractCollection();
        if (this.project !== undefined) {
        contracts.addContractAndResolveImports(
            contractPath,
            documentText,
            this.project,
        );
        }
        const contract = contracts.contracts[0];
        const offset = document.offsetAt(position);
 
        documentContract = this.getSelectedContracts(documentText, offset, position.line);
 
        contracts.contracts.forEach(contractItem => {
            if(contractItem !== contract) {
                let contractsParsed = this.getContracts(contractItem.code);
                documentContract.allContracts = documentContract.allContracts.concat(contractsParsed);
            }
        });

        if(documentContract.selectedContract !== undefined && documentContract.selectedContract !== null ) {
            documentContract.selectedContract.initialiseExtendContracts(documentContract.allContracts); 
        }

        return documentContract;
  }


  private findElementByOffset(elements: Array<any>, offset: number): any {
    return elements.find(
      element => element.start <= offset && offset <= element.end,
    );
  }


  public getSelectedContracts(documentText: string, offset: number, line: number): DocumentContract {
    let contracts : DocumentContract = new DocumentContract();
    try {

        const result = solparse.parse(documentText);
        let selectedElement = this.findElementByOffset(result.body, offset);
        result.body.forEach(element => {
            if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement' || element.type == 'InterfaceStatement') {
                var contract = new Contract2();
                contract.initialise(element);
                if(selectedElement === element) {
                    contracts.selectedContract = contract;
                }
                contracts.allContracts.push(contract);
            }
        });
    } catch (error) {
        //if we error parsing (cannot cater for all combos) we fix by removing current line.
        const lines = documentText.split(/\r?\n/g);
        if(lines[line].trim() !== '') { //have we done it already?
            lines[line] = ''.padStart(lines[line].length, ' '); //adding the same number of characters so the position matches where we are at the moment
            let code = lines.join('\r\n');
            return this.getSelectedContracts(code, offset, line);
        }
    }
    return contracts;
  }

  public getContracts(documentText: string): Contract2[] {
    let contracts : Contract2[] = [];
    try {

        const result = solparse.parse(documentText);
        result.body.forEach(element => {
            if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement' || element.type == 'InterfaceStatement') {
                var contract = new Contract2();
                contract.initialise(element);
                contracts.push(contract);
            }
        });
    } catch (error) {
      // gracefule catch
      // console.log(error.message);
    }
    return contracts;
  }


  
}
