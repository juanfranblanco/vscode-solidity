'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { compileAllContracts } from './client/compileAll';
import { Compiler } from './client/compiler';
import { compileActiveContract, initDiagnosticCollection } from './client/compileActive';
import {
    generateNethereumCodeSettingsFile, codeGenerateNethereumCQSCsharp, codeGenerateNethereumCQSFSharp, codeGenerateNethereumCQSVbNet,
    codeGenerateNethereumCQSCSharpAll, codeGenerateNethereumCQSFSharpAll, codeGenerateNethereumCQSVbAll, autoCodeGenerateAfterCompilation,
    codeGenerateCQS, codeGenerateAllFilesFromAbiInCurrentFolder,
} from './client/codegen';
import { LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient';
import {
    LanguageClient,
    ServerOptions,
    TransportKind,
  } from 'vscode-languageclient/node';

import { lintAndfixCurrentDocument } from './server/linter/soliumClientFixer';
// tslint:disable-next-line:no-duplicate-imports
import { workspace } from 'vscode';
import { formatDocument } from './client/formatter/formatter';
import { compilerType } from './common/solcCompiler';
import * as workspaceUtil from './client/workspaceUtil';
import { defaultEnvironmentConfiguration, DevelopmentEnvironment } from './environments/env';
import {  constructTestResultOutput, parseTestResults } from './environments/tests';

let diagnosticCollection: vscode.DiagnosticCollection;
let compiler: Compiler;
let testOutputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    const ws = workspace.workspaceFolders;
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
    compiler = new Compiler(context.extensionPath);

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

    // Attach a handler which sets the default configuration for environment related config.
    // This triggers both when a user sets it or when we detect it automatically.
    context.subscriptions.push(workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration('solidity.developmentEnvironment')) {
            return;
        }
        const newConfig = vscode.workspace.getConfiguration('solidity');
        const newEnv = newConfig.get<DevelopmentEnvironment>('developmentEnvironment');
        const vaulesToSet = defaultEnvironmentConfiguration[newEnv];
        if (!vaulesToSet) {
            return;
        }
        for (const [k, v] of Object.entries(vaulesToSet)) {
            if (newConfig.get(k) === v.default) {
                newConfig.update(k, v.target, null);
            }
        }
    }));

    // Detect development environment if the configuration is not already set.
    const loadTimeConfig = vscode.workspace.getConfiguration('solidity');
    const existingDevEnv = loadTimeConfig.get<DevelopmentEnvironment>('developmentEnvironment');
    if (!existingDevEnv) {
        const detectedEnv = await detectDevelopmentEnvironment();
        if (detectedEnv) {
            loadTimeConfig.update('developmentEnvironment', detectedEnv, null);
        }
    }

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', async () => {
        const compiledResults = await compileActiveContract(compiler);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.activeUsingRemote', async () => {
        const compiledResults = await compileActiveContract(compiler, compilerType.remote);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.activeUsingLocalFile', async () => {
        const compiledResults = await compileActiveContract(compiler, compilerType.localFile);
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection);
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
                return formatDocument(document, context);
            },
        }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.runTests', async (params) => {
        const testCommand = vscode.workspace.getConfiguration('solidity').get<string>('test.command');
        if (!testCommand) {
            return;
        }
        if (!testOutputChannel) {
            testOutputChannel = vscode.window.createOutputChannel('Solidity Tests');
        }

        // If no URI supplied to task, use the current active editor.
        let uri = params?.uri;
        if (!uri) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                uri = editor.document.uri;
            }
        }

        const rootFolder = getFileRootPath(uri);
        if (!rootFolder) {
            console.error("Couldn't determine root folder for document", {uri});
            return;
        }

        testOutputChannel.clear();
        testOutputChannel.show();
        testOutputChannel.appendLine(`Running '${testCommand}'...`);
        testOutputChannel.appendLine('');
        try {
            const result = await executeTask(rootFolder, testCommand, false);
            const parsed = parseTestResults(result);
            // If we couldn't parse the output, just write it to the window.
            if (!parsed) {
                testOutputChannel.appendLine(result);
                return;
            }

            const out = constructTestResultOutput(parsed);
            out.forEach(testOutputChannel.appendLine);

        } catch (err) {
            console.log('Unexpected error running tests:', err);
        }
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

const detectDevelopmentEnvironment = async (): Promise<string> => {
    const foundry = await workspace.findFiles('foundry.toml');
    const hardhat = await workspace.findFiles('hardhat.config.js');

    // If we found evidence of multiple workspaces, don't select a default.
    if (foundry.length && hardhat.length) {
        return DevelopmentEnvironment.None;
    }

    if (foundry.length) {
        return DevelopmentEnvironment.Forge;
    }

    if (hardhat.length) {
        return DevelopmentEnvironment.Hardhat;
    }
    return DevelopmentEnvironment.None;
};

const getFileRootPath = (uri: vscode.Uri): string | null => {
    const folders = vscode.workspace.workspaceFolders;
    for (const f of folders) {
        if (uri.path.startsWith(f.uri.path)) {
            return f.uri.path;
        }
    }
    return null;
};

const executeTask = (dir: string, cmd: string, rejectOnFailure: boolean) => {
    return new Promise<string>((resolve, reject) => {
        cp.exec(cmd, {cwd: dir, maxBuffer: 1024 * 1024 * 10}, (err, out) => {
            if (err) {
                if (rejectOnFailure) {
                    return reject({out, err});
                }
                return resolve(out);
            }
            return resolve(out);
        });
    });
};
