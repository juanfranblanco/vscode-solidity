'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import {compileAllContracts} from './compileAll';
import {compileActiveContract, initDiagnosticCollection} from './compileActive';
import {generateNethereumCodeSettingsFile, codeGenerateNethereumCQSCsharp, codeGenerateNethereumCQSFSharp, codeGenerateNethereumCQSVbNet,
    codeGenerateNethereumCQSCSharpAll, codeGenerateNethereumCQSFSharpAll, codeGenerateNethereumCQSVbAll, autoCodeGenerateAfterCompilation} from './codegen';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, RevealOutputChannelOn, WorkspaceChange} from 'vscode-languageclient';
import {lintAndfixCurrentDocument} from './linter/soliumClientFixer';
import { analyzeContract } from './analysers/mythx/commands/analyzeContract';
// tslint:disable-next-line:no-duplicate-imports
import { workspace, WorkspaceFolder } from 'vscode';
import {formatDocument} from './formatter/prettierFormatter';

let diagnosticCollection: vscode.DiagnosticCollection;
let mythxDiagnostic: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');

    mythxDiagnostic = vscode.languages.createDiagnosticCollection('mythx');

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', async () => {
        const compiledResults = await compileActiveContract();
        autoCodeGenerateAfterCompilation(compiledResults, null, diagnosticCollection);
        return compiledResults;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile', () => {
        compileAllContracts(diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProject', (args: any[]) => {
        codeGenerateNethereumCQSCsharp(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenNethereumCodeGenSettings', (args: any[]) => {
        generateNethereumCodeSettingsFile();
    }));


    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenVbNetProject', (args: any[]) => {
        codeGenerateNethereumCQSVbNet(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenFSharpProject', (args: any[]) => {
        codeGenerateNethereumCQSFSharp(args, diagnosticCollection);
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

    context.subscriptions.push(vscode.commands.registerCommand('solidity.fixDocument', () => {
        lintAndfixCurrentDocument();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.runMythx', async (fileUri: vscode.Uri) => {
        analyzeContract(mythxDiagnostic, fileUri);
    }));

    context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('solidity', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            return formatDocument(document, context);
    }}));

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
    };

    const ws: WorkspaceFolder[] | undefined = workspace.workspaceFolders;

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
