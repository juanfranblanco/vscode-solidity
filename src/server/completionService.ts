'use strict';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
// tslint:disable-next-line:no-duplicate-imports
import * as vscode from 'vscode-languageserver';
import { CodeWalkerService} from './parsedCodeModel/codeWalkerService';
import * as glob from 'glob';
import { relative } from 'path';
import { fileURLToPath } from 'url';
// tslint:disable-next-line:no-duplicate-imports
import * as path from 'path';
import { DotCompletionService } from './parsedCodeModel/codeCompletion/dotCompletionService';


export class CompletionService {

    public rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    public getAllCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        walker: CodeWalkerService,
      ): CompletionItem[] {
        let completionItems = [];
        let triggeredByEmit = false;
        let triggeredByImport = false;
        let triggeredByRevert = false;
        let triggeredByDotStart = 0;
        try {
        const offset = document.offsetAt(position);

        const documentContractSelected = walker.getSelectedDocument(document, position);

        const lines = document.getText().split(/\r?\n/g);
        triggeredByDotStart = DotCompletionService.getTriggeredByDotStart(lines, position);

        // triggered by emit is only possible with ctrl space
        triggeredByEmit = getAutocompleteVariableNameTrimmingSpaces(lines[position.line], position.character - 1) === 'emit';
        triggeredByImport = getAutocompleteVariableNameTrimmingSpaces(lines[position.line], position.character - 1) === 'import';
        triggeredByRevert = getAutocompleteVariableNameTrimmingSpaces(lines[position.line], position.character - 1) === 'revert';
        //  TODO: this does not work due to the trigger.
        // || (lines[position.line].trimLeft().startsWith('import "') && lines[position.line].trimLeft().lastIndexOf('"') === 7);


        if (triggeredByDotStart > 0) {

            const globalVariableContext = GetContextualAutoCompleteByGlobalVariable(lines[position.line], triggeredByDotStart);

            if (globalVariableContext != null) {
                completionItems = completionItems.concat(globalVariableContext);
            } else {
                completionItems = completionItems.concat(
                    DotCompletionService.getSelectedDocumentDotCompletionItems(lines, position, triggeredByDotStart, documentContractSelected, offset));
            }
            return completionItems;
        }

        if (triggeredByImport) {
            const files = glob.sync(this.rootPath + '/**/*.sol');
            files.forEach(item => {
                const dependenciesDirectories = walker.project.packagesDir.map(x =>  path.join(this.rootPath, x));

                item = path.join(item);
                const foundDependency = dependenciesDirectories.find(x => item.startsWith(x));
                if (foundDependency !== undefined) {
                    let pathLibrary = item.substr(foundDependency.length + 1);
                    pathLibrary = pathLibrary.split('\\').join('/');
                    const completionItem = CompletionItem.create(pathLibrary);
                    completionItem.kind = CompletionItemKind.Reference;
                    completionItem.insertText = '"' + pathLibrary + '";';
                    completionItems.push(completionItem);
                } else {
                    const remapping = walker.project.findRemappingForFile(item);
                    if (remapping != null) {
                        let pathLibrary = remapping.createImportFromFile(item);
                        pathLibrary = pathLibrary.split('\\').join('/');
                        const completionItem = CompletionItem.create(pathLibrary);
                        completionItem.kind = CompletionItemKind.Reference;
                        completionItem.insertText = '"' + pathLibrary + '";';
                        completionItems.push(completionItem);
                    } else {
                        let rel = relative(fileURLToPath(document.uri), item);
                        rel = rel.split('\\').join('/');
                        if (rel.startsWith('../')) {
                            rel = rel.substr(1);
                        }
                        const completionItem = CompletionItem.create(rel);
                        completionItem.kind = CompletionItemKind.Reference;
                        completionItem.insertText = '"' + rel + '";';
                        completionItems.push(completionItem);
                    }
                }
            });

            return completionItems;
        }

        if (triggeredByEmit) {

            if (documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null ) {
                completionItems = completionItems.concat(documentContractSelected.selectedContract.getAllEventsCompletionItems());
            } else {
                completionItems = completionItems.concat(documentContractSelected.getAllGlobalEventsCompletionItems());
            }

        } else if (triggeredByRevert) {
            if (documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null ) {
                completionItems = completionItems.concat(documentContractSelected.selectedContract.getAllErrorsCompletionItems());
            } else {
                completionItems = completionItems.concat(documentContractSelected.getAllGlobalErrorsCompletionItems());
            }
        } else {

            if (documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null ) {

                const selectedContract = documentContractSelected.selectedContract;
                completionItems = completionItems.concat(selectedContract.getSelectedContractCompletionItems(offset));
            } else {

                completionItems = completionItems.concat(documentContractSelected.getSelectedDocumentCompletionItems(offset));
            }
        }

    } catch (error) {
        // graceful catch
        console.log(error);
    } finally {

        completionItems = completionItems.concat(GetCompletionTypes());
        completionItems = completionItems.concat(GetCompletionKeywords());
        completionItems = completionItems.concat(GeCompletionUnits());
        completionItems = completionItems.concat(GetGlobalFunctions());
        completionItems = completionItems.concat(GetGlobalVariables());
    }
    return completionItems;
    }

}

export function GetCompletionTypes(): CompletionItem[] {
    const completionItems = [];
    const types = ['address', 'string', 'bytes', 'byte', 'int', 'uint', 'bool'];
    for (let index = 8; index <= 256; index += 8) {
        types.push('int' + index);
        types.push('uint' + index);
        types.push('bytes' + index / 8);
    }
    types.forEach(type => {
        const completionItem =  CompletionItem.create(type);
        completionItem.kind = CompletionItemKind.Keyword;
        completionItem.detail = type + ' type';
        completionItems.push(completionItem);
    });
    // add mapping
    return completionItems;
}

function CreateCompletionItem(label: string, kind: CompletionItemKind, detail: string) {
    const completionItem = CompletionItem.create(label);
    completionItem.kind = kind;
    completionItem.detail = detail;
    return completionItem;
}

export function GetCompletionKeywords(): CompletionItem[] {
    const completionItems = [];
    const keywords = [ 'modifier', 'mapping', 'break', 'continue', 'delete', 'else', 'for',
    'if', 'new', 'return', 'returns', 'while', 'using',
    'private', 'public', 'external', 'internal', 'payable', 'nonpayable', 'view', 'pure', 'case', 'do', 'else', 'finally',
    'in', 'instanceof', 'return', 'throw', 'try', 'catch', 'typeof', 'yield', 'void', 'virtual', 'override'] ;
    keywords.forEach(unit => {
        const completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Keyword;
        completionItems.push(completionItem);
    });

    completionItems.push(CreateCompletionItem('contract', CompletionItemKind.Class, null));
    completionItems.push(CreateCompletionItem('library', CompletionItemKind.Class, null));
    completionItems.push(CreateCompletionItem('storage', CompletionItemKind.Field, null));
    completionItems.push(CreateCompletionItem('memory', CompletionItemKind.Field, null));
    completionItems.push(CreateCompletionItem('var', CompletionItemKind.Field, null));
    completionItems.push(CreateCompletionItem('constant', CompletionItemKind.Constant, null));
    completionItems.push(CreateCompletionItem('immutable', CompletionItemKind.Keyword, null));
    completionItems.push(CreateCompletionItem('transient', CompletionItemKind.Keyword, null));
    completionItems.push(CreateCompletionItem('constructor', CompletionItemKind.Constructor, null));
    completionItems.push(CreateCompletionItem('event', CompletionItemKind.Event, null));
    completionItems.push(CreateCompletionItem('import', CompletionItemKind.Module, null));
    completionItems.push(CreateCompletionItem('enum', CompletionItemKind.Enum, null));
    completionItems.push(CreateCompletionItem('struct', CompletionItemKind.Struct, null));
    completionItems.push(CreateCompletionItem('function', CompletionItemKind.Function, null));

    return completionItems;
}


export function GeCompletionUnits(): CompletionItem[] {
    const completionItems = [];
    const etherUnits = ['wei', 'gwei', 'finney', 'szabo', 'ether'] ;
    etherUnits.forEach(unit => {
        const completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Unit;
        completionItem.detail = unit + ': ether unit';
        completionItems.push(completionItem);
    });

    const timeUnits = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'years'];
    timeUnits.forEach(unit => {
        const completionItem =  CompletionItem.create(unit);
        completionItem.kind = CompletionItemKind.Unit;

        if (unit !== 'years') {
            completionItem.detail = unit + ': time unit';
        } else {
            completionItem.detail = 'DEPRECATED: ' + unit + ': time unit';
        }
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
        {
            detail: 'ABI encoding / decoding',
            kind: CompletionItemKind.Variable,
            label: 'abi',
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
            detail: 'gasleft(): returns the remaining gas',
            insertText: 'gasleft();',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'gasleft',
        },
        {
            detail: 'unicode: converts string into unicode',
            insertText: 'unicode"${1:text}"',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'unicode',
        },
        {
            detail: 'blockhash(uint blockNumber): hash of the given block - only works for 256 most recent, excluding current, blocks',
            insertText: 'blockhash(${1:blockNumber});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Function,
            label: 'blockhash',
        },
        {
            detail: 'require(bool condition): reverts if the condition is not met - to be used for errors in inputs or external components.',
            insertText: 'require(${1:condition});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'require',
        },
        {
            // tslint:disable-next-line:max-line-length
            detail: 'require(bool condition, string message): reverts if the condition is not met - to be used for errors in inputs or external components. Also provides an error message.',
            insertText: 'require(${1:condition}, ${2:message});',
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
            insertText: 'addmod(${1:x}, ${2:y}, ${3:k})',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'addmod',
        },
        {
            detail: 'mulmod(uint x, uint y, uint k) returns (uint):' +
                    'compute (x * y) % k where the multiplication is performed with arbitrary precision and does not wrap around at 2**256',
            insertText: 'mulmod(${1:x}, ${2:y}, ${3:k})',
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
            insertText: 'ecrecover(${1:hash}, ${2:v}, ${3:r}, ${4:s})',
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
    if (isAutocompleteTrigeredByVariableName('abi', lineText, wordEndPosition)) {
        return getAbiCompletionItems();
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



function getAutocompleteVariableNameTrimmingSpaces(lineText: string, wordEndPosition: number): string {
    let searching = true;
    let result = '';
    if (lineText[wordEndPosition] === ' ' ) {
        let spaceFound = true;
        while (spaceFound && wordEndPosition >= 0 ) {
            wordEndPosition = wordEndPosition - 1;
            if (lineText[wordEndPosition] !== ' ') {
                spaceFound = false;
            }
        }
    }

    while (searching && wordEndPosition >= 0) {
        const currentChar = lineText[wordEndPosition];
        if (isAlphaNumeric(currentChar) || currentChar === '_' || currentChar === '$') {
            result = currentChar + result;
            wordEndPosition = wordEndPosition - 1;
        } else {
            if (currentChar === ' ') { // we only want a full word for a variable // this cannot be parsed due incomplete statements
                searching = false;
                return result;
            }
            searching = false;
            return '';
        }
    }
    return result;
}

function isAlphaNumeric(str) {
    let code, i, len;

    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58) && // numeric (0-9)
          !(code > 64 && code < 91) && // upper alpha (A-Z)
          !(code > 96 && code < 123)) { // lower alpha (a-z)
        return false;
      }
    }
    return true;
  }

function getBlockCompletionItems(): CompletionItem[] {
    return [
        {
            detail: '(address): Current block miner’s address',
            kind: CompletionItemKind.Property,
            label: 'coinbase',
        },
        {
            detail: '(bytes32): DEPRECATED In 0.4.22 use blockhash(uint) instead. Hash of the given block - only works for 256 most recent blocks excluding current',
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
            label: 'gaslimit',
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
            detail: '(uint): remaining gas DEPRECATED in 0.4.21 use gasleft()',
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

function getAbiCompletionItems(): CompletionItem[] {
    return [
        {
            detail: 'encode(..) returns (bytes): ABI-encodes the given arguments',
            insertText: 'encode(${1:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encode',
        },
        {
            detail: 'encodePacked(..) returns (bytes): Performs packed encoding of the given arguments',
            insertText: 'encodePacked(${1:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encodePacked',
        },
        {
            detail: 'encodeWithSelector(bytes4,...) returns (bytes): ABI-encodes the given arguments starting from the second and prepends the given four-byte selector',
            insertText: 'encodeWithSelector(${1:bytes4}, ${2:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encodeWithSelector',
        },
        {
            detail: 'encodeWithSignature(string,...) returns (bytes): Equivalent to abi.encodeWithSelector(bytes4(keccak256(signature), ...)`',
            insertText: 'encodeWithSignature(${1:signatureString}, ${2:arg});',
            insertTextFormat: 2,
            kind: CompletionItemKind.Method,
            label: 'encodeWithSignature',
        },
    ];
}
