'use strict';
import * as path from 'path';
import { compilerType, SolcCompiler } from './common/solcCompiler';
import Linter from './server/linter/linter';
import SolhintService from './server/linter/solhint';
import SoliumService from './server/linter/solium';
import { CompilerError } from './server/solErrorsToDiagnostics';
import { CompletionService } from './server/completionService';
import { SolidityDefinitionProvider } from './server/SolidityDefinitionProvider';
import { SolidityReferencesProvider } from './server/SolidityReferencesProvider';
import { SolidityDocumentSymbolProvider } from './server/SolidityDocumentSymbolProvider';
import { SolidityHoverProvider } from './server/SolidityHoverProvider';
import { SolidityWorkspaceSymbolProvider } from './server/SolidityWorkspaceSymbolProvider';
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
    type TextDocumentChangeEvent
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';


import { CodeWalkerService } from './server/parsedCodeModel/codeWalkerService';
import { replaceRemappings } from './common/util';
import { findFirstRootProjectFile } from './common/projectService';
import { readFileSync } from 'fs';


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
    solhintPackageDirectory: string;
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




// import * as path from 'path';
// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);


const defaultSoliditySettings = {} as SoliditySettings;

let packageJson: any;
try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    if (packageJson &&
        typeof packageJson === 'object' &&
        packageJson.contributes &&
        typeof packageJson.contributes === 'object' &&
        packageJson.contributes.configuration &&
        typeof packageJson.contributes.configuration === 'object' &&
        packageJson.contributes.configuration.properties &&
        typeof packageJson.contributes.configuration.properties === 'object') {
        Object.entries(packageJson.contributes.configuration.properties)
            .forEach(([key, value]) => {
                const keys = key.split('.');
                if (keys.length === 2 && keys[0] === 'solidity') {
                    defaultSoliditySettings[keys[1]] = (value as any).default;
                }
            });
    } else {
        console.error("⚠️ package.json loaded but 'contributes' key is missing.");
    }
} catch (error) {
    console.error('❌ Error loading package.json:', error.message);
}

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
let solhintPackageDirectory = '';
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
const codeWalkerServiceCache: CodeWalkerService[] = [];

function removeAllCodeWalkerServiceFromCacheThatAreNotInCurrentWorkspacesOrSettings() {
    codeWalkerServiceCache.forEach(x => {
        if (!workspaceFolders.find(y => x.rootPath.startsWith(URI.parse(y.uri).fsPath))) {
            removeCodeWalkerServiceFromCache(x.rootPath);
        }
    });

}

function removeCodeWalkerServiceFromCache(projectFolder: string) {
    const index = codeWalkerServiceCache.findIndex(x => x.isTheSameCodeWalkerservice(projectFolder));
    if (index !== -1) {
        codeWalkerServiceCache.splice(index, 1);
    }
}

function getCodeWalkerServiceFromCache(projectFolder: string) {
    return codeWalkerServiceCache.find(x => x.isTheSameCodeWalkerservice(projectFolder));
}

function getCodeWalkerServiceFromCacheAndCreateIfNotExistsOrSettingsChanged(projectFolder: string) {

    removeAllCodeWalkerServiceFromCacheThatAreNotInCurrentWorkspacesOrSettings();
    let cacheCodeWalkerService = getCodeWalkerServiceFromCache(projectFolder);
    if (cacheCodeWalkerService !== undefined) {
        if(cacheCodeWalkerService.hasTheSameDependencySettings(packageDefaultDependenciesDirectory,
            packageDefaultDependenciesContractsDirectory, remappings)){
            codeWalkerService = cacheCodeWalkerService;
            return cacheCodeWalkerService;
         } else {
            removeCodeWalkerServiceFromCache(selectedProjectFolder);
         }
    }
    cacheCodeWalkerService = new CodeWalkerService(selectedProjectFolder,  packageDefaultDependenciesDirectory,
        packageDefaultDependenciesContractsDirectory, remappings,
    );
    cacheCodeWalkerService.initialiseAllDocuments();
    codeWalkerServiceCache.push(cacheCodeWalkerService);
    return cacheCodeWalkerService;
}


function getCodeWalkerService() {
    if (codeWalkerService !== null) {
        if (codeWalkerService.isTheSameCodeWalkerservice(selectedProjectFolder)) {
            if (codeWalkerService.hasTheSameDependencySettings(packageDefaultDependenciesDirectory,
                                                             packageDefaultDependenciesContractsDirectory,
                                                            remappings)) {
                return codeWalkerService;
        }
        }
    }
    codeWalkerService = getCodeWalkerServiceFromCacheAndCreateIfNotExistsOrSettingsChanged(selectedProjectFolder);
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

 function initCurrentProjectInWorkspaceRootFsPath(currentDocument: string) {
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
    solhintPackageDirectory = soliditySettings.solhintPackageDirectory;
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
            linter = new SolhintService(rootPath, solhintDefaultRules, solhintPackageDirectory);
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

function onDidChangeContent(event: TextDocumentChangeEvent<TextDocument>) {
    const document = event.document;
    if (!validatingDocument && !validatingAllDocuments) {
        validatingDocument = true; // control the flag at a higher level
        // slow down, give enough time to type (1.5 seconds?)

        setTimeout(() =>
         solcCompiler.initialiseSelectedCompiler().then(() => {
        validate(document); }), validationDelay);
        getCodeWalkerService().refreshDocument(document);
    }
}

documents.onDidSave(onDidChangeContent);

documents.onDidChangeContent(onDidChangeContent);

connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);

    if (document) {
        // Initialize project root and ensure CodeWalkerService is up-to-date
        initWorkspaceRootFolder(document.uri);
        initCurrentProjectInWorkspaceRootFsPath(document.uri);

        // Use the provider to generate document symbols
        const provider = new SolidityDocumentSymbolProvider();
        const symbols = provider.provideDocumentSymbols(document, getCodeWalkerService());

        // Return the generated symbols
        return symbols || [];
    }

    return [];
});

connection.onWorkspaceSymbol((params) => {
    const provider = new SolidityWorkspaceSymbolProvider();

    if (!selectedProjectFolder) { return []; }
    const projectFolder = initCurrentProjectInWorkspaceRootFsPath(selectedProjectFolder);
    const walker = getCodeWalkerServiceFromCacheAndCreateIfNotExistsOrSettingsChanged(projectFolder);

    return provider.provideWorkspaceSymbols(params.query, walker);
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

    if (params.initializationOptions && typeof params.initializationOptions === 'string') {
        solcCachePath = params.initializationOptions;
    } else {
        solcCachePath = '';
    }

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
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
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

