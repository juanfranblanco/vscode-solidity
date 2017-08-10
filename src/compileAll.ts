'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {compile} from './compiler';
import {ContractCollection} from './model/contractsCollection';
import * as projService from './projectService';
import * as util from './util';


export function compileAllContracts(diagnosticCollection: vscode.DiagnosticCollection) {

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    let contractsCollection = new ContractCollection();
    let project = projService.initialiseProject(vscode.workspace.rootPath);
    let solidityPath = '**/*.sol';
    if (project.projectPackage.sol_sources !== undefined || project.projectPackage.sol_sources === '') {
        solidityPath = project.projectPackage.sol_sources + '/' + solidityPath;
    }

    // TODO parse excluded files
    let excludePath = '**/bin/**';
    if (project.projectPackage.build_dir !== undefined || project.projectPackage.build_dir === '') {
        excludePath = '**/' + project.projectPackage.build_dir + '/**';
    }

    // Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?) 
    vscode.workspace.textDocuments.forEach(document => {

        if (path.extname(document.fileName) === '.sol') {
            let contractPath = document.fileName;
            let contractCode = document.getText();
            contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
        }
    });

    // Find all the other sol files, to compile them (1000 maximum should be enough for now)
    let files = vscode.workspace.findFiles(solidityPath, excludePath, 1000);

    return files.then(documents => {

        documents.forEach(document => {
            let contractPath = document.fsPath;

            // have we got this already opened? used those instead
            if (!contractsCollection.containsContract(contractPath)) {
                let contractCode = fs.readFileSync(document.fsPath, 'utf8');
                contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
            }
        });
        let sourceDirPath = util.formatPath(project.projectPackage.getSolSourcesAbsolutePath());
        let packagesPath = util.formatPath(project.packagesDir);
        compile(contractsCollection.getContractsForCompilation(),
                diagnosticCollection,
                project.projectPackage.build_dir,
                sourceDirPath,
                packagesPath);

    });
}


