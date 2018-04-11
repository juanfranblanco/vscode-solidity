'use strict';
import * as vscode from 'vscode';
import * as abicodegen from 'abi-code-gen';
import * as fs from 'fs';
import * as path from 'path';
import * as codegen from 'nethereum-codegen';

export function codeGenerate(args: any, diagnostics: vscode.DiagnosticCollection) {
    try {
        let editor = vscode.window.activeTextEditor;
        abicodegen.generateCode(editor.document.fileName, 'cs-service');
    } catch (e) {
        let outputChannel = vscode.window.createOutputChannel('solidity code generation');
        outputChannel.clear();
        outputChannel.appendLine('Error generating code:');
        outputChannel.appendLine(e.message);
        outputChannel.show();
    }
}

export function codeGenerateNethereumCQSCsharp(args: any, diagnostics: vscode.DiagnosticCollection) {
        let extension = '.csproj';
        let lang = 0;
        codeGenerateCQS(extension, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSVbNet(args: any, diagnostics: vscode.DiagnosticCollection) {
    let extension = '.vbproj';
    let lang = 1;
    codeGenerateCQS(extension, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharp(args: any, diagnostics: vscode.DiagnosticCollection) {
    let extension = '.fsproj';
    let lang = 3;
    codeGenerateCQS(extension, lang, args, diagnostics);
}

function codeGenerateCQS(extension: string, lang: number, args: any, diagnostics: vscode.DiagnosticCollection) {
        try {

            let editor = vscode.window.activeTextEditor;
            let root = vscode.workspace.workspaceFolders[0];
            let prettyRootName = prettifyRootNameAsNamespace(root.name);
            let baseNamespace = prettyRootName + '.Contracts';
            let projectName = baseNamespace + extension;

            let fileName = editor.document.fileName;
            let outputPathInfo = path.parse(fileName);
            let contractName = outputPathInfo.name;

            let projectPath = path.join(root.uri.fsPath, baseNamespace);
            let compilationOutput = JSON.parse(fs.readFileSync(fileName, 'utf8'));
            let abi = compilationOutput.abi;
            let contractByteCode = compilationOutput.bytecode;
            codegen.generateNetStandardClassLibrary(projectName, projectPath);

            codegen.generateAllClasses(abi,
                contractByteCode,
                contractName,
                baseNamespace,
                projectPath,
                lang);
        } catch (e) {
            let outputChannel = vscode.window.createOutputChannel('solidity code generation');
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

