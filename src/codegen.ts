'use strict';
import * as vscode from 'vscode';
import * as abicodegen from 'abi-code-gen';

export function codeGenerate(args: any, diagnostics: vscode.DiagnosticCollection) {
    try {
        let editor = vscode.window.activeTextEditor;
        abicodegen.generateCode(editor.document.fileName, 'cs-service');
    } catch (e) {
        let outputChannel = vscode.window.createOutputChannel('solidity code generation');
        outputChannel.clear();
        outputChannel.appendLine('Error generating code:')
        outputChannel.appendLine(e.message);
        outputChannel.show();
    }
}

