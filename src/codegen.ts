'use strict';
import { DiagnosticCollection, window, workspace, Uri } from 'vscode';
import * as abicodegen from 'abi-code-gen';
import { existsSync, readFileSync } from 'fs';
import { join, parse } from 'path';
import * as codegen from 'nethereum-codegen/app';
import { initialiseProject } from './project-service';
import { Extensions } from './enums/extensions';

export function codeGenerate(args: any, diagnostics: DiagnosticCollection): void {
    try {
        const editor = window.activeTextEditor;
        abicodegen.generateCode(editor.document.fileName, 'cs-service');
    } catch (e) {
        const outputChannel = window.createOutputChannel('solidity code generation');
        outputChannel.clear();
        outputChannel.appendLine('Error generating code:');
        outputChannel.appendLine(e.message);
        outputChannel.show();
    }
}

export function codeGenerateNethereumCQSCsharp(args: any, diagnostics: DiagnosticCollection): void {
    const editor = window.activeTextEditor;
    codeGenerateCQS(editor.document.fileName, Extensions.cs, 0, args, diagnostics);
}

export function codeGenerateNethereumCQSVbNet(args: any, diagnostics: DiagnosticCollection): void {
    const editor = window.activeTextEditor;
    codeGenerateCQS(editor.document.fileName, Extensions.vb, 1, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharp(args: any, diagnostics: DiagnosticCollection): void {
    const editor = window.activeTextEditor;
    codeGenerateCQS(editor.document.fileName, Extensions.fs, 3, args, diagnostics);
}

export function codeGenerateNethereumCQSVbAll(args: any, diagnostics: DiagnosticCollection): void {
    codeGenerateAllFiles(Extensions.vb, 1, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharpAll(args: any, diagnostics: DiagnosticCollection): void {
    codeGenerateAllFiles(Extensions.fs, 3, args, diagnostics);
}

export function codeGenerateNethereumCQSCSharpAll(args: any, diagnostics: DiagnosticCollection): void {
    codeGenerateAllFiles(Extensions.cs, 0, args, diagnostics);
}

function getBuildPath(): string {
    const packageDefaultDependenciesDirectory = workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesDirectory');
    const packageDefaultDependenciesContractsDirectory = workspace.getConfiguration('solidity').get<string>('packageDefaultDependenciesContractsDirectory');

    const project = initialiseProject(workspace.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory);
    return join(workspace.rootPath, project.projectPackage.build_dir);
}

function codeGenerateAllFiles(extension: Extensions, lang: number, args: any, diagnostics: DiagnosticCollection): void {
    const buildPath = getBuildPath();
    const outputPath = '**/*.json';
    const files = workspace.findFiles(outputPath, null, 1000);

    files.then((documents: Uri[]) => {
        documents.forEach(document => {
            if (document.fsPath.startsWith(buildPath)) {
                codeGenerateCQS(document.fsPath, extension, lang, args, diagnostics);
            }
        });
    });
}

function codeGenerateCQS(fileName: string, extension: Extensions, lang: number, args: any, diagnostics: DiagnosticCollection): void {
    try {
        const root = workspace.workspaceFolders[0];
        const settingsFile = join(root.uri.fsPath, 'nethereum-gen.settings');
        const prettyRootName = prettifyRootNameAsNamespace(root.name);
        let baseNamespace = prettyRootName + '.Contracts';
        let projectName = baseNamespace + extension;

        if (existsSync(settingsFile)) {
            const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
            if (settings.projectName !== undefined) {
                projectName = settings.projectName;
                baseNamespace = settings.namespace;
            }
        }

        const outputPathInfo = parse(fileName);
        const contractName = outputPathInfo.name;

        const projectPath = join(root.uri.fsPath, baseNamespace);
        const compilationOutput = JSON.parse(readFileSync(fileName, 'utf8'));
        const abi = compilationOutput.abi;
        const contractByteCode = compilationOutput.bytecode;

        codegen.generateNetStandardClassLibrary(projectName, projectPath, lang);
        codegen.generateAllClasses(abi, contractByteCode, contractName, baseNamespace, projectPath, lang);

    } catch (e) {
        const outputChannel = window.createOutputChannel('solidity code generation');
        outputChannel.clear();
        outputChannel.appendLine('Error generating code:');
        outputChannel.appendLine(e.message);
        outputChannel.show();
    }
}

// remove - and make upper case
function prettifyRootNameAsNamespace(value: string): string {
    return value.split('-').map(function capitalize(part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');
}

