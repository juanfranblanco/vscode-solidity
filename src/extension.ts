'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import { compileAllContracts } from './compileAll';
import { Compiler } from './compiler';
import { compileActiveContract, initDiagnosticCollection } from './compileActive';
import {
    generateNethereumCodeSettingsFile, codeGenerateNethereumCQSCsharp, codeGenerateNethereumCQSFSharp, codeGenerateNethereumCQSVbNet,
    codeGenerateNethereumCQSCSharpAll, codeGenerateNethereumCQSFSharpAll, codeGenerateNethereumCQSVbAll, autoCodeGenerateAfterCompilation,
    codeGenerateCQS, codeGenerateAllFilesFromAbiInCurrentFolder,
} from './codegen';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, RevealOutputChannelOn, WorkspaceChange } from 'vscode-languageclient';
import { lintAndfixCurrentDocument } from './linter/soliumClientFixer';
import { analyzeContract } from './analysers/mythx/commands/analyzeContract';
// tslint:disable-next-line:no-duplicate-imports
import { workspace, WorkspaceFolder } from 'vscode';
import { formatDocument } from './formatter/prettierFormatter';

let diagnosticCollection: vscode.DiagnosticCollection;
let mythxDiagnostic: vscode.DiagnosticCollection;
let compiler: Compiler;

export async function activate(context: vscode.ExtensionContext) {
    const ws: WorkspaceFolder[] | undefined = workspace.workspaceFolders;
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
    compiler = new Compiler(context.extensionPath);
    mythxDiagnostic = vscode.languages.createDiagnosticCollection('mythx');
    
    /*
    const configuration = vscode.workspace.getConfiguration('solidity');
    const cacheConfiguration = configuration.get<string>('solcCache');
    if (typeof cacheConfiguration === 'undefined' || cacheConfiguration === null) {
        configuration.update('solcCache', context.extensionPath, vscode.ConfigurationTarget.Global);
    }*/

    /* WSL is affected by this
    workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('solidity.enableLocalNodeCompiler') ||
            event.affectsConfiguration('solidity.compileUsingRemoteVersion') ||
            event.affectsConfiguration('solidity.compileUsingLocalVersion')) {
            await initialiseCompiler();
        }
    });
    */

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', async () => {
        const compiledResults = await compileActiveContract(compiler);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile', () => {
        compileAllContracts(compiler, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProject', (args: any[]) => {
        codeGenerateNethereumCQSCsharp(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compileAndCodegenCSharpProject', async (args: any[]) => {
        const compiledResults = await compileActiveContract(compiler);
        compiledResults.forEach(file => {
            codeGenerateCQS(file, 0, args, diagnosticCollection);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenNethereumCodeGenSettings', (args: any[]) => {
        generateNethereumCodeSettingsFile();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProject', (args: any[]) => {
        codeGenerateNethereumCQSVbNet(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compileAndCodegenVbNetProject', async (args: any[]) => {
        const compiledResults = await compileActiveContract(compiler);
        compiledResults.forEach(file => {
            codeGenerateCQS(file, 1, args, diagnosticCollection);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProject', (args: any[]) => {
        codeGenerateNethereumCQSFSharp(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compileAndCodegenFSharpProject', async (args: any[]) => {
        const compiledResults = await compileActiveContract(compiler);
        compiledResults.forEach(file => {
            codeGenerateCQS(file, 3, args, diagnosticCollection);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProjectAll', (args: any[]) => {
        codeGenerateNethereumCQSCSharpAll(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProjectAll', (args: any[]) => {
        codeGenerateNethereumCQSVbAll(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProjectAll', (args: any[]) => {
        codeGenerateNethereumCQSFSharpAll(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProjectAllAbiCurrent', (args: any[]) => {
        codeGenerateAllFilesFromAbiInCurrentFolder(0, args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProjectAllAbiCurrent', (args: any[]) => {
        codeGenerateAllFilesFromAbiInCurrentFolder(1, args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProjectAllAbiCurrent', (args: any[]) => {
        codeGenerateAllFilesFromAbiInCurrentFolder(3, args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.fixDocument', () => {
        lintAndfixCurrentDocument();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.runMythx', async (fileUri: vscode.Uri) => {
        analyzeContract(compiler, mythxDiagnostic, fileUri);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compilerInfo', async () => {
        await compiler.outputCompilerInfoEnsuringInitialised();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.solcReleases', async () => {
        compiler.outputSolcReleases();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.selectWorkspaceRemoteSolcVersion', async () => {
        compiler.selectRemoteVersion(vscode.ConfigurationTarget.Workspace);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.selectGlobalRemoteSolcVersion', async () => {
        compiler.selectRemoteVersion(vscode.ConfigurationTarget.Global);
    }));

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider('solidity', {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                return formatDocument(document, context);
            },
        }));

    const serverModule = path.join(__dirname, 'server.js');
    const serverOptions: ServerOptions = {
        debug: {
            module: serverModule,
            options: {
                execArgv: ['--nolazy', '--inspect=6009'],
            },
            transport: TransportKind.ipc,
        },
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: 'solidity', scheme: 'file' },
            { language: 'solidity', scheme: 'untitled' },
        ],
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        synchronize: {
            // Synchronize the setting section 'solidity' to the server
            configurationSection: 'solidity',
            // Notify the server about file changes to '.sol.js files contain in the workspace (TODO node, linter)
            // fileEvents: vscode.workspace.createFileSystemWatcher('**/.sol.js'),
        },
        initializationOptions: context.extensionPath
    };

    let clientDisposable;

    if (ws) {
        clientDisposable = new LanguageClient(
            'solidity',
            'Solidity Language Server',
            serverOptions,
            clientOptions).start();
    }
    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(clientDisposable);
}
