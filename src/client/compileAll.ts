'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {Compiler} from './compiler';
import {SourceDocumentCollection} from '../common/model/sourceDocumentCollection';
import { initialiseProject } from '../common/projectService';
import { formatPath, isPathSubdirectory } from '../common/util';
import * as workspaceUtil from './workspaceUtil';
import { SettingsService } from './settingsService';

export function compileAllContracts(compiler: Compiler, diagnosticCollection: vscode.DiagnosticCollection) {

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (workspaceUtil.getCurrentWorkspaceRootFolder() === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return;
    }
    const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
    const packageDefaultDependenciesDirectory = SettingsService.getPackageDefaultDependenciesDirectories();
    const packageDefaultDependenciesContractsDirectory = SettingsService.getPackageDefaultDependenciesContractsDirectory();
    const compilationOptimisation = SettingsService.getCompilerOptimisation();
    const evmVersion = SettingsService.getEVMVersion();
    const viaIR = SettingsService.getViaIR();
    const remappings = workspaceUtil.getSolidityRemappings();

    const contractsCollection = new SourceDocumentCollection();
    const project = initialiseProject(rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory, remappings);

    // Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?)
    vscode.workspace.textDocuments.forEach(document => {
        if (isPathSubdirectory(rootPath,  document.fileName)) {
            if (path.extname(document.fileName) === '.sol' ) {
                const contractPath = document.fileName;
                const contractCode = document.getText();
                contractsCollection.addSourceDocumentAndResolveImports(contractPath, contractCode, project);
            }
         }
    });

    const documents = project.getAllSolFilesIgnoringDependencyFolders();

    documents.forEach(document => {
        const contractPath = document;
        if (!contractsCollection.containsSourceDocument(contractPath)) {
            const contractCode = fs.readFileSync(contractPath, 'utf8');
            contractsCollection.addSourceDocumentAndResolveImports(contractPath, contractCode, project);
        }
    });
    const sourceDirPath = formatPath(project.projectPackage.getSolSourcesAbsolutePath());
    const packagesPath: string[] = [];
    if (project.packagesDir != null) {
        project.packagesDir.forEach(x => packagesPath.push(formatPath(x)));
    }

    compiler.compile(contractsCollection.getDefaultSourceDocumentsForCompilation(compilationOptimisation, evmVersion, viaIR),
            diagnosticCollection,
            project.projectPackage.build_dir,
            project.projectPackage.absoluletPath,
            sourceDirPath,
            packagesPath);
}


