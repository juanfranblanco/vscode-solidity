'use strict';
import { DiagnosticCollection, window, workspace } from 'vscode';
import { extname } from 'path';
import { compile } from './compiler';
import { ContractCollection } from './model/contracts-collection';
import { initialiseProject } from './project-service';
import { formatPath } from './util';
import { Extensions } from './enums/extensions';

let diagnosticCollection: DiagnosticCollection;

export function initDiagnosticCollection(diagnostics: DiagnosticCollection) {
    diagnosticCollection = diagnostics;
}

export function compileActiveContract(): void {
    const editor = window.activeTextEditor;

    if (!editor) {
        return; // We need something open
    }

    if (extname(editor.document.fileName) !== Extensions.sol) {
        window.showWarningMessage(`This not a solidity file (*${Extensions.sol})`);
        return;
    }

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (workspace.rootPath === undefined) {
        window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    const contractsCollection = new ContractCollection();
    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;

    const packageDefaultDependenciesDirectory = workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    const packageDefaultDependenciesContractsDirectory = workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');

    const project = initialiseProject(workspace.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    const contract = contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
    const packagesPath = formatPath(project.packagesDir);

    compile(contractsCollection.getContractsForCompilation(),
        diagnosticCollection,
        project.projectPackage.build_dir,
        project.projectPackage.absoluletPath,
        null,
        packagesPath,
        contract.absolutePath);
}
