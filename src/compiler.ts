'use strict';

import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as artifactor from 'truffle-artifactor';
import { errorToDiagnostic } from './compilerErrors';
import { DiagnosticSeverity } from 'vscode';

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

function outputErrorsToDiagnostics(diagnosticCollection: vscode.DiagnosticCollection, errors: any): ErrorWarningCounts {
    let errorWarningCounts: ErrorWarningCounts = {errors: 0, warnings: 0};
    let diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

    errors.forEach(error => {
        let {diagnostic, fileName} = errorToDiagnostic(error);

        let targetUri = vscode.Uri.file(fileName);
        let diagnostics = diagnosticMap.get(targetUri);

        if (!diagnostics) {
            diagnostics = [];
        }

        diagnostics.push(diagnostic);
        diagnosticMap.set(targetUri, diagnostics);
    });

    let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];

    diagnosticMap.forEach((diags, uri) => {
        errorWarningCounts.errors += diags.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error).length;
        errorWarningCounts.warnings += diags.filter((diagnostic) => diagnostic.severity === DiagnosticSeverity.Warning).length;

        entries.push([uri, diags]);
    });

    diagnosticCollection.set(entries);

    return errorWarningCounts;
}

export function getLocalSolcInstallation(rootPath: string) {
    return path.join(rootPath, 'node_modules', 'solc', 'soljson.js');
}

export function isInstalledSolcLocally(rootPath: string) {
    return fs.existsSync(getLocalSolcInstallation(rootPath));
}

export function initialiseLocalSolc(compileUsingLocalVersion: string, rootPath: string) {
    let solidityfile = '';
    if (isInstalledSolcLocally(rootPath)) {
        solidityfile = require(getLocalSolcInstallation(rootPath));
        solc.setupMethods(solidityfile);
        return true;
    }else {
        if ( compileUsingLocalVersion !== 'undefined' || compileUsingLocalVersion !== null) {
            solidityfile = require(compileUsingLocalVersion);
            solc.setupMethods(solidityfile);
            return true;
        }
    }
}

export function solcCompile(contracts: any) {
    return solc.compile({ sources: contracts }, 1);
}


export function compile(contracts: any,
                        diagnosticCollection: vscode.DiagnosticCollection,
                        buildDir: string, rootDir: string, sourceDir: string, excludePath?: string, singleContractFilePath?: string) {
    // Did we find any sol files after all?
    if (Object.keys(contracts).length === 0) {
        vscode.window.showWarningMessage('No solidity files (*.sol) found');
        return;
    }

    let outputChannel = vscode.window.createOutputChannel('solidity compilation');
    outputChannel.clear();
    outputChannel.show();

    vscode.window.setStatusBarMessage('Compilation started');

    let remoteCompiler = vscode.workspace.getConfiguration('solidity').get('compileUsingRemoteVersion');
    let localCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingLocalVersion');
    let initialisedAlready = initialiseLocalSolc(localCompiler, rootDir);

    if (!initialisedAlready && (typeof remoteCompiler !== 'undefined' || remoteCompiler !== null)) {
        solc.loadRemoteVersion(remoteCompiler, function(err, solcSnapshot) {
            if (err) {
                vscode.window.showWarningMessage('There was an error loading the remote version: ' + remoteCompiler);
                return;
            } else {
                let output = this.solcCompile({ sources: contracts });
                processCompilationOuput(output, outputChannel, diagnosticCollection, buildDir,
                                            sourceDir, excludePath, singleContractFilePath);
            }
        });
    } else {
         let output = this.solcCompile({ sources: contracts });
        processCompilationOuput(output, outputChannel, diagnosticCollection, buildDir, sourceDir, excludePath, singleContractFilePath);
    }
 }

function processCompilationOuput(output: any, outputChannel: vscode.OutputChannel, diagnosticCollection: vscode.DiagnosticCollection,
                    buildDir: string, sourceDir: string, excludePath?: string, singleContractFilePath?: string) {
    vscode.window.setStatusBarMessage('Compilation completed');

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
            if (errorWarningCounts.warnings > 0) {
                vscode.window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
            }
        } else if (errorWarningCounts.warnings > 0) {
            writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, excludePath, singleContractFilePath);
            vscode.window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
            vscode.window.showInformationMessage('Compilation completed succesfully!');
        }
    } else {
        writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, excludePath, singleContractFilePath);
        outputChannel.hide();
        vscode.window.showInformationMessage('Compilation completed succesfully!');
    }
}

function writeCompilationOutputToBuildDirectory(output: any, buildDir: string, sourceDir: string,
                                                    excludePath?: string, singleContractFilePath?: string) {
    const binPath = path.join(vscode.workspace.rootPath, buildDir);

    if (!fs.existsSync(binPath)) {
        fs.mkdirSync(binPath);
    }

    // iterate through all the sources,
    // find contracts and output them into the same folder structure to avoid collisions, named as the contract
    for (let source in output.sources) {

        // TODO: ALL this validation to a method

        // Output only single contract compilation or all
        if (!singleContractFilePath || source === singleContractFilePath) {

            if (!excludePath || !source.startsWith(excludePath)) {
                // Output only source directory compilation or all (this will exclude external references)
                if (!sourceDir || source.startsWith(sourceDir)) {

                    output.sources[source].AST.children.forEach((child) => {

                        if (child.name === 'Contract' || child.name === 'ContractDefinition') {
                            const contractName = child.attributes.name;

                            const relativePath = path.relative(vscode.workspace.rootPath, source);

                            const dirName = path.dirname(path.join(binPath, relativePath));

                            if (!fs.existsSync(dirName)) {
                                fsex.mkdirsSync(dirName);
                            }

                            const contractAbiPath = path.join(dirName, contractName + '.abi');
                            const contractBinPath = path.join(dirName, contractName + '.bin');
                            const contractJsonPath = path.join(dirName, contractName + '.json');
                            const truffleArtifactPath = path.join(dirName, contractName + '.sol.js');

                            if (fs.existsSync(contractAbiPath)) {
                                fs.unlinkSync(contractAbiPath);
                            }

                            if (fs.existsSync(contractBinPath)) {
                                fs.unlinkSync(contractBinPath);
                            }

                            if (fs.existsSync(contractJsonPath)) {
                                fs.unlinkSync(contractJsonPath);
                            }

                            if (fs.existsSync(truffleArtifactPath)) {
                                fs.unlinkSync(truffleArtifactPath);
                            }

                            fs.writeFileSync(contractBinPath, output.contracts[source + ':' + contractName].bytecode);
                            fs.writeFileSync(contractAbiPath, output.contracts[source + ':' + contractName].interface);

                            const shortJsonOutput = {
                                abi : output.contracts[source + ':' + contractName].interface,
                                bytecode : output.contracts[source + ':' + contractName].bytecode,
                                functionHashes : output.contracts[source + ':' + contractName].functionHashes,
                                gasEstimates : output.contracts[source + ':' + contractName].gasEstimates,
                                runtimeBytecode : output.contracts[source + ':' + contractName].runtimeBytecode,
                            };

                            fs.writeFileSync(contractJsonPath, JSON.stringify(shortJsonOutput, null, 4));
                            /*
                            let contract_data = {
                                contract_name: contractName,
                                abi: output.contracts[source + ':' + contractName].interface,
                                unlinked_binary: output.contracts[source + ':' + contractName].bytecode,
                                };

                            artifactor.save(contract_data, truffleArtifactPath);
                            */
                        }
                    });
                }
            }
        }
    }
}
