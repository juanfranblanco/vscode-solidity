'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import {compileAllContracts} from './compileAll';
import {compileActiveContract, initDiagnosticCollection} from './compileActive';
import {codeGenerate, codeGenerateNethereumCQSCsharp, codeGenerateNethereumCQSFSharp, codeGenerateNethereumCQSVbNet,
    codeGenerateNethereumCQSCSharpAll, codeGenerateNethereumCQSFSharpAll, codeGenerateNethereumCQSVbAll} from './codegen';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, RevealOutputChannelOn} from 'vscode-languageclient';
import {lintAndfixCurrentDocument} from './linter/soliumClientFixer';
import {mythxAnalyze, mythxVersion} from './analysis/mythx';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(vscode.commands.registerCommand('solidity.mythx.analyze', async () => {
        const res = await mythxAnalyze();
        return res;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.mythx.version', () => {
        mythxVersion();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', () => {
        compileActiveContract();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile', () => {
        compileAllContracts(diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegen', (args: any[]) => {
        codeGenerate(args, diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegenCSharpProject', (args: any[]) => {
        codeGenerateNethereumCQSCsharp(args, diagnosticCollection);
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

    const clientDisposable = new LanguageClient(
        'solidity',
        'Solidity Language Server',
        serverOptions,
        clientOptions).start();

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(clientDisposable);
}
