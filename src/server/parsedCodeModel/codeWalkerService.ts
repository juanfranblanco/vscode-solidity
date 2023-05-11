import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { SourceDocumentCollection } from '../../common/model/sourceDocumentCollection';
import { Project } from '../../common/model/project';
import { initialiseProject } from '../../common/projectService';
import * as solparse from 'solparse-exp-jb';
import { ParsedContract } from './parsedContract';
import { ParsedDocument } from './ParsedDocument';
import { SourceDocument } from '../../common/model/sourceDocument';
import * as fs from 'fs';



export class CodeWalkerService {
  public project: Project;
  public remappings: string[];
  public rootPath: string;
  public packageDefaultDependenciesDirectory: string;
  public packageDefaultDependenciesContractsDirectory: string;
  public parsedDocumentsCache: ParsedDocument[] = [];

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

  public initialiseAllDocuments() {
     const sourceDocuments = new SourceDocumentCollection();
     const files = this.project.getAllSolFilesIgnoringDependencyFolders();
     files.forEach(contractPath => {
          if (!sourceDocuments.containsSourceDocument(contractPath)) {
                const contractCode = fs.readFileSync(contractPath, 'utf8');
                sourceDocuments.addSourceDocumentAndResolveImports(contractPath, contractCode, this.project);
            }
      });
      sourceDocuments.documents.forEach(sourceDocumentItem => {
         this.parseDocument(sourceDocumentItem.code, false, sourceDocumentItem);
      });
      this.parsedDocumentsCache.forEach(element => {
        element.imports.forEach(importItem => {
          importItem.initialiseDocumentReference(this.parsedDocumentsCache);
        });
      });
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
                selectedDocument.addImportedDocument(documentImport);
            }
        });

        if (selectedDocument.selectedContract !== undefined && selectedDocument.selectedContract !== null ) {
            selectedDocument.selectedContract.initialiseExtendContracts();
        }

        this.parsedDocumentsCache.forEach(element => {
          element.imports.forEach(importItem => {
            importItem.initialiseDocumentReference(this.parsedDocumentsCache);
          });
        });

        return selectedDocument;
  }


  public parseSelectedDocument(documentText: string, offset: number, line: number, fixedSource: boolean, sourceDocument: SourceDocument): ParsedDocument {
    const document: ParsedDocument = new ParsedDocument();
    try {
        const result = solparse.parse(documentText);
        const selectedElement = this.findElementByOffset(result.body, offset);
        if (fixedSource) {
            document.initialiseDocument(result, selectedElement, sourceDocument, documentText);
        } else {
            document.initialiseDocument(result, selectedElement, sourceDocument, null );
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
    const foundDocument = this.parsedDocumentsCache.find(x => x.sourceDocument.absolutePath ===  sourceDocument.absolutePath);
    const newDocument: ParsedDocument = new ParsedDocument();
    if (foundDocument !== undefined && foundDocument !== null) {
      if (foundDocument.sourceDocument.code === sourceDocument.code) {
          newDocument.initialiseDocument(foundDocument.element, null, sourceDocument, foundDocument.fixedSource);
          this.parsedDocumentsCache.push(newDocument);
      }
      this.parsedDocumentsCache = this.parsedDocumentsCache.filter( x => x !== foundDocument);
    }
        try {
            const result = solparse.parse(documentText);
            if (fixedSource) {
              newDocument.initialiseDocument(result, null, sourceDocument, documentText);
            } else {
              newDocument.initialiseDocument(result, null, sourceDocument, null );
            }
            this.parsedDocumentsCache.push(newDocument);
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
        return newDocument;
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
