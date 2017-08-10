'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {compileAllContracts} from './compileAll';
import {compileActiveContract, initDiagnosticCollection} from './compileActive';
import {codeGenerate} from './codegen';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', () => {
        compileActiveContract();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile', () => {
        compileAllContracts(diagnosticCollection);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('solidity.codegen', (args: any[]) => {
        codeGenerate(args, diagnosticCollection);
    }));

    const serverModule = path.join(__dirname, 'server.js');

    const serverOptions: ServerOptions = {
        debug: {
            module: serverModule,
            options: {
                execArgv: ['--nolazy', '--debug=6004'],
            },
            transport: TransportKind.ipc,
        },
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: ['solidity'],
    };

    const client = new LanguageClient(
        'solidity',
        'Solidity Language Server',
        serverOptions,
        clientOptions);

    context.subscriptions.push(client.start());
}
