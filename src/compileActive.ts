'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import {compile} from './compiler';
import {ContractCollection} from './model/contractsCollection';
import * as projService from './projectService';
import * as util from './util';

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
    diagnosticCollection = diagnostics;
}

export function compileActiveContract() {
    const editor = vscode.window.activeTextEditor;

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

    const contractsCollection = new ContractCollection();
    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;

    const packageDefaultDependenciesDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    const packageDefaultDependenciesContractsDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');

    const project = projService.initialiseProject(vscode.workspace.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    const contract = contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
    const packagesPath = util.formatPath(project.packagesDir);

    compile(contractsCollection.getContractsForCompilation(),
            diagnosticCollection,
            project.projectPackage.build_dir,
            project.projectPackage.absoluletPath,
            null,
            packagesPath,
            contract.absolutePath);
}
