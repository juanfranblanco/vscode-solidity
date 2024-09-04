'use strict';
import { compilerType, SolcCompiler } from './common/solcCompiler';
import Linter from './server/linter/linter';
import SolhintService from './server/linter/solhint';
import SoliumService from './server/linter/solium';
import { CompilerError } from './server/solErrorsToDiagnostics';
import { CompletionService } from './server/completionService';
import { SolidityDefinitionProvider } from './server/SolidityDefinitionProvider';
import { SolidityReferencesProvider } from './server/SolidityReferencesProvider';
import { SolidityHoverProvider } from './server/SolidityHoverProvider';
import {
    createConnection,
    TextDocuments,
    InitializeResult,
    Diagnostic,
    ProposedFeatures,
    TextDocumentPositionParams,
    CompletionItem, Location, SignatureHelp, TextDocumentSyncKind,
    WorkspaceFolder,
    Hover,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

import { CodeWalkerService } from './server/parsedCodeModel/codeWalkerService';
import { replaceRemappings } from './common/util';
import { findFirstRootProjectFile } from './common/projectService';

import packageJson from '../package.json';
const standAloneServerSide = false; // put this in the package json .. use this setting to build
// the standalone server and loade the default settings from package.json


interface SoliditySettings {
    // option for backward compatibilities, please use "linter" option instead
    linter: boolean | string;
    enabledAsYouTypeCompilationErrorCheck: boolean;
    compileUsingLocalVersion: string;
    compileUsingRemoteVersion: string;
    nodemodulespackage: string;
    defaultCompiler: keyof compilerType;
    soliumRules: any;
    solhintRules: any;
    validationDelay: number;
    packageDefaultDependenciesDirectory: string|string[];
    packageDefaultDependenciesContractsDirectory: string|string[];
    remappings: string[];
    remappingsWindows: string[];
    remappingsUnix: string[];
    monoRepoSupport: boolean;
    explorer_etherscan_apikey: string;
    explorer_etherscan_optimism_apikey: string;
    explorer_bscscan_apikey: string;
    explorer_polygonscan_apikey: string;
    evmVersion: string;
    viaIR: boolean;
}

const defaultSoliditySettings = {} as SoliditySettings;
Object.entries(packageJson.contributes.configuration.properties)
    .forEach(([key, value]) => {
        const keys = key.split('.');
        if (keys.length === 2 && keys[0] === 'solidity') {
            defaultSoliditySettings[keys[1]] = value.default;
        }
    });


// import * as path from 'path';
// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const documents = new TextDocuments(TextDocument);

let rootPath: string;
let solcCompiler: SolcCompiler;
let linter: Linter = null;

let enabledAsYouTypeErrorCheck = false;
let compileUsingRemoteVersion = '';
let compileUsingLocalVersion = '';
let nodeModulePackage = '';
let defaultCompiler = compilerType.embedded;
let solhintDefaultRules = {};
let soliumDefaultRules = {};
let validationDelay = 1500;
let solcCachePath = '';
let hasWorkspaceFolderCapability = false;
let monoRepoSupport = false;
let evmVersion = '';
let viaIR = false;

// flags to avoid trigger concurrent validations (compiling is slow)
let validatingDocument = false;
let validatingAllDocuments = false;
let packageDefaultDependenciesDirectory: string[] = ['lib', 'node_modules'];
let packageDefaultDependenciesContractsDirectory: string[] = ['src', 'contracts', ''];
let workspaceFolders: WorkspaceFolder[];
let remappings: string[] = [];
let selectedDocument = null;
let selectedProjectFolder = null;
let codeWalkerService: CodeWalkerService = null;



function getCodeWalkerService() {
    
    if (codeWalkerService !== null) {
        if (codeWalkerService.rootPath === selectedProjectFolder &&
            (codeWalkerService.packageDefaultDependenciesContractsDirectory !== undefined &&
                packageDefaultDependenciesDirectory !== undefined &&
                codeWalkerService.packageDefaultDependenciesDirectory.sort().join('') 
                === packageDefaultDependenciesDirectory.sort().join('') 
            ) &&
            (
                codeWalkerService.packageDefaultDependenciesContractsDirectory !== undefined && 
                packageDefaultDependenciesContractsDirectory !== undefined &&
                codeWalkerService.packageDefaultDependenciesContractsDirectory.sort().join('') 
                === packageDefaultDependenciesContractsDirectory.sort().join('') 
            ) &&
            (
                codeWalkerService.remappings !== undefined && remappings !== undefined &&
                codeWalkerService.remappings.sort().join('') === remappings.sort().join('')
            ) ) {
            return codeWalkerService;
            }
    }
    codeWalkerService = new CodeWalkerService(selectedProjectFolder,  packageDefaultDependenciesDirectory,
        packageDefaultDependenciesContractsDirectory, remappings,
    );
    codeWalkerService.initialiseAllDocuments();
    return codeWalkerService;
}


function initWorkspaceRootFolder(uri: string) {
    if (rootPath !== 'undefined') {
        const fullUri = URI.parse(uri);
        if (!fullUri.fsPath.startsWith(rootPath)) {
            if (workspaceFolders) {
                const newRootFolder = workspaceFolders.find(x => uri.startsWith(x.uri));
                if (newRootFolder !== undefined) {
                    rootPath = URI.parse(newRootFolder.uri).fsPath;
                    solcCompiler.rootPath = rootPath;
                    if (linter !== null) {
                        linter.loadFileConfig(rootPath);
                    }
                }
            }
        }
    }
}

export function initCurrentProjectInWorkspaceRootFsPath(currentDocument: string) {
    if (monoRepoSupport) {
        if (selectedDocument === currentDocument && selectedProjectFolder != null) {
            return selectedProjectFolder;
        }
        const projectFolder = findFirstRootProjectFile(rootPath, URI.parse(currentDocument).fsPath);
        if (projectFolder == null) {
            selectedProjectFolder = rootPath;
            selectedDocument = currentDocument;

            return rootPath;
        } else {
            selectedProjectFolder = projectFolder;
            selectedDocument = currentDocument;
            solcCompiler.rootPath = projectFolder;
            if (linter !== null) {
                linter.loadFileConfig(projectFolder);
            }
            return projectFolder;
        }
    } else {
        // we might have changed settings
        solcCompiler.rootPath = rootPath;
        selectedProjectFolder = rootPath;
        selectedDocument = currentDocument;
        return rootPath;
    }
}

function validate(document: TextDocument) {
    try {

        initWorkspaceRootFolder(document.uri);
        initCurrentProjectInWorkspaceRootFsPath(document.uri);


        validatingDocument = true;
        const uri = document.uri;
        const filePath = URI.parse(uri).fsPath;


        const documentText = document.getText();
        let linterDiagnostics: Diagnostic[] = [];
        const compileErrorDiagnostics: Diagnostic[] = [];
        try {
            if (linter !== null) {
                linterDiagnostics = linter.validate(filePath, documentText);
            }
        } catch {
            // gracefull catch
        }

        try {
            if (enabledAsYouTypeErrorCheck) {
               connection.console.info('Validating using the compiler selected: ' + solcCompiler.getLoadedCompilerType());
               connection.console.info('Validating using compiler version: ' +  solcCompiler.getLoadedVersion());
               connection.console.info('Validating using compiler selected version: ' +  solcCompiler.getSelectedVersion());
               // connection.console.info('remappings: ' +  remappings.join(','));
               // connection.console.info(packageDefaultDependenciesDirectory.join(','));
               // connection.console.info(packageDefaultDependenciesContractsDirectory.join(','));

               // connection.console.info('Validating using compiler configured version: ' +  compileUsingRemoteVersion);

                const errors: CompilerError[] = solcCompiler
                    .compileSolidityDocumentAndGetDiagnosticErrors(filePath, documentText,
                        packageDefaultDependenciesDirectory,
                        packageDefaultDependenciesContractsDirectory, remappings, null, evmVersion);
                errors.forEach(errorItem => {
                    const uriCompileError = URI.file(errorItem.fileName);
                    if (uriCompileError.toString() === uri) {
                        compileErrorDiagnostics.push(errorItem.diagnostic);
                    }
                });
            }
        } catch (e) {
            connection.console.info(e.message);
        }

        const diagnostics = linterDiagnostics.concat(compileErrorDiagnostics);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    } finally {
        validatingDocument = false;
    }
}

function updateSoliditySettings(soliditySettings: SoliditySettings) {
    enabledAsYouTypeErrorCheck = soliditySettings.enabledAsYouTypeCompilationErrorCheck;
    compileUsingLocalVersion = soliditySettings.compileUsingLocalVersion;
    compileUsingRemoteVersion = soliditySettings.compileUsingRemoteVersion;
    solhintDefaultRules = soliditySettings.solhintRules;
    soliumDefaultRules = soliditySettings.soliumRules;
    validationDelay = soliditySettings.validationDelay;
    nodeModulePackage = soliditySettings.nodemodulespackage;
    defaultCompiler = compilerType[soliditySettings.defaultCompiler];
    evmVersion = soliditySettings.evmVersion;
    viaIR = soliditySettings.viaIR;
    // connection.console.info('changing settings: ' +  soliditySettings.compileUsingRemoteVersion);
    // connection.console.info('changing settings: ' +  compileUsingRemoteVersion);
    connection.console.info(defaultCompiler.toString());

    if (typeof soliditySettings.packageDefaultDependenciesDirectory === 'string') {
        packageDefaultDependenciesDirectory = [<string>soliditySettings.packageDefaultDependenciesDirectory];
    } else {
        packageDefaultDependenciesDirectory = <string[]>soliditySettings.packageDefaultDependenciesDirectory;
    }

    if (typeof soliditySettings.packageDefaultDependenciesContractsDirectory === 'string') {
        packageDefaultDependenciesContractsDirectory = [<string>soliditySettings.packageDefaultDependenciesContractsDirectory];
    } else {
        packageDefaultDependenciesContractsDirectory = <string[]>soliditySettings.packageDefaultDependenciesContractsDirectory;
    }
    remappings = soliditySettings.remappings;
    monoRepoSupport = soliditySettings.monoRepoSupport;

    if (process.platform === 'win32') {
        remappings = replaceRemappings(remappings, soliditySettings.remappingsWindows);
    } else {
        remappings = replaceRemappings(remappings, soliditySettings.remappingsUnix);
    }

    switch (linterName(soliditySettings)) {
        case 'solhint': {
            linter = new SolhintService(rootPath, solhintDefaultRules);
            break;
        }
        case 'solium': {
            linter = new SoliumService(rootPath, soliumDefaultRules, connection);
            break;
        }
        default: {
            linter = null;
        }
    }

    if (linter !== null) {
        linter.setIdeRules(linterRules(soliditySettings));
    }

    startValidation();
}

connection.onSignatureHelp((): SignatureHelp => {
    return null;
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    let completionItems = [];
    const document = documents.get(textDocumentPosition.textDocument.uri);
    const projectRootPath = initCurrentProjectInWorkspaceRootFsPath(document.uri);

    const service = new CompletionService(projectRootPath);

    completionItems = completionItems.concat(
        service.getAllCompletionItems(
            document,
            textDocumentPosition.position,
            getCodeWalkerService(),
        ));
    return [...new Set(completionItems)];
});


 connection.onReferences((handler: TextDocumentPositionParams): Location[] => {
    initWorkspaceRootFolder(handler.textDocument.uri);
    initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);

    const provider = new SolidityReferencesProvider();
    return provider.provideReferences(documents.get(handler.textDocument.uri), handler.position, getCodeWalkerService());
 });

connection.onDefinition((handler: TextDocumentPositionParams): Thenable<Location | Location[]> => {
    initWorkspaceRootFolder(handler.textDocument.uri);
    initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);

    const provider = new SolidityDefinitionProvider();
    return provider.provideDefinition(documents.get(handler.textDocument.uri), handler.position, getCodeWalkerService());
});

connection.onHover((handler: TextDocumentPositionParams): Hover | undefined => {
    initWorkspaceRootFolder(handler.textDocument.uri);
    initCurrentProjectInWorkspaceRootFsPath(handler.textDocument.uri);

    const provider = new SolidityHoverProvider();
    return provider.provideHover(documents.get(handler.textDocument.uri), handler.position, getCodeWalkerService());
    });


// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
//   item.
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
       // connection.console.info('changing settings: ' +  compileUsingRemoteVersion);
        solcCompiler.initialiseAllCompilerSettings(compileUsingRemoteVersion, compileUsingLocalVersion, nodeModulePackage, defaultCompiler);
        solcCompiler.initialiseSelectedCompiler().then(() => {
            connection.console.info('Validating using the compiler selected: ' + compilerType[defaultCompiler]);
            connection.console.info('Validating using compiler version: ' +  solcCompiler.getLoadedVersion());
            validateAllDocuments();
        }).catch(reason => {
            connection.console.error('An error has occurred initialising the compiler selected ' + compilerType[defaultCompiler] + ', please check your settings, reverting to the embedded compiler. Error: ' + reason);
            solcCompiler.initialiseAllCompilerSettings(compileUsingRemoteVersion, compileUsingLocalVersion, nodeModulePackage, compilerType.embedded);
            solcCompiler.initialiseSelectedCompiler().then(() => {
                validateAllDocuments();
            // tslint:disable-next-line:no-empty
            }).catch(() => { });
        });
    } else {
        validateAllDocuments();
    }
}

documents.onDidChangeContent(event => {
    const document = event.document;
    if (!validatingDocument && !validatingAllDocuments) {
        validatingDocument = true; // control the flag at a higher level
        // slow down, give enough time to type (1.5 seconds?)

        setTimeout(() =>
         solcCompiler.initialiseSelectedCompiler().then(() => {
        validate(document); }), validationDelay);
    }
});

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose(event => connection.sendDiagnostics({
    diagnostics: [],
    uri: event.document.uri,
}));

documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
    rootPath = params.rootPath;
    const capabilities = params.capabilities;

    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders);

    if (params.workspaceFolders) {
        workspaceFolders = params.workspaceFolders;
    }
    solcCachePath = params.initializationOptions;
    solcCompiler = new SolcCompiler(rootPath);
    solcCompiler.setSolcCache(solcCachePath);

    const result: InitializeResult = {
        capabilities: {
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['.'],
            },
            definitionProvider: true,
            referencesProvider : true,
            hoverProvider: true,
            textDocumentSync: TextDocumentSyncKind.Full,
        },
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }

    if (standAloneServerSide) {
        updateSoliditySettings(defaultSoliditySettings);
    }
    return result;
});

connection.onInitialized(() => {

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            if (connection.workspace !== undefined) {
                connection.workspace.onDidChangeWorkspaceFolders((event) => {
                    event.removed.forEach(workspaceFolder => {
                        const index = workspaceFolders.findIndex((folder) => folder.uri === workspaceFolder.uri);
                        if (index !== -1) {
                            workspaceFolders.splice(index, 1);
                        }
                    });
                    event.added.forEach(workspaceFolder => {

                        workspaceFolders.push(workspaceFolder);

                    });

                });
            }
        });

    }
});

connection.onDidChangeWatchedFiles(_change => {
    if (linter !== null) {
        linter.loadFileConfig(rootPath);
    }
    validateAllDocuments();
});



connection.onDidChangeConfiguration((change) => {
    if (standAloneServerSide) {
        updateSoliditySettings({
            ...defaultSoliditySettings,
            ...(change.settings?.solidity || {}),
        });
    } else {
        updateSoliditySettings(
            change.settings?.solidity,
        );

    }

});

function linterName(settings: SoliditySettings) {
    return settings.linter;
}



function linterRules(settings: SoliditySettings) {
    const _linterName = linterName(settings);
    if (_linterName === 'solium') {
        return settings.soliumRules;
    } else {
        return settings.solhintRules;
    }
}

connection.listen();
