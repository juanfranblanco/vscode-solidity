'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as codegen from 'nethereum-codegen';
import { initialiseProject } from './projectService';

export function autoCodeGenerateAfterCompilation(compiledFiles: Array<string>, args: any, diagnostics: vscode.DiagnosticCollection) {
    if (compiledFiles !== undefined && compiledFiles.length > 0) {
        const settings = getCodeGenerationSettings();
        if (settings !== undefined ) {
            if (settings.autoCodeGen === true) {
                let lang = 0;
                if (settings.lang !== undefined) {
                        lang = settings.lang;
                }
                compiledFiles.forEach(file => {
                    codeGenerateCQS(file, lang, args, diagnostics);
                });
            }
        }
    }
}

export function getProjectExtensionFromLang(lang: number) {
    switch (lang) {
        case 0:
        return '.csproj';
        case 1:
        return '.vbproj';
        case 3:
        return '.fsproj';
    }
}

export function generateNethereumCodeSettingsFile() {
    const root = vscode.workspace.workspaceFolders[0];
    const settingsFile = path.join(root.uri.fsPath, 'nethereum-gen.settings');
    if (!fs.existsSync(settingsFile)) {

        const prettyRootName = prettifyRootNameAsNamespace(root.name);
        const baseNamespace = prettyRootName + '.Contracts';
        const jsonSettings = {
            'projectName': prettyRootName,
            // tslint:disable-next-line:object-literal-sort-keys
            'namespace': baseNamespace,
            'lang': 0,
            'autoCodeGen': true,
            'projectPath': '../',
        };
        fs.writeFileSync(settingsFile, JSON.stringify(jsonSettings, null, 4));
    }
}

export function codeGenerateNethereumCQSCsharp(args: any, diagnostics: vscode.DiagnosticCollection) {
        const lang = 0;
        const editor = vscode.window.activeTextEditor;
        const fileName = editor.document.fileName;
        codeGenerateCQS(fileName, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSVbNet(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 1;
    const editor = vscode.window.activeTextEditor;
    const fileName = editor.document.fileName;
    codeGenerateCQS(fileName, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharp(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 3;
    const editor = vscode.window.activeTextEditor;
    const fileName = editor.document.fileName;
    codeGenerateCQS(fileName, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSVbAll(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 1;
    codeGenerateAllFiles(lang, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharpAll(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 3;
    codeGenerateAllFiles(lang, args, diagnostics);
}

export function codeGenerateNethereumCQSCSharpAll(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 0;
    codeGenerateAllFiles(lang, args, diagnostics);
}

function getBuildPath() {
    const packageDefaultDependenciesDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    const packageDefaultDependenciesContractsDirectory = vscode.workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const project = initialiseProject(rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    return path.join(rootPath, project.projectPackage.build_dir);
}

function codeGenerateAllFiles(lang: number, args: any, diagnostics: vscode.DiagnosticCollection) {
    const buildPath = getBuildPath();
    const outputPath = '**/*.json';
    const files = vscode.workspace.findFiles(outputPath, null, 1000);
    files.then(documents => {
        documents.forEach(document => {
            if (document.fsPath.startsWith(buildPath)) {
             codeGenerateCQS(document.fsPath, lang, args, diagnostics);
            }
        });
    });
}

function getCodeGenerationSettings() {
    const root = vscode.workspace.workspaceFolders[0];
    const settingsFile = path.join(root.uri.fsPath, 'nethereum-gen.settings');
    if (fs.existsSync(settingsFile)) {
        const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        return settings;
    }
    return undefined;
}

function codeGenerateCQS(fileName: string, lang: number, args: any, diagnostics: vscode.DiagnosticCollection) {
        try {
            const extension = getProjectExtensionFromLang(lang);
            const root = vscode.workspace.workspaceFolders[0];
            const settings = getCodeGenerationSettings();
            const prettyRootName = prettifyRootNameAsNamespace(root.name);
            let baseNamespace = prettyRootName + '.Contracts';
            let projectName = baseNamespace;
            let projectPath = path.join(root.uri.fsPath);

            if (settings !== undefined) {
                if (settings.projectName !== undefined) {
                   projectName = settings.projectName;
                   baseNamespace = settings.namespace;
                }

                if (settings.projectPath !== undefined) {
                    projectPath = path.join(projectPath, settings.projectPath);
                }
            }
            const outputPathInfo = path.parse(fileName);
            const contractName = outputPathInfo.name;

            const compilationOutput = JSON.parse(fs.readFileSync(fileName, 'utf8'));
            if (compilationOutput.abi !== undefined) {
                const abi = JSON.stringify(compilationOutput.abi);
                const contractByteCode = compilationOutput.bytecode;
                const projectFullPath = path.join(projectPath, projectName + extension);

                if (!fs.existsSync(projectFullPath)) {
                    codegen.generateNetStandardClassLibrary(projectName, projectPath, lang);
                }

                codegen.generateAllClasses(abi,
                    contractByteCode,
                    contractName,
                    baseNamespace,
                    projectPath,
                    lang);
            }
        } catch (e) {
            const outputChannel = vscode.window.createOutputChannel('solidity code generation');
            outputChannel.clear();
            outputChannel.appendLine('Error generating code:');
            outputChannel.appendLine(e.message);
            outputChannel.show();
        }
    }

    // remove - and make upper case
    function prettifyRootNameAsNamespace(value: string) {
        return value.split('-').map(function capitalize(part) {
            return part.charAt(0).toUpperCase() + part.slice(1);
        }).join('');
    }

