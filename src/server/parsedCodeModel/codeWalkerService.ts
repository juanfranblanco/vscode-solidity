import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { SourceDocumentCollection } from '../../common/model/sourceDocumentCollection';
import { Project } from '../../common/model/project';
import { initialiseProject } from '../../common/projectService';
import * as solparse from 'solparse-exp-jb';
import { ParsedContract } from './parsedContract';
import { ParsedDocument } from './ParsedDocument';
import { SourceDocument } from '../../common/model/sourceDocument';



export class CodeWalkerService {
  public project: Project;
  public remappings: string[];
  public rootPath: string;
  public packageDefaultDependenciesDirectory: string;
  public packageDefaultDependenciesContractsDirectory: string;
  private parsedDocumentsCache: ParsedDocument[] = [];

  constructor(
    rootPath: string,
    packageDefaultDependenciesDirectory: string,
    packageDefaultDependenciesContractsDirectory: string,
    remappings: string[],
  ) {
    this.rootPath = rootPath;

    this.packageDefaultDependenciesDirectory = packageDefaultDependenciesDirectory;
    this.packageDefaultDependenciesContractsDirectory = packageDefaultDependenciesContractsDirectory;
    this.remappings = remappings;

    if (this.rootPath !== 'undefined' && this.rootPath !== null) {
      this.project = initialiseProject(
        this.rootPath,
        this.packageDefaultDependenciesDirectory,
        this.packageDefaultDependenciesContractsDirectory,
        this.remappings,
      );
    }
  }

  public getSelectedDocument(
    document: vscode.TextDocument,
    position: vscode.Position): ParsedDocument {

        let selectedDocument: ParsedDocument = new ParsedDocument();
        const documentText = document.getText();
        const documentPath = URI.parse(document.uri).fsPath;
        const sourceDocuments = new SourceDocumentCollection();
        if (this.project !== undefined) {
        sourceDocuments.addSourceDocumentAndResolveImports(
            documentPath,
            documentText,
            this.project,
        );
        }
        const selectedSourceDocument = sourceDocuments.documents[0];
        const offset = document.offsetAt(position);

        selectedDocument = this.parseSelectedDocument(documentText, offset, position.line, false, selectedSourceDocument);

        sourceDocuments.documents.forEach(sourceDocumentItem => {
            if (sourceDocumentItem !== selectedSourceDocument) {
                const documentImport = this.parseDocument(sourceDocumentItem.code, false, sourceDocumentItem);
                selectedDocument.importedDocuments = selectedDocument.importedDocuments.concat(documentImport);
                const contractsParsed = this.getContracts(sourceDocumentItem.code, documentImport);
                selectedDocument.allContracts = selectedDocument.allContracts.concat(contractsParsed);

            }
        });

        if (selectedDocument.selectedContract !== undefined && selectedDocument.selectedContract !== null ) {
            selectedDocument.selectedContract.initialiseExtendContracts();
        }

        return selectedDocument;
  }


  public parseSelectedDocument(documentText: string, offset: number, line: number, fixedSource: boolean, sourceDocument: SourceDocument): ParsedDocument {
    const document: ParsedDocument = new ParsedDocument();
    try {
        const result = solparse.parse(documentText);
        const selectedElement = this.findElementByOffset(result.body, offset);
        if (fixedSource) {
            document.initialise(result, selectedElement, sourceDocument, documentText);
        } else {
            document.initialise(result, selectedElement, sourceDocument, null );
        }
    } catch (error) {
        // if we error parsing (cannot cater for all combos) we fix by removing current line.
        const lines = documentText.split(/\r?\n/g);
        if (lines[line].trim() !== '') { // have we done it already?
            lines[line] = ''.padStart(lines[line].length, ' '); // adding the same number of characters so the position matches where we are at the moment
            const code = lines.join('\r\n');
            return this.parseSelectedDocument(code, offset, line, true, sourceDocument);
        }
    }
    return document;
  }

  public parseDocument(documentText: string, fixedSource: boolean, sourceDocument: SourceDocument): ParsedDocument {
    const foundDocument = this.parsedDocumentsCache.find(x => x.sourceDocument.absolutePath ===  sourceDocument.absolutePath &&
      x.sourceDocument.code === sourceDocument.code);

    if (foundDocument !== undefined && foundDocument !== null) { return foundDocument; }

    const document: ParsedDocument = new ParsedDocument();
    try {
        const result = solparse.parse(documentText);
        if (fixedSource) {
            document.initialise(result, null, sourceDocument, documentText);
        } else {
            document.initialise(result, null, sourceDocument, null );
        }
        this.parsedDocumentsCache.push(document);
    } catch (error) {
        /*
        // if we error parsing (cannot cater for all combos) we fix by removing current line.
        const lines = documentText.split(/\r?\n/g);
        if (lines[line].trim() !== '') { // have we done it already?
            lines[line] = ''.padStart(lines[line].length, ' '); // adding the same number of characters so the position matches where we are at the moment
            const code = lines.join('\r\n');
            return this.parseDocument(code, true, sourceDocument);
        }*/
    }
    return document;
  }

  public getContracts(documentText: string, document: ParsedDocument): ParsedContract[] {
    const contracts: ParsedContract[] = [];
    try {

        const result = solparse.parse(documentText);
        result.body.forEach(element => {
            if (element.type === 'ContractStatement' ||  element.type === 'LibraryStatement' || element.type === 'InterfaceStatement') {
                const contract = new ParsedContract();
                contract.initialise(element, document);
                contracts.push(contract);
            }
        });
    } catch (error) {
      // gracefule catch
      // console.log(error.message);
    }
    return contracts;
  }




  private findElementByOffset(elements: Array<any>, offset: number): any {
    return elements.find(
      element => element.start <= offset && offset <= element.end,
    );
  }



}
