import * as path from 'path';
import * as solparse from 'solparse';
import * as vscode from 'vscode-languageserver';
import Uri from 'vscode-uri';

import { Contract } from './model/contract';
import { ContractCollection } from './model/contractsCollection';
import { Project } from './model/project';
import { initialiseProject } from './projectService';

export class SolidityDefinitionProvider {
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

  /**
   * Provide definition for cursor position in Solidity codebase. It calculate offset from cursor position and find the
   * most precise statement in solparse AST that surrounds the cursor. It then deduces the definition of the element based
   * on the statement type.
   *
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   * @returns {(Thenable<vscode.Location | vscode.Location[]>)}
   * @memberof SolidityDefinitionProvider
   */
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Thenable<vscode.Location | vscode.Location[]> {
    const documentText = document.getText();
    const contractPath = Uri.parse(document.uri).fsPath;

    const contracts = new ContractCollection();
    if (this.project !== undefined) {
      contracts.addContractAndResolveImports(
        contractPath,
        documentText,
        this.project,
      );
    }
    // this contract
    const contract = contracts.contracts[0];

    const offset = document.offsetAt(position);
    const result = solparse.parse(documentText);
    const element = this.findElementByOffset(result.body, offset);

    if (element !== undefined) {
      switch (element.type) {
        case 'ImportStatement':
          return Promise.resolve(
            vscode.Location.create(
              Uri.file(this.resolveImportPath(element.from, contract)).toString(),
              vscode.Range.create(0, 0, 0, 0),
            ),
          );
        case 'ContractStatement':
        {
          // find definition for inheritance
          const isBlock = this.findElementByOffset(element.is, offset);
          if (isBlock !== undefined) {
            return Promise.resolve(this.findDirectImport(
              document,
              result.body,
              isBlock.name,
              'ContractStatement',
              contracts,
            ).location);
          }

          // find definition in contract body recursively
          const statement = this.findElementByOffset(element.body, offset);
          if (statement !== undefined) {
            return this.provideDefinitionInStatement(
              document,
              result.body,
              statement,
              element,
              offset,
              contracts,
            );
          }
          break;
        }
        case 'LibraryStatement':
        {
          // find definition in library body recursively
          const statement = this.findElementByOffset(element.body, offset);
          if (statement !== undefined) {
            return this.provideDefinitionInStatement(
              document,
              result.body,
              statement,
              element,
              offset,
              contracts,
            );
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /**
   * Provide definition for anything other than `import`, and `is` statements by recursively searching through
   * statement and its children.
   *
   * @private
   * @param {vscode.TextDocument} document text document, where statement belongs, used to convert position to/from offset
   * @param {Array<any>} documentStatements array of statements found in the current document
   * @param {*} statement current statement which contains the cursor offset
   * @param {*} parentStatement parent of the current statement
   * @param {number} offset cursor offset of the element we need to provide definition for
   * @param {ContractCollection} contracts collection of contracts resolved by current contract
   * @returns {(Thenable<vscode.Location | vscode.Location[]>)}
   * @memberof SolidityDefinitionProvider
   */
  private provideDefinitionInStatement(
    document: vscode.TextDocument,
    documentStatements: Array<any>,
    statement: any,
    parentStatement: any,
    offset: number,
    contracts: ContractCollection,
  ): Thenable<vscode.Location | vscode.Location[]> {
    switch (statement.type) {
      case 'UsingStatement':
        if (offset < statement.for.start) {
          // definition of the library itself i.e. using **Library** for xxxx
          return Promise.resolve(
            this.findDirectImport(
              document,
              documentStatements,
              statement.library,
              'LibraryStatement',
              contracts,
            ).location,
          );
        } else {
          // definition of the using statement target i.e. using Library for **DataType**
          return this.provideDefinitionForType(
            document,
            documentStatements,
            statement.for,
            contracts,
          );
        }
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

  /**
   * Provide definition for a callee which can be a function, event, struct, or contract
   *
   * e.g. f(x), emit Event(x), Struct(x), Contract(address)
   *
   * @private
   * @param {ContractCollection} contracts collection of contracts resolved by current contract
   * @param {string} name name of the variable
   * @returns {Promise<vscode.Location[]>}
   * @memberof SolidityDefinitionProvider
   */
  private provideDefinitionForCallee(
    contracts: ContractCollection,
    name: string,
  ): Promise<vscode.Location[]> {
    return this.provideDefinitionForContractMember(
      contracts,
      (element) => {
        const elements = element.body.filter(contractElement =>
          contractElement.name === name && (
            contractElement.type === 'FunctionDeclaration' ||
            contractElement.type === 'EventDeclaration' ||
            contractElement.type === 'StructDeclaration'
          ),
        );

        if (element.type === 'ContractStatement' && element.name === name) {
          elements.push(element);
        }

        return elements;
      },
    );
  }

  /**
   * Provide definition for a variable which can be contract storage variable, constant, local variable (including parameters)
   *
   * TODO: find local variable reference (locally defined, parameters and return parameters)
   * @private
   * @param {ContractCollection} contracts collection of contracts resolved by current contract
   * @param {string} name name of the variable
   * @returns {Promise<vscode.Location[]>}
   * @memberof SolidityDefinitionProvider
   */
  private provideDefinitionForVariable(
    contracts: ContractCollection,
    name: string,
  ): Promise<vscode.Location[]> {
    return this.provideDefinitionForContractMember(
      contracts,
      (element) =>
        element.body.filter(contractElement =>
          contractElement.name === name && contractElement.type === 'StateVariableDeclaration',
        ),
    );
  }

  /**
   * Provide definition for a contract member
   *
   * @private
   * @param {ContractCollection} contracts collection of contracts resolved by current contract
   * @param {string} extractElements extract all relevant elements from a contract or library statement
   * @returns {Promise<vscode.Location[]>}
   * @memberof SolidityDefinitionProvider
   */
  private provideDefinitionForContractMember(
    contracts: ContractCollection,
    extractElements: (any) => Array<any>,
  ): Promise<vscode.Location[]> {
    const locations = [];
    for (const contract of contracts.contracts) {

      const result = solparse.parse(contract.code);
      const elements =  Array.prototype.concat.apply([],
        result.body.map(element => {
          if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement') {
            if (typeof element.body !== 'undefined' && element.body !== null) {
              return extractElements(element);
            }
          }
          return [];
        }),
      );

      const uri = Uri.file(contract.absolutePath).toString();
      const document = vscode.TextDocument.create(uri, null, null, contract.code);
      elements.forEach(contractElement =>
        locations.push(
          vscode.Location.create(
            uri,
            vscode.Range.create(
              document.positionAt(contractElement.start),
              document.positionAt(contractElement.end),
            ),
          ),
        ),
      );
    }
    return Promise.resolve(locations);
  }

  /**
   * Provide definition for a type. A type can either be simple e.g. `Struct` or scoped `MyContract.Struct`.
   * For the scoped type, we recurse with the type member as a simple type in the scoped document.
   *
   * @private
   * @param {vscode.TextDocument} document text document, where statement belongs, used to convert position to/from offset
   * @param {Array<any>} documentStatements array of statements found in the current document
   * @param {*} literal type literal object
   * @param {ContractCollection} contracts collection of contracts resolved by current contract
   * @returns {(Thenable<vscode.Location | vscode.Location[]>)}
   * @memberof SolidityDefinitionProvider
   */
  private provideDefinitionForType(
    document: vscode.TextDocument,
    documentStatements: Array<any>,
    literal: any,
    contracts: ContractCollection,
  ): Thenable<vscode.Location | vscode.Location[]> {
    if (literal.members.length > 0) {
      // handle scoped type by looking for scoping Contract or Library e.g. MyContract.Struct
      let literalDocument = this.findDirectImport(document, documentStatements, literal.literal, 'ContractStatement', contracts);
      if (literalDocument.location === undefined) {
        literalDocument = this.findDirectImport(document, documentStatements, literal.literal, 'LibraryStatement', contracts);
      }

      if (literalDocument.location !== undefined) {
        return this.provideDefinitionForType(
          literalDocument.document,
          literalDocument.statements,
          // a fake literal that uses the inner name and set start to the contract location
          {
            literal: literal.members[0],
            members: [],
            start: literalDocument.document.offsetAt(literalDocument.location.range.start),
          },
          contracts,
        );
      }
    } else {
      const contractStatement = this.findElementByOffset(documentStatements, literal.start);
      const structLocation = this.findStatementLocationByNameType(
        document,
        contractStatement.body,
        literal.literal,
        'StructDeclaration',
      );
      if (structLocation !== undefined) {
        return Promise.resolve(structLocation);
      }
      // TODO: only search inheritance chain
      return this.provideDefinitionForContractMember(
        contracts,
        (element) =>
          element.body.filter(contractElement =>
            contractElement.name === literal.literal && contractElement.type === 'StructDeclaration',
          ),
      );
    }
  }

  /**
   * Find the first statement by name and type in current document and its direct imports.
   *
   * This is used to find either Contract or Library statement to define `is`, `using`, or member accessor.
   *
   * @private
   * @param {vscode.TextDocument} document document where statements belong, used to convert offset to position
   * @param {Array<any>} statements list of statements to search through
   * @param {string} name name of statement to find
   * @param {string} type type of statement to find
   * @param {ContractCollection} contracts collection of contracts resolved by current contract
   * @returns location of the statement and its document and document statements
   * @memberof SolidityDefinitionProvider
   */
  private findDirectImport(
    document: vscode.TextDocument,
    statements: Array<any>,
    name: string,
    type: string,
    contracts: ContractCollection,
  ) {
    // find in the current file
    let location = this.findStatementLocationByNameType(document, statements, name, type);

    // find in direct imports if not found in file
    const contract = contracts.contracts[0];
    // TODO: when importing contracts with conflict names, which one will Solidity pick? first or last? or error?
    for (let i = 0; location === undefined && i < contract.imports.length; i++) {
      const importPath = this.resolveImportPath(contract.imports[i], contract);
      const importContract = contracts.contracts.find(e => e.absolutePath === importPath);
      const uri = Uri.file(importContract.absolutePath).toString();
      document = vscode.TextDocument.create(uri, null, null, importContract.code);
      statements = solparse.parse(importContract.code).body;
      location = this.findStatementLocationByNameType(document, statements, name, type);
    }

    return {
      document,
      location,
      statements,
    };
  }

  /**
   * Find the first statement by its name and type
   *
   * @private
   * @param {vscode.TextDocument} document document where statements belong, used to convert offset to position
   * @param {Array<any>} statements list of statements to search through
   * @param {string} name name of statement to find
   * @param {string} type type of statement to find
   * @returns {vscode.Location} the location of the found statement
   * @memberof SolidityDefinitionProvider
   */
  private findStatementLocationByNameType(
    document: vscode.TextDocument,
    statements: Array<any>,
    name: string,
    type: string,
  ): vscode.Location {
    const localDef = statements.find(e => e.type === type && e.name === name);
    if (localDef !== undefined) {
      return vscode.Location.create(
        document.uri,
        vscode.Range.create(document.positionAt(localDef.start), document.positionAt(localDef.end)),
      );
    }
  }

  /**
   * Find the first element that surrounds offset
   *
   * @private
   * @param {Array<any>} elements list of elements that has `start` and `end` member
   * @param {number} offset cursor offset
   * @returns {*} the first element where offset \in [start, end]
   * @memberof SolidityDefinitionProvider
   */
  private findElementByOffset(elements: Array<any>, offset: number): any {
    return elements.find(
      element => element.start <= offset && offset <= element.end,
    );
  }

  /**
   * Resolve import statement to absolute file path
   *
   * @private
   * @param {string} importPath import statement in *.sol contract
   * @param {Contract} contract the contract where the import statement belongs
   * @returns {string} the absolute path of the imported file
   * @memberof SolidityDefinitionProvider
   */
  private resolveImportPath(importPath: string, contract: Contract): string {
    if (contract.isImportLocal(importPath)) {
      return contract.formatContractPath(path.resolve(path.dirname(contract.absolutePath), importPath));
    } else if (this.project !== undefined) {
      const depPack = this.project.findPackage(importPath);
      if (depPack !== undefined) {
        return contract.formatContractPath(depPack.resolveImport(importPath));
      }
    }
    return importPath;
  }
}
