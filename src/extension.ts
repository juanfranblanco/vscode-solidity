'use strict';
import * as vscode from 'vscode';
import {compileAllContracts} from './compileAll';
import {compileActiveContract, initDiagnosticCollection, highlightErrors} from './compileActive';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {


    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
    context.subscriptions.push(diagnosticCollection);

    // TODO: This is required for highlightErrors on the fly move to a server
    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile.active', () => {
        compileActiveContract();
    }));


    context.subscriptions.push(vscode.commands.registerCommand('solidity.compile', () => {
        compileAllContracts(diagnosticCollection);
    }));

    // Commented out to disable error hightlighting on the fly is very slow this needs to be put in a server
    // vscode.workspace.onDidChangeTextDocument(highlightErrors, this, context.subscriptions);

}

// this method is called when your extension is deactivated
export function deactivate() {
}