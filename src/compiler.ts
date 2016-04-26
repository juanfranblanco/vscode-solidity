'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';

export function compileAndHighlightErrors(contracts: any, diagnosticCollection: vscode.DiagnosticCollection) {
  let output = solc.compile({ sources: contracts }, 1);
  diagnosticCollection.clear();
  if(output.errors){
      outputErrorsToDiagnostics(diagnosticCollection, output.errors);
  }
}

function outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any) {
    errors.forEach(error => {
        outputChannel.appendLine(error);
    });
    outputChannel.show();
}

function outputErrorsToDiagnostics(diagnosticCollection: vscode.DiagnosticCollection, errors: any) {
    let diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();
    errors.forEach(error => {
        let errorSplit = error.split(":");
        let fileName = errorSplit[0];
        let index = 1;
        //a full path in windows includes a : for the drive
        if (process.platform === 'win32') {
            fileName = errorSplit[0] + ":" + errorSplit[1];
            index = 2;
        }

        let line = parseInt(errorSplit[index]);
        let column = parseInt(errorSplit[index + 1]);
        let targetUri = vscode.Uri.file(fileName);
        let range = new vscode.Range(line - 1, column, line - 1, column);
        let diagnostic = new vscode.Diagnostic(range, error, vscode.DiagnosticSeverity.Error);
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
}

export function compile(contracts: any, diagnosticCollection: vscode.DiagnosticCollection, singleContractFilePath?: string) {

    //Did we find any sol files after all?
    if (Object.keys(contracts).length === 0) {
        vscode.window.showWarningMessage('No solidity files (*.sol) found');
        return;
    }

    let outputChannel = vscode.window.createOutputChannel("solidity compilation");
    outputChannel.clear();

    let output = solc.compile({ sources: contracts }, 1);

    if (Object.keys(output).length === 0) {
        vscode.window.showWarningMessage('No output by the compiler');
        return;
    }

    diagnosticCollection.clear();

    if (output.errors) {

        outputErrorsToDiagnostics(diagnosticCollection, output.errors);
        outputErrorsToChannel(outputChannel, output.errors);
        vscode.window.showErrorMessage('Compilation Error');

    } else {

        let binPath = path.join(vscode.workspace.rootPath, 'bin');

        if (!fs.existsSync(binPath)) {
            fs.mkdirSync(binPath);
        }

        //iterate through all the sources, find contracts and output them into the same folder structure to avoid collisions, named as the contract
        for (var source in output.sources) {

            if (!singleContractFilePath || source === singleContractFilePath) {

                output.sources[source].AST.children.forEach(child => {

                    if (child.name == "Contract") {
                        let contractName = child.attributes.name;

                        let relativePath = path.relative(vscode.workspace.rootPath, source);

                        let dirName = path.dirname(path.join(binPath, relativePath));

                        if (!fs.existsSync(dirName)) {
                            fsex.mkdirsSync(dirName);
                        }

                        let contractAbiPath = path.join(dirName, contractName + ".abi");
                        let contractBinPath = path.join(dirName, contractName + ".bin");

                        if (fs.existsSync(contractAbiPath)) {
                            fs.unlinkSync(contractAbiPath)
                        }

                        if (fs.existsSync(contractBinPath)) {
                            fs.unlinkSync(contractBinPath)
                        }

                        fs.writeFileSync(contractBinPath, output.contracts[contractName].bytecode);
                        fs.writeFileSync(contractAbiPath, output.contracts[contractName].interface);
                    }
                });
            }
        }


        outputChannel.hide();
        vscode.window.showInformationMessage('Compiled succesfully!');
    }
}