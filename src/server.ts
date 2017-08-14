'use strict';

import {SolcCompiler} from './solcCompiler';
import {SoliumService} from './solium';
import {CompletionService} from './completionService';

import {
    createConnection, IConnection,
    IPCMessageReader, IPCMessageWriter,
    TextDocuments, InitializeResult,
    Files, DiagnosticSeverity, Diagnostic,
    TextDocumentChangeEvent, TextDocumentPositionParams,
    CompletionItem, CompletionItemKind,
} from 'vscode-languageserver';

interface Settings {
    solidity: SoliditySettings;
}

interface SoliditySettings {
    enabledSolium: boolean;
    enabledAsYouTypeCompilationErrorCheck: boolean;
    compileUsingLocalVersion: string;
    compileUsingRemoteVersion: string;
    soliumRules: any;
    validationDelay: number;
}

// import * as path from 'path';
// Create a connection for the server
const connection: IConnection = createConnection(
    new IPCMessageReader(process),
    new IPCMessageWriter(process));

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const documents: TextDocuments = new TextDocuments();

let rootPath: string;
let solcCompiler: SolcCompiler;
let soliumService: SoliumService;

let enabledSolium = false;
let enabledAsYouTypeErrorCheck = false;
let compileUsingRemoteVersion = '';
let compileUsingLocalVersion = '';
let soliumRules = null;
let validationDelay = 3000;

// flags to avoid trigger concurrent validations (compiling is slow)
let validatingDocument = false;
let validatingAllDocuments = false;

function validate(document) {
    try {
        validatingDocument = true;
        const filePath = Files.uriToFilePath(document.uri);
        const documentText = document.getText();
        let soliumDiagnostics: Diagnostic[] = [];
        let compileErrorDiagnostics: Diagnostic[] = [];

        if (enabledSolium) {
            soliumDiagnostics = soliumService.solium(filePath, documentText);
        }

        if (enabledAsYouTypeErrorCheck) {
            compileErrorDiagnostics = solcCompiler.compileSolidityDocumentAndGetDiagnosticErrors(filePath, documentText);
        }

        const diagnostics = soliumDiagnostics.concat(compileErrorDiagnostics);

        connection.sendDiagnostics({
            diagnostics,
            uri: document.uri,
        });
    } finally {
        validatingDocument = false;
    }
}


connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    try {
        let document = documents.get(textDocumentPosition.textDocument.uri);
        const documentPath = Files.uriToFilePath(textDocumentPosition.textDocument.uri);
        const documentText = document.getText();
        const service = new CompletionService(rootPath);
        let completionItems = service.getAllCompletionItems(documentText, documentPath);
        return completionItems;
    } catch (error) {
        // graceful catch
        // console.log(error);
    }
});

// This handler resolve additional information for the item selected in
// the completion list.
 // connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
 //   return item;
 // });

function validateAllDocuments() {
    if (!validatingAllDocuments) {
        try {
            validatingAllDocuments = true;
            documents.all().forEach(document => validate(document));
        } finally {
            validatingAllDocuments = false;
        }
    }
}

function startValidation() {
    if (enabledAsYouTypeErrorCheck) {
        solcCompiler.intialiseCompiler(compileUsingLocalVersion, compileUsingRemoteVersion).then(() => {
            validateAllDocuments();
        });
    } else {
        validateAllDocuments();
    }
}

documents.onDidChangeContent(event => {
    if (!validatingDocument && !validatingAllDocuments) {
        validatingDocument = true; // control the flag at a higher level
        // slow down, give enough time to type (3 seconds?)
        setTimeout( () =>  validate(event.document), validationDelay);
    }
});

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose(event => connection.sendDiagnostics({
    diagnostics: [],
    uri: event.document.uri,
}));

documents.listen(connection);

connection.onInitialize((result): InitializeResult => {
    rootPath = result.rootPath;
    solcCompiler = new SolcCompiler(rootPath);
    soliumService = new SoliumService(null, connection);
    startValidation();
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: false,
            },
            textDocumentSync: documents.syncKind,
        },
    };
});

connection.onDidChangeConfiguration((change) => {
    let settings = <Settings>change.settings;
    enabledAsYouTypeErrorCheck = settings.solidity.enabledAsYouTypeCompilationErrorCheck;
    enabledSolium = settings.solidity.enabledSolium;
    compileUsingLocalVersion = settings.solidity.compileUsingLocalVersion;
    compileUsingRemoteVersion = settings.solidity.compileUsingRemoteVersion;
    soliumRules = settings.solidity.soliumRules;
    validationDelay = settings.solidity.validationDelay;
    if (soliumRules !== null ) {
        soliumService.InitSoliumRules(soliumRules);
    }

    startValidation();
},
);

connection.listen();
