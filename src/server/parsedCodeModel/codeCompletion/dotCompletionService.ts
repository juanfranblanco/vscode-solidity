import { CompletionItem, Position } from 'vscode-languageserver';
import { ParsedVariable } from '../ParsedVariable';
import { ParsedStruct } from '../ParsedStruct';
import { ParsedDeclarationType } from '../parsedDeclarationType';
import { ParsedFunction } from '../ParsedFunction';
import { ParsedContract } from '../parsedContract';
import { ParsedDocument } from '../ParsedDocument';


export class AutocompleteByDot {
    public isVariable = false;
    public isMethod = false;
    public isArray = false;
    public isProperty = false;
    public parentAutocomplete: AutocompleteByDot = null; // could be a property or a method
    public childAutocomplete: AutocompleteByDot = null;
    public name = '';

    public getTopParent(): AutocompleteByDot {
        if (this.parentAutocomplete != null) {
            return this.parentAutocomplete.getTopParent();
        }
        return this;
    }
}

export class DotCompletionService {

     public static getTriggeredByDotStart(lines: string[], position: Position): number {
        let start = 0;
        let triggeredByDot = false;
        for (let i = position.character; i >= 0; i--) {
            if (lines[position.line[i]] === ' ') {
                triggeredByDot = false;
                i = 0;
                start = 0;
            }
            if (lines[position.line][i] === '.') {
                start = i;
                i = 0;
                triggeredByDot = true;
            }
        }
        return start;
    }

    public static getSelectedDocumentDotCompletionItems(lines: string[],
                                                        position: Position,
                                                        triggeredByDotStart: number,
                                                        documentContractSelected: ParsedDocument,
                                                        offset: number): CompletionItem[] {

        let completionItems: CompletionItem[] = [];
        const autocompleteByDot = this.getAutocompleteTriggerByDotVariableName(lines[position.line], triggeredByDotStart - 1);
        // if triggered by variable //done
        // todo triggered by method (get return type) // done
        // todo triggered by property // done
        // todo variable // method return is an array (push, length etc)
        // variable / method / property is an address or other specific type functionality (balance, etc)
        // variable / method / property type is extended by a library
        if (autocompleteByDot.name !== '') {


            // have we got a selected contract (assuming not type.something)
            if (documentContractSelected.selectedContract !== undefined && documentContractSelected.selectedContract !== null) {
                const selectedContract = documentContractSelected.selectedContract;

                // this contract
                if (autocompleteByDot.name === 'this' && autocompleteByDot.isVariable && autocompleteByDot.parentAutocomplete === null) {

                    // add selectd contract completion items
                    completionItems = completionItems.concat(selectedContract.getDotCompletionItems());

                } else {
                    /// the types
                    let topParent = autocompleteByDot.getTopParent();
                    if (topParent.name === 'this') {
                        topParent = topParent.childAutocomplete;
                    }

                    this.findDotCompletionItemsForSelectedContract(topParent, completionItems, documentContractSelected, documentContractSelected.selectedContract, offset);
                }
            }
        }
        return completionItems;
    }

      // tslint:disable-next-line:max-line-length
    public static findDotCompletionItemsForSelectedContract(autocompleteByDot: AutocompleteByDot, completionItems: any[], documentContractSelected: ParsedDocument, currentContract: ParsedContract, offset: number) {

        if (currentContract === documentContractSelected.selectedContract) {
            const selectedFunction = documentContractSelected.selectedContract.getSelectedFunction(offset);
            // tslint:disable-next-line:max-line-length
            this.findDotCompletionItemsForContract(autocompleteByDot, completionItems, documentContractSelected.allContracts, documentContractSelected.selectedContract, selectedFunction, offset);
        } else {
            this.findDotCompletionItemsForContract(autocompleteByDot, completionItems, documentContractSelected.allContracts, documentContractSelected.selectedContract);
        }

    }

    // tslint:disable-next-line:max-line-length
    public static findDotCompletionItemsForContract(autocompleteByDot: AutocompleteByDot, completionItems: any[], allContracts: ParsedContract[], currentContract: ParsedContract, selectedFunction: ParsedFunction = null, offset: number = null) {

        const allStructs = currentContract.getAllStructs();
        const allEnums = currentContract.getAllEnums();
        let allVariables: ParsedVariable[] = currentContract.getAllStateVariables();
        const allfunctions: ParsedFunction[] = currentContract.getAllFunctions();


        if (selectedFunction !== undefined && selectedFunction !== null)  {
            selectedFunction.findVariableDeclarationsInScope(offset);
            // adding input parameters
            allVariables = allVariables.concat(selectedFunction.input);
            // ading all variables
            allVariables = allVariables.concat(selectedFunction.variablesInScope);
        }


        let found = false;

        if (autocompleteByDot.isVariable) {

            allVariables.forEach(item => {
                if (item.name === autocompleteByDot.name && !found) {
                    found = true;
                    if (autocompleteByDot.childAutocomplete !== undefined && autocompleteByDot.childAutocomplete !== null) {
                        this.findDotType(allStructs, item.type, autocompleteByDot.childAutocomplete, completionItems, allContracts, currentContract);
                    } else {
                        this.findDotTypeCompletion(allStructs, item.type, completionItems, allContracts, currentContract);
                    }
                }
            });

            if (!found &&  (autocompleteByDot.childAutocomplete === undefined || autocompleteByDot.childAutocomplete === null)) {
                allEnums.forEach(item => {
                    if (item.name === autocompleteByDot.name) {
                        found = true;
                        completionItems = completionItems.concat(item.getDotCompletionItems());
                    }
                });
            }

            if (!found && (autocompleteByDot.childAutocomplete === undefined || autocompleteByDot.childAutocomplete === null) ) {
                allContracts.forEach(item => {
                    if (item.name === autocompleteByDot.name) {
                        found = true;
                        completionItems = completionItems.concat(item.getDotCompletionItems());
                    }
                });
            }
        }

        if (autocompleteByDot.isMethod) {

            allfunctions.forEach(item => {
                if (item.name === autocompleteByDot.name) {
                    found = true;
                    if (item.output.length === 1) {
                        // todo return array
                        const type = item.output[0].type;

                        if (autocompleteByDot.childAutocomplete !== undefined && autocompleteByDot.childAutocomplete !== null) {
                            this.findDotType(allStructs, type, autocompleteByDot.childAutocomplete, completionItems, allContracts, currentContract);
                        } else {
                            this.findDotTypeCompletion(allStructs, type, completionItems, allContracts, currentContract);
                        }
                    }
                }
            });

            // contract declaration as IMyContract(address)
            if (!found && (autocompleteByDot.childAutocomplete === undefined || autocompleteByDot.childAutocomplete === null) ) {
                allContracts.forEach(item => {
                    if (item.name === autocompleteByDot.name) {
                        found = true;
                        completionItems = completionItems.concat(item.getDotCompletionItems());
                    }
                });
            }
        }
    }



    // tslint:disable-next-line:max-line-length
    public static findDotTypeCompletion(allStructs: ParsedStruct[], type: ParsedDeclarationType, completionItems: any[], allContracts: ParsedContract[], currentContract: ParsedContract) {
        const foundStruct = allStructs.find(x => x.name === type.name);
        if (foundStruct !== undefined) {
            completionItems = completionItems.concat(foundStruct.getDotCompletionItems());
        } else {

            const foundContract = allContracts.find(x => x.name === type.name);
            if (foundContract !== undefined) {
                foundContract.initialiseExtendContracts();
                completionItems = completionItems.concat(foundContract.getDotCompletionItems());
            }
        }

        const allUsing = currentContract.getAllUsing(type);
        allUsing.forEach(usingItem => {
            const foundLibrary = allContracts.find(x => x.name === usingItem.name);
            if (foundLibrary !== undefined) {
                this.addAllLibraryExtensionsAsCompletionItems(foundLibrary, completionItems, type);
            }
        });
    }

    public static addAllLibraryExtensionsAsCompletionItems(documentContractSelected: ParsedContract, completionItems: any[], type: ParsedDeclarationType) {
        const allfunctions = documentContractSelected.getAllFunctions();
        const filteredFunctions = allfunctions.filter( x => {
            if (x.input.length > 0 ) {
                const typex = x.input[0].type;
                let validTypeName = false;
                if (typex.name === type.name || (type.name === 'address_payable' && typex.name === 'address')) {
                    validTypeName = true;
                }
                 return typex.isArray === type.isArray && validTypeName && typex.isMapping === type.isMapping;
            }
            return false;
        });

        filteredFunctions.forEach(item => {
            completionItems.push(
                item.createCompletionItem(true));
        });
    }


    // tslint:disable-next-line:max-line-length
    public static findDotType(allStructs: ParsedStruct[], type: ParsedDeclarationType, autocompleteByDot: AutocompleteByDot, completionItems: any[], allContracts: ParsedContract[], currentContract: ParsedContract) {
        const foundStruct = allStructs.find(x => x.name === type.name);
        if (foundStruct !== undefined) {
            foundStruct.variables.forEach(property => {
                // own method refactor
                if (autocompleteByDot.name === property.name) {
                    if (autocompleteByDot.childAutocomplete !== undefined && autocompleteByDot.childAutocomplete !== null)  {
                        this.findDotType(allStructs, property.type, autocompleteByDot.childAutocomplete, completionItems, allContracts, currentContract);
                    } else {
                        this.findDotTypeCompletion(allStructs, property.type, completionItems, allContracts, currentContract);
                    }
                }
            });
        } else {

            const foundContract = allContracts.find(x => x.name === type.name);
            if (foundContract !== undefined) {
                foundContract.initialiseExtendContracts();
                this.findDotCompletionItemsForContract(autocompleteByDot, completionItems, allContracts, foundContract);

            }
        }


        /*
        let allUsing = currentContract.getAllUsing(type);
        allUsing.forEach(usingItem => {
            let foundLibrary = allContracts.find(x => x.name === usingItem.name);
            if (foundLibrary !== undefined) {
                this.addAllLibraryExtensionsAsCompletionItems(foundLibrary, completionItems, type);
            }
        });
        */
    }


    public static getAutocompleteTriggerByDotVariableName(lineText: string, wordEndPosition: number): AutocompleteByDot {
        let searching = true;
        const result: AutocompleteByDot = new AutocompleteByDot();
        // simpler way might be to find the first space or beginning of line
        // and from there split / match (but for now kiss or slowly)

        wordEndPosition = this.getArrayStart(lineText, wordEndPosition, result);

        if (lineText[wordEndPosition] === ')' ) {
            result.isMethod = true;
            let methodParamBeginFound = false;
            while (!methodParamBeginFound && wordEndPosition >= 0 ) {
                if (lineText[wordEndPosition] === '(') {
                    methodParamBeginFound = true;
                }
                wordEndPosition = wordEndPosition - 1;
            }
        }

        if (!result.isMethod && !result.isArray) {
            result.isVariable = true;
        }

        while (searching && wordEndPosition >= 0) {
            const currentChar = lineText[wordEndPosition];
            if (this.isAlphaNumeric(currentChar) || currentChar === '_' || currentChar === '$') {
                result.name = currentChar + result.name;
                wordEndPosition = wordEndPosition - 1;
            } else {
                if (currentChar === ' ') { // we only want a full word for a variable / method // this cannot be parsed due incomplete statements
                    searching = false;
                    return result;
                } else {
                    if (currentChar === '.') {
                        result.parentAutocomplete = this.getAutocompleteTriggerByDotVariableName(lineText, wordEndPosition - 1);
                        result.parentAutocomplete.childAutocomplete = result;
                    }
                }
                searching = false;
                return result;
            }
        }
        return result;
    }

    public static getArrayStart(lineText: string, wordEndPosition: number, result: AutocompleteByDot) {
        if (lineText[wordEndPosition] === ']') {
            result.isArray = true;
            let arrayBeginFound = false;
            while (!arrayBeginFound && wordEndPosition >= 0) {
                if (lineText[wordEndPosition] === '[') {
                    arrayBeginFound = true;
                }
                wordEndPosition = wordEndPosition - 1;
            }
        }
        if (lineText[wordEndPosition] === ']') {
            wordEndPosition = this.getArrayStart(lineText, wordEndPosition, result);
        }
        return wordEndPosition;
    }

    private static isAlphaNumeric(str) {
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
}
