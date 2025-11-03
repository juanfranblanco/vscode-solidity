'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import { compileAllContracts } from './client/compileAll';
import { Compiler } from './client/compiler';
import { compileActiveContract, initDiagnosticCollection } from './client/compileActive';
import {
    generateNethereumCodeSettingsFile, generateNethereumMultiSettingsFile, codeGenerateNethereumCQSCsharp, codeGenerateNethereumCQSFSharp, codeGenerateNethereumCQSVbNet,
    codeGenerateNethereumCQSCSharpAll, codeGenerateNethereumCQSFSharpAll, codeGenerateNethereumCQSVbAll, autoCodeGenerateAfterCompilation,
    codeGenerateCQS, codeGenerateAllFilesFromAbiInCurrentFolder, codeGenerateAllFilesFromNethereumGenAbisFile,
} from './client/codegen';
import { LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient';
import {
    LanguageClient,
    ServerOptions,
    TransportKind,
  } from 'vscode-languageclient/node';

import { lintAndfixCurrentDocument } from './server/linter/soliumClientFixer';
// tslint:disable-next-line:no-duplicate-imports
import { workspace, WorkspaceFolder } from 'vscode';
import { formatDocument } from './client/formatter/formatter';
import { compilerType } from './common/solcCompiler';
import * as workspaceUtil from './client/workspaceUtil';
import { AddressChecksumCodeActionProvider, ChangeCompilerVersionActionProvider, SPDXCodeActionProvider } from './client/codeActionProviders/addressChecksumActionProvider';
import { EtherscanContractDownloader } from './common/sourceCodeDownloader/etherscanSourceCodeDownloader';

let diagnosticCollection: vscode.DiagnosticCollection;
let compiler: Compiler;

export async function activate(context: vscode.ExtensionContext) {
    const ws = workspace.workspaceFolders;
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
    compiler = new Compiler(context.extensionPath);

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);
    
    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        const compiledResults = await compileActiveContract(compiler);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection, root);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.activeUsingRemote', async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        const compiledResults = await compileActiveContract(compiler, compilerType.remote);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection, root);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.activeUsingLocalFile', async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        const compiledResults = await compileActiveContract(compiler, compilerType.localFile);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection, root);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.activeUsingNodeModule', async () => {
        const compiledResults = await compileActiveContract(compiler, compilerType.localNodeModule);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection);
        return compiledResults;
    }));


    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile', () => {
        compileAllContracts(compiler, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProject', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        codeGenerateNethereumCQSCsharp(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compileAndCodegenCSharpProject', async (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        const compiledResults = await compileActiveContract(compiler);
        compiledResults.forEach(file => {
            codeGenerateCQS(file, 0, args, diagnosticCollection, root);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenNethereumCodeGenSettings', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        generateNethereumCodeSettingsFile(root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.generateNethereumMultiSettingsFile', async (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        generateNethereumMultiSettingsFile(root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProject', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        codeGenerateNethereumCQSVbNet(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compileAndCodegenVbNetProject', async (args: any[]) => {
         const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        const compiledResults = await compileActiveContract(compiler);
        compiledResults.forEach(file => {
            codeGenerateCQS(file, 1, args, diagnosticCollection, root);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProject', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        codeGenerateNethereumCQSFSharp(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compileAndCodegenFSharpProject', async (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        const compiledResults = await compileActiveContract(compiler);
        compiledResults.forEach(file => {
            codeGenerateCQS(file, 3, args, diagnosticCollection, root);
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProjectAll', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        codeGenerateNethereumCQSCSharpAll(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProjectAll', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        codeGenerateNethereumCQSVbAll(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProjectAll', (args: any[]) => {
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        codeGenerateNethereumCQSFSharpAll(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProjectAllAbiCurrent', (args: any[]) => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        codeGenerateAllFilesFromAbiInCurrentFolder(0, args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProjectAllAbiCurrent', (args: any[]) => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        codeGenerateAllFilesFromAbiInCurrentFolder(1, args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProjectAllAbiCurrent', (args: any[]) => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        codeGenerateAllFilesFromAbiInCurrentFolder(3, args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codeGenFromNethereumGenAbisFile', (args: any[]) => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        codeGenerateAllFilesFromNethereumGenAbisFile(args, diagnosticCollection, root);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.fixDocument', () => {
        lintAndfixCurrentDocument();
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

    context.subscriptions.push(vscode.commands.registerCommand('solidity.downloadRemoteSolcVersion', async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        compiler.downloadRemoteVersion(root.uri.fsPath);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.downloadVerifiedSmartContractEtherscan', async () => {
        await EtherscanContractDownloader.downloadContractWithPrompts();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.downloadRemoteVersionAndSetLocalPathSetting', async () => {
        const root = workspaceUtil.getCurrentWorkspaceRootFolder();
        compiler.downloadRemoteVersionAndSetLocalPathSetting(vscode.ConfigurationTarget.Workspace, root.uri.fsPath);
    }));


    context.subscriptions.push(vscode.commands.registerCommand('solidity.selectGlobalRemoteSolcVersion', async () => {
        compiler.selectRemoteVersion(vscode.ConfigurationTarget.Global);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.changeDefaultCompilerType', async () => {
        compiler.changeDefaultCompilerType(vscode.ConfigurationTarget.Workspace);
    }));


    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider('solidity', {
            async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
                return await formatDocument(document, context);
            },
        }));

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('solidity', new AddressChecksumCodeActionProvider(), {
            providedCodeActionKinds: AddressChecksumCodeActionProvider.providedCodeActionKinds,
        }),
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('solidity', new SPDXCodeActionProvider(), {
            providedCodeActionKinds: SPDXCodeActionProvider.providedCodeActionKinds,
        }),
    );


    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('solidity', new ChangeCompilerVersionActionProvider(), {
            providedCodeActionKinds: ChangeCompilerVersionActionProvider.providedCodeActionKinds,
        }),
    );

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
            fileEvents: vscode.workspace.createFileSystemWatcher('{**/remappings.txt,**/.solhint.json,**/.soliumrc.json,**/brownie-config.yaml}'),
        },
        initializationOptions: context.extensionPath,
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


