import * as solparse from 'solparse';
import * as projectService from './projectService';
import {ContractCollection} from './model/contractsCollection';
import { CompletionItem, CompletionItemKind, Command } from 'vscode-languageserver';

// TODO implement caching, dirty on document change, reload, etc.
// store
// export class CompletionFile {
//    public path: string;
//    public imports: string[]
//    public inspectionResult : any
// }


export class CompletionService {

    public rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    public getTypeString(literal: any) {
        const isArray = literal.array_parts.length > 0;
        let isMapping = false;
        const literalType = literal.literal;
        let suffixType = '';

        if (typeof literalType.type !== 'undefined')  {
             isMapping = literalType.type === 'MappingExpression';
             if (isMapping) {
                suffixType = '(' + this.getTypeString(literalType.from) + ' => ' + this.getTypeString(literalType.to) + ')';
            }
        }

        if (isArray) {
            suffixType = suffixType + '[]';
        }

        if (isMapping) {
            return 'mapping' + suffixType;
        }

        return literalType + suffixType;
    }

    public createFunctionParamsSnippet(params: any): string {
        let paramsSnippet = '';
        let counter = 0;
        if (typeof params !== 'undefined' && params !== null) {
            params.forEach( parameterElement => {
               const typeString = this.getTypeString(parameterElement.literal);
               counter = counter + 1;
               let currentParamSnippet = '${' + counter + ':' + parameterElement.id + '}';
                if (paramsSnippet === '') {
                    paramsSnippet = currentParamSnippet;
                } else {
                    paramsSnippet = paramsSnippet + ', ' + currentParamSnippet;
                }
            });
        }
        return paramsSnippet;
    }

    public createParamsInfo(params: any): string {
        let paramsInfo = '';
        if (typeof params !== 'undefined' && params !== null) {
            params.forEach( parameterElement => {
               const typeString = this.getTypeString(parameterElement.literal);
                let currentParamInfo = '';
                if (typeof parameterElement.id !== 'undefined' && parameterElement.id !== null ) { // no name on return parameters
                    currentParamInfo = typeString + ' ' + parameterElement.id;
                } else {
                    currentParamInfo = typeString;
                }
                if (paramsInfo === '') {
                    paramsInfo = currentParamInfo;
                } else {
                    paramsInfo = paramsInfo + ', ' + currentParamInfo;
                }
            });
        }
        return paramsInfo;
    }

    public createFunctionEventCompletionItem(contractElement: any, type: string, contractName: string): CompletionItem {

        let completionItem =  CompletionItem.create(contractElement.name);
        completionItem.kind = CompletionItemKind.Function;
        let paramsInfo = this.createParamsInfo(contractElement.params);
        let paramsSnippet = this.createFunctionParamsSnippet(contractElement.params);
        let returnParamsInfo = this.createParamsInfo(contractElement.returnParams);
        if (returnParamsInfo !== '') {
            returnParamsInfo = ' returns (' + returnParamsInfo + ')';
        }
        completionItem.insertTextFormat = 2;
        completionItem.insertText = contractElement.name + '(' + paramsSnippet + ');';
        const info = '(' + type + ' in ' + contractName + ') ' + contractElement.name + '(' + paramsInfo + ')' + returnParamsInfo;
        completionItem.documentation = info;
        completionItem.detail = info;
        return completionItem;
    }

    public getDocumentCompletionItems(documentText: string): CompletionItem[] {
        let completionItems = [];
        try {
            let result = solparse.parse(documentText);
            // console.log(JSON.stringify(result));
            // TODO struct, modifier
            result.body.forEach(element => {
                if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement') {
                    let contractName = element.name;
                    if (typeof element.body !== 'undefined' && element.body !== null) {
                        element.body.forEach(contractElement => {
                            if (contractElement.type === 'FunctionDeclaration') {
                                // ignore the constructor TODO add to contract initialiasation
                                if (contractElement.name !== contractName) {
                                    completionItems.push(
                                            this.createFunctionEventCompletionItem(contractElement, 'function', contractName ));
                                }
                            }

                            if (contractElement.type === 'EventDeclaration') {
                                completionItems.push(this.createFunctionEventCompletionItem(contractElement, 'event', contractName ));
                            }

                            if (contractElement.type === 'StateVariableDeclaration') {
                                let completionItem =  CompletionItem.create(contractElement.name);
                                completionItem.kind = CompletionItemKind.Field;
                                const typeString = this.getTypeString(contractElement.literal);
                                completionItem.detail = '(state variable in ' + contractName + ') '
                                                                    + typeString + ' ' + contractElement.name;
                                completionItems.push(completionItem);
                            }
                        });
                    }
                }
            });
        } catch (error) {
          // gracefule catch
          // console.log(error.message);
        }
        // console.log('file completion items' + completionItems.length);
        return completionItems;
    }

    public getAllCompletionItems(documentText: string,
                                documentPath: string,
                                packageDefaultDependenciesDirectory: string,
                                packageDefaultDependenciesContractsDirectory: string): CompletionItem[] {

        if (this.rootPath !== 'undefined' && this.rootPath !== null) {
            const contracts = new ContractCollection();
            contracts.addContractAndResolveImports(
                documentPath,
                documentText,
                projectService.initialiseProject(this.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory));
            let completionItems = [];
            contracts.contracts.forEach(contract => {
                completionItems = completionItems.concat(this.getDocumentCompletionItems(contract.code));
            });
            // console.log('total completion items' + completionItems.length);
            return completionItems;
        } else {
            return this.getDocumentCompletionItems(documentText);
        }
    }
}

export function GetCompletionTypes(): CompletionItem[] {
    let completionItems = [];
    let types = ['address', 'string', 'bytes', 'byte', 'int', 'uint', 'bool', 'hash'];
    types.forEach(type => {
        let completionItem =  CompletionItem.create(type);
        completionItem.kind = CompletionItemKind.Keyword;
        completionItem.detail = type + ' type';
        completionItems.push(completionItem);
    });
    // add mapping
    return completionItems;
}


export function GeCompletionUnits(): CompletionItem[] {
    let completionItems = [];
    let etherUnits = ['wei', 'finney', 'szabo', 'ether'] ;
    etherUnits.forEach(unit => {
        let completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Unit;
        completionItem.detail = unit + ': ether unit';
        completionItems.push(completionItem);
    });

    let timeUnits = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'years'];
    timeUnits.forEach(unit => {
        let completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Unit;
        completionItem.detail = unit + ': time unit';
        completionItems.push(completionItem);
    });

    return completionItems;
}

export function GetGlobalVariables(): CompletionItem[] {
    return [
        {
            detail: 'Current block',
            kind: CompletionItemKind.Variable,
            label: 'block',
        },
        {
            detail: 'Current Message',
            kind: CompletionItemKind.Variable,
            label: 'msg',
        },
        {
            detail: '(uint): current block timestamp (alias for block.timestamp)',
            kind: CompletionItemKind.Variable,
            label: 'now',
        },
        {
            detail: 'Current transaction',
            kind: CompletionItemKind.Variable,
            label: 'tx',
        },
    ];
}

export function GetGlobalFunctions(): CompletionItem[] {
    return [
        {
            detail: 'assert(bool condition): throws if the condition is not met - to be used for internal errors.',
            insertText: 'assert(${1:condition});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'assert',
        },
        {
            detail: 'require(bool condition): throws if the condition is not met - to be used for errors in inputs or external components.',
            insertText: 'require(${1:condition});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'require',
        },
        {
            detail: 'revert(): abort execution and revert state changes',
            insertText: 'revert();',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'revert',
        },
        {
            detail: 'addmod(uint x, uint y, uint k) returns (uint):' +
                    'compute (x + y) % k where the addition is performed with arbitrary precision and does not wrap around at 2**256',
            insertText: 'addmod(${1:x},${2:y},${3:k})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'addmod',
        },
        {
            detail: 'mulmod(uint x, uint y, uint k) returns (uint):' +
                    'compute (x * y) % k where the multiplication is performed with arbitrary precision and does not wrap around at 2**256',
            insertText: 'mulmod(${1:x},${2:y},${3:k})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'mulmod',
        },
        {
            detail: 'keccak256(...) returns (bytes32):' +
                    'compute the Ethereum-SHA-3 (Keccak-256) hash of the (tightly packed) arguments',
            insertText: 'keccak256(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'keccak256',
        },
        {
            detail: 'sha256(...) returns (bytes32):' +
                    'compute the SHA-256 hash of the (tightly packed) arguments',
            insertText: 'sha256(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'sha256',
        },
        {
            detail: 'sha3(...) returns (bytes32):' +
                    'alias to keccak256',
            insertText: 'sha3(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'sha3',
        },
        {
            detail: 'ripemd160(...) returns (bytes20):' +
                    'compute RIPEMD-160 hash of the (tightly packed) arguments',
            insertText: 'ripemd160(${1:x})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'ripemd160',
        },
        {
            detail: 'ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address):' +
                    'recover the address associated with the public key from elliptic curve signature or return zero on error',
            insertText: 'ecrecover(${1:hash},${2:v},${3:r},${4:s})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'ecrecover',
        },

    ];
}

export function GetContextualAutoCompleteByGlobalVariable(lineText: string, wordEndPosition: number): CompletionItem[] {
    if (isAutocompleteTrigeredByVariableName('block', lineText, wordEndPosition)) {
        return getBlockCompletionItems();
    }
    if (isAutocompleteTrigeredByVariableName('msg', lineText, wordEndPosition)) {
        return getMsgCompletionItems();
    }
    if (isAutocompleteTrigeredByVariableName('tx', lineText, wordEndPosition)) {
        return getTxCompletionItems();
    }
    return null;
}

function isAutocompleteTrigeredByVariableName(variableName: string, lineText: string, wordEndPosition: number): Boolean {
    const nameLength = variableName.length;
    if (wordEndPosition >= nameLength
        // does it equal our name?
        && lineText.substr(wordEndPosition - nameLength, nameLength) === variableName) {
          return true;
        }
    return false;
}

function getBlockCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(address): Current block miner’s address',
            kind: CompletionItemKind.Property,
            label: 'coinbase',
        },
        {
            detail: '(bytes32): Hash of the given block - only works for 256 most recent blocks excluding current',
            insertText: 'blockhash(${1:blockNumber});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'blockhash',
        },
        {
            detail: '(uint): current block difficulty',
            kind: CompletionItemKind.Property,
            label: 'difficulty',
        },
        {
            detail: '(uint): current block gaslimit',
            kind: CompletionItemKind.Property,
            label: 'gasLimit',
        },
        {
            detail: '(uint): current block number',
            kind: CompletionItemKind.Property,
            label: 'number',
        },
        {
            detail: '(uint): current block timestamp as seconds since unix epoch',
            kind: CompletionItemKind.Property,
            label: 'timestamp',
        },
    ];
}

function getTxCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(uint): gas price of the transaction',
            kind: CompletionItemKind.Property,
            label: 'gas',
        },
        {
            detail: '(address): sender of the transaction (full call chain)',
            kind: CompletionItemKind.Property,
            label: 'origin',
        },
    ];
}

function getMsgCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(bytes): complete calldata',
            kind: CompletionItemKind.Property,
            label: 'data',
        },
        {
            detail: '(uint): remaining gas',
            kind: CompletionItemKind.Property,
            label: 'gas',
        },
        {
            detail: '(address): sender of the message (current call)',
            kind: CompletionItemKind.Property,
            label: 'sender',
        },
        {
            detail: '(bytes4): first four bytes of the calldata (i.e. function identifier)',
            kind: CompletionItemKind.Property,
            label: 'sig',
        },
        {
            detail: '(uint): number of wei sent with the message',
            kind: CompletionItemKind.Property,
            label: 'value',
        },
    ];
}
