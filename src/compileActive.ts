'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as readyaml from 'read-yaml';
import {compile, compileAndHighlightErrors} from './compiler';
import {ContractCollection, Package, Contract, Project} from './contractsCollection';

const packageConfigFileName = 'dappfile';
const packageDependenciesDirectory = 'dapple-packages';

function createPackage(rootPath: string) {
    let projectPackageFile = path.join(rootPath, packageConfigFileName);
    if (fs.existsSync(projectPackageFile)) {
        let packageConfig = readyaml.sync(projectPackageFile);
        var projectPackage = new Package();
        projectPackage.absoluletPath = rootPath;
        projectPackage.build_dir = packageConfig.layout.build_dir;
        projectPackage.sol_sources = packageConfig.layout.sol_sources;
        projectPackage.name = packageConfig.name;
        projectPackage.version = packageConfig.version;
        projectPackage.dependencies = packageConfig.dependencies;
        //todo automapper
        return projectPackage;
    }
    return null;
}



function initialiseProject() {
    let projectPackage = createProjectPackage(vscode.workspace.rootPath);
    let dependencies = loadDependencies(vscode.workspace.rootPath, projectPackage);
    return new Project(projectPackage, dependencies);
}

function loadDependencies(rootPath: string, projectPackage: Package, depPackages: Array<Package> = new Array<Package>()) {
    if (projectPackage.dependencies != undefined) {
        Object.keys(projectPackage.dependencies).forEach(dependency => {
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name == dependency)) {
                let depPackagePath = path.join(rootPath, packageDependenciesDirectory, dependency);
                let depPackage = createPackage(depPackagePath);

                if (depPackage !== null) {
                    depPackages.push(depPackage);
                    //Assumed the package manager will install all the dependencies at root so adding all the existing ones
                    loadDependencies(rootPath, depPackage, depPackages);
                } else {
                    //should warn user of a package dependency missing
                }
            }
        });
    }
    return depPackages;
}

function createProjectPackage(rootPath: string) {
    let projectPackage = createPackage(rootPath);
    //Default project package,this could be passed as a function
    if (projectPackage === null) {
        projectPackage = new Package();
        projectPackage.absoluletPath = vscode.workspace.rootPath;
        projectPackage.build_dir = "bin";
        projectPackage.sol_sources = ".";
    }
    return projectPackage;
}




let diagnosticCollection: vscode.DiagnosticCollection;

//this needs to be moved to a server
export function highlightErrors(eventArgs: vscode.TextDocumentChangeEvent) {
    if (eventArgs.contentChanges.length > 0 && eventArgs.contentChanges[0].text !== "\r\n") {
        let editor = vscode.window.activeTextEditor;
        let contractsCollection = new ContractCollection();
        let contractCode = editor.document.getText();
        let contractPath = editor.document.fileName;
        contractsCollection.addContractAndResolveImports(contractPath, contractCode, initialiseProject());
        compileAndHighlightErrors(contractsCollection.contracts, diagnosticCollection);
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
    
    if(path.extname(editor.document.fileName) !== '.sol'){
        vscode.window.showWarningMessage('This not a solidity file (*.sol)');
        return;
    }

    //Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }

    let contractsCollection = new ContractCollection();
    let contractCode = editor.document.getText();
    let contractPath = editor.document.fileName;
    contractsCollection.addContractAndResolveImports(contractPath, contractCode, initialiseProject());
    compile(contractsCollection.getContractsForCompilation(), diagnosticCollection, contractPath);

}

