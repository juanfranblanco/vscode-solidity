'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import {Compiler} from './compiler';
import {ContractCollection} from './model/contractsCollection';
import { initialiseProject } from './projectService';
import { formatPath } from './util';


let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
    diagnosticCollection = diagnostics;
}

export function compileActiveContract(compiler: Compiler): Promise<Array<string>> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        return; // We need something open
    }

    if (path.extname(editor.document.fileName) !== '.sol') {
        vscode.window.showWarningMessage('This not a solidity file (*.sol)');
        return;
    }

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.workspaceFolders[0] === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    const contractsCollection = new ContractCollection();
    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;

    const packageDefaultDependenciesDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    const packageDefaultDependenciesContractsDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');
    const compilationOptimisation = vscode.workspace.getConfiguration('solidity').get<number>('compilerOptimization');
    const project = initialiseProject(vscode.workspace.workspaceFolders[0].uri.fsPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    const contract = contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
    const packagesPath = formatPath(project.packagesDir);

    return compiler.compile(contractsCollection.getDefaultContractsForCompilation(compilationOptimisation),
            diagnosticCollection,
            project.projectPackage.build_dir,
            project.projectPackage.absoluletPath,
            null,
            packagesPath,
            contract.absolutePath);
}
