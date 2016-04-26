'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import {compile, compileAndHighlightErrors} from './compiler';

let diagnosticCollection: vscode.DiagnosticCollection;

export function highlightErrors(eventArgs: vscode.TextDocumentChangeEvent) {
    if (eventArgs.contentChanges.length > 0 && eventArgs.contentChanges[0].text !== "\r\n") {
        let editor = vscode.window.activeTextEditor;
        let contracts = {};
        let contractCode = editor.document.getText();
        let contractPath = editor.document.fileName.replace(/\\/g, '/');
        contracts[contractPath] = contractCode;
        findImportsToStructure(contractCode, contractPath, contracts);
        compileAndHighlightErrors(contracts, diagnosticCollection);
    }
}

export function initDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
    diagnosticCollection = diagnostics;
}

export function compileActiveContract() {

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        return; // We need something open
    }

    //Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    let contracts = {};
    let contractCode = editor.document.getText();
    let contractPath = editor.document.fileName.replace(/\\/g, '/');
    contracts[contractPath] = contractCode;
    findImportsToStructure(contractCode, contractPath, contracts);
    compile(contracts, diagnosticCollection, contractPath);

}

function findImportsToStructure(contractCode: string, contractPath: string, contracts: any) {
    let importRegEx = /import\s+['"](.*)['"]\s*/gm;
    let foundImport = importRegEx.exec(contractCode);
    while (foundImport != null) {
        let importFullPath = path.resolve(path.dirname(contractPath), foundImport[1]).replace(/\\/g, '/');
        //check if exists if it doesn't it wiill error compiling
        if (fs.existsSync(importFullPath)) {
            if (!contracts.hasOwnProperty(importFullPath)) {
                let importContractCode = fs.readFileSync(importFullPath, "utf8");
                contracts[importFullPath] = importContractCode;
                findImportsToStructure(importContractCode, importFullPath, contracts);
            }
        }
        foundImport = importRegEx.exec(contractCode);
    }
}
