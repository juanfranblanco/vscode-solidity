'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import { compile } from './compiler';
import { ContractCollection } from './model/contractsCollection';
import { initialiseProject } from './projectService';
import { formatPath } from './util';

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
    diagnosticCollection = diagnostics;
}

export function compileActiveContract() {
    let editor = vscode.window.activeTextEditor;

    if (!editor) {
        return; // We need something open
    }

    if (path.extname(editor.document.fileName) !== '.sol') {
        vscode.window.showWarningMessage('This not a solidity file (*.sol)');
        return;
    }

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    let contractsCollection = new ContractCollection();
    let contractCode = editor.document.getText();
    let contractPath = editor.document.fileName;

    let packageDefaultDependenciesDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    let packageDefaultDependenciesContractsDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');

    let project = initialiseProject(vscode.workspace.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    let contract = contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
    let packagesPath = formatPath(project.packagesDir);

    compile(contractsCollection.getContractsForCompilation(),
            diagnosticCollection,
            project.projectPackage.build_dir,
            project.projectPackage.absoluletPath,
            null,
            packagesPath,
            contract.absolutePath);
}
