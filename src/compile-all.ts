'use strict';
import { workspace, window, DiagnosticCollection } from 'vscode';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { compile } from './compiler';
import { ContractCollection } from './model/contracts-collection';
import { initialiseProject } from './project-service';
import { formatPath } from './util';
import { Extensions } from './enums/extensions';

export function compileAllContracts(diagnosticCollection: DiagnosticCollection): Thenable<void> {

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (workspace.rootPath === undefined) {
        window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    const packageDefaultDependenciesDirectory = workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    const packageDefaultDependenciesContractsDirectory = workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');

    const contractsCollection = new ContractCollection();
    const project = initialiseProject(workspace.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    let solidityPath = `**/*${Extensions.sol}`;
    if (project.projectPackage.sol_sources !== undefined && project.projectPackage.sol_sources !== '') {
        solidityPath = project.projectPackage.sol_sources + '/' + solidityPath;
    }

    // TODO parse excluded files
    let excludePath = '**/bin/**';
    if (project.projectPackage.build_dir !== undefined || project.projectPackage.build_dir === '') {
        excludePath = '**/' + project.projectPackage.build_dir + '/**';
    }

    // Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?)
    workspace.textDocuments.forEach(document => {

        if (extname(document.fileName) === Extensions.sol) {
            const contractPath = document.fileName;
            const contractCode = document.getText();

            contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
        }
    });

    // Find all the other sol files, to compile them (1000 maximum should be enough for now)
    const files = workspace.findFiles(solidityPath, excludePath, 1000);

    return files.then(documents => {

        documents.forEach(document => {
            const contractPath = document.fsPath;

            // have we got this already opened? used those instead
            if (!contractsCollection.containsContract(contractPath)) {
                const contractCode = readFileSync(document.fsPath, 'utf8');
                contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
            }
        });

        const sourceDirPath = formatPath(project.projectPackage.getSolSourcesAbsolutePath());
        const packagesPath = formatPath(project.packagesDir);

        compile(contractsCollection.getContractsForCompilation(),
            diagnosticCollection,
            project.projectPackage.build_dir,
            project.projectPackage.absoluletPath,
            sourceDirPath,
            packagesPath);

    });
}


