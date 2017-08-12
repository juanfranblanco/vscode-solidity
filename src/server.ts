'use strict';

import {SolcCompiler} from './solcCompiler';
import {SoliumService} from './solium';

import {
    createConnection, IConnection,
    IPCMessageReader, IPCMessageWriter,
    TextDocuments, InitializeResult,
    Files, DiagnosticSeverity, Diagnostic, TextDocumentChangeEvent,
} from 'vscode-languageserver';


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

interface Settings {
    solidity: SoliditySettings;
}

interface SoliditySettings {
    enabledSolium: boolean;
    enabledAsYouTypeErrorCheck: boolean;
    compileUsingLocalVersion: string;
    compileUsingRemoteVersion: string;
    soliumRules: any;
}

let enabledSolium = false;
let enabledAsYouTypeErrorCheck = false;
let compileUsingRemoteVersion = '';
let compileUsingLocalVersion = '';
let soliumRules = null;


function validate(document) {
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
}

function startValidation() {
    if (enabledAsYouTypeErrorCheck) {
        solcCompiler.intialiseCompiler(compileUsingLocalVersion, compileUsingRemoteVersion).then(() => {
            return documents.all().forEach(document => validate(document));
        });
    } else {
        return documents.all().forEach(document => validate(document));
    }
}

documents.onDidChangeContent(event => validate(event.document));

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
            textDocumentSync: documents.syncKind,
        },
    };
});

connection.onDidChangeConfiguration((change) => {
    let settings = <Settings>change.settings;
    enabledAsYouTypeErrorCheck = settings.solidity.enabledAsYouTypeErrorCheck;
    enabledSolium = settings.solidity.enabledSolium;
    compileUsingLocalVersion = settings.solidity.compileUsingLocalVersion;
    compileUsingRemoteVersion = settings.solidity.compileUsingRemoteVersion;
    soliumRules = settings.solidity.soliumRules;
    if (soliumRules !== null ) {
        soliumService.InitSoliumRules(soliumRules);
    }
    startValidation();
},
);

connection.listen();
