'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import {compile, compileAndHighlightErrors} from './compiler';

let diagnosticCollection: vscode.DiagnosticCollection;

//this needs to be moved to a server
export function highlightErrors(eventArgs: vscode.TextDocumentChangeEvent) {
    if (eventArgs.contentChanges.length > 0 && eventArgs.contentChanges[0].text !== "\r\n") {
        let editor = vscode.window.activeTextEditor;
        let contracts = {};
        let contractCode = editor.document.getText();
        let contractPath = editor.document.fileName.replace(/\\/g, '/');
        contracts[contractPath] = contractCode;
        findAllContractsImported(contractCode, contractPath, contracts);
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
    findAllContractsImported(contractCode, contractPath, contracts);
    compile(contracts, diagnosticCollection, contractPath);

}

function findAllContractsImported(contractCode: string, contractPath: string, contractsFound: any) {
    let importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
    let foundImport = importRegEx.exec(contractCode);
    while (foundImport != null) {
        let importFullPath = path.resolve(path.dirname(contractPath), foundImport[1]).replace(/\\/g, '/');
        //check if exists if it doesn't it will error compiling
        if (fs.existsSync(importFullPath)) {
            //have we found it already? Is it referenced already?
            if (!contractsFound.hasOwnProperty(importFullPath)) {
                let importContractCode = fs.readFileSync(importFullPath, "utf8");
                contractsFound[importFullPath] = importContractCode;
                //lets find all the contracts this one imports
                findAllContractsImported(importContractCode, importFullPath, contractsFound);
            }
        }
        foundImport = importRegEx.exec(contractCode);
    }
}
