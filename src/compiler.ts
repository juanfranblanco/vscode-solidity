'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';

export function compileAndHighlightErrors(contracts: any, diagnosticCollection: vscode.DiagnosticCollection) {
    let output = solc.compile({ sources: contracts }, 1);
    diagnosticCollection.clear();
    if (output.errors) {
        outputErrorsToDiagnostics(diagnosticCollection, output.errors);
    }
}

function outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any) {
    errors.forEach(error => {
        outputChannel.appendLine(error);
    });
    outputChannel.show();
}

interface ErrorWarningCounts {
    errors: number;
    warnings: number;
}

function getDiagnosticSeverity(sev: string, errorWarningCounts: ErrorWarningCounts): vscode.DiagnosticSeverity {
    switch (sev) {
        case ' Error':
            errorWarningCounts.errors++;
            return vscode.DiagnosticSeverity.Error;
        case ' Warning':
            errorWarningCounts.warnings++;
            return vscode.DiagnosticSeverity.Warning;
        default:
            errorWarningCounts.errors++;
            return vscode.DiagnosticSeverity.Error;
    }
}

function outputErrorsToDiagnostics(diagnosticCollection: vscode.DiagnosticCollection, errors: any): ErrorWarningCounts {
    let errorWarningCounts: ErrorWarningCounts = {errors: 0, warnings: 0};
    let diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();
    errors.forEach(error => {
        let errorSplit = error.split(':');
        let fileName = errorSplit[0];
        let index = 1;
        // a full path in windows includes a : for the drive
        if (process.platform === 'win32') {
            fileName = errorSplit[0] + ':' + errorSplit[1];
            index = 2;
        }

        let line = parseInt(errorSplit[index]);
        let column = parseInt(errorSplit[index + 1]);
        let severity = getDiagnosticSeverity(errorSplit[index + 2], errorWarningCounts);
        
        let targetUri = vscode.Uri.file(fileName);
        let range = new vscode.Range(line - 1, column, line - 1, column);
        let diagnostic = new vscode.Diagnostic(range, error, severity);
        let diagnostics = diagnosticMap.get(targetUri);
        if (!diagnostics) {
            diagnostics = [];
        }
        diagnostics.push(diagnostic);
        diagnosticMap.set(targetUri, diagnostics);
    });
    let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
    diagnosticMap.forEach((diags, uri) => {
        entries.push([uri, diags]);
    });
    diagnosticCollection.set(entries);
    return errorWarningCounts;
}

// TODO: decouple compilation of error reporting formatters (passed as a function), and saving to disk

export function compile(contracts: any,
                        diagnosticCollection: vscode.DiagnosticCollection,
                        buildDir: string, sourceDir: string, excludePath?: string, singleContractFilePath?: string) {

    // Did we find any sol files after all?
    if (Object.keys(contracts).length === 0) {
        vscode.window.showWarningMessage('No solidity files (*.sol) found');
        return;
    }

    let outputChannel = vscode.window.createOutputChannel('solidity compilation');
    outputChannel.clear();

    let output = solc.compile({ sources: contracts }, 1);

    if (Object.keys(output).length === 0) {
        vscode.window.showWarningMessage('No output by the compiler');
        return;
    }

    diagnosticCollection.clear();

    if (output.errors) {

        const errorWarningCounts = outputErrorsToDiagnostics(diagnosticCollection, output.errors);
        outputErrorsToChannel(outputChannel, output.errors);

        if (errorWarningCounts.errors > 0) {
            vscode.window.showErrorMessage(`Compilation failed with ${errorWarningCounts.errors} errors`);
        }
        else if (errorWarningCounts.warnings > 0) {
            vscode.window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
        }

    } else {

        let binPath = path.join(vscode.workspace.rootPath, buildDir);

        if (!fs.existsSync(binPath)) {
            fs.mkdirSync(binPath);
        }

        // iterate through all the sources, find contracts and output them into the same folder structure to avoid collisions, named as the contract
        for (let source in output.sources) {

            // TODO: ALL this validation to a method

            // Output only single contract compilation or all
            if (!singleContractFilePath || source === singleContractFilePath) {

                if (!excludePath || !source.startsWith(excludePath)) {
                    // Output only source directory compilation or all (this will exclude external references)
                    if (!sourceDir || source.startsWith(sourceDir)) {

                        output.sources[source].AST.children.forEach(child => {

                            if (child.name === 'Contract') {
                                let contractName = child.attributes.name;

                                let relativePath = path.relative(vscode.workspace.rootPath, source);

                                let dirName = path.dirname(path.join(binPath, relativePath));

                                if (!fs.existsSync(dirName)) {
                                    fsex.mkdirsSync(dirName);
                                }

                                let contractAbiPath = path.join(dirName, contractName + '.abi');
                                let contractBinPath = path.join(dirName, contractName + '.bin');

                                if (fs.existsSync(contractAbiPath)) {
                                    fs.unlinkSync(contractAbiPath);
                                }

                                if (fs.existsSync(contractBinPath)) {
                                    fs.unlinkSync(contractBinPath);
                                }

                                fs.writeFileSync(contractBinPath, output.contracts[contractName].bytecode);
                                fs.writeFileSync(contractAbiPath, output.contracts[contractName].interface);
                            }
                        });
                    }
                }
            }
        }

        outputChannel.hide();
        vscode.window.showInformationMessage('Compilation completed succesfully!');
    }
}