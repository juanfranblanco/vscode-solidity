'use strict';

import { OutputChannel, DiagnosticCollection, window, workspace } from 'vscode';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { mkdirsSync } from 'fs-extra';
import { errorsToDiagnostics } from './sol-errors-to-diaganostics-client';
import { SolcCompiler, compilerType } from './solc-compiler';
import { Extensions } from './enums/extensions';

function outputErrorsToChannel(outputChannel: OutputChannel, errors: any): void {
    errors.forEach(error => {
        outputChannel.appendLine(error);
    });
    outputChannel.show();
}

export function compile(contracts: any, diagnosticCollection: DiagnosticCollection,
    buildDir: string, rootDir: string, sourceDir: string, excludePath?: string,
    singleContractFilePath?: string): void {

    // Did we find any sol files after all?
    if (Object.keys(contracts).length === 0) {
        window.showWarningMessage('No solidity files (*.sol) found');
        return;
    }
    const solc = new SolcCompiler(workspace.rootPath);

    const outputChannel = window.createOutputChannel('solidity compilation');
    outputChannel.clear();
    outputChannel.show();

    window.setStatusBarMessage('Compilation started');

    const remoteCompiler = workspace.getConfiguration('solidity').get<string>('compileUsingRemoteVersion');
    const localCompiler = workspace.getConfiguration('solidity').get<string>('compileUsingLocalVersion');

    solc.intialiseCompiler(localCompiler, remoteCompiler).then(() => {
        let output = solc.compile({ sources: contracts });

        if (solc.currentCompilerType === compilerType.localFile) {
            outputChannel.appendLine("Compiling using local file: '" + solc.currentCompilerSetting + "', solidity version: " + solc.getVersion());
        }

        if (solc.currentCompilerType === compilerType.localNode) {
            outputChannel.appendLine('Compiling using solidity from node_modules, solidity version: ' + solc.getVersion());
        }

        if (solc.currentCompilerType === compilerType.Remote) {
            outputChannel.appendLine("Compiling using remote version: '" + solc.currentCompilerSetting + "', solidity version: " + solc.getVersion());
        }

        if (solc.currentCompilerType === compilerType.default) {
            outputChannel.appendLine('Compiling using default compiler, solidity version: ' + solc.getVersion());
        }

        processCompilationOuput(output, outputChannel, diagnosticCollection, buildDir, sourceDir, excludePath, singleContractFilePath);
    }).catch((reason: any) => {
        window.showWarningMessage(reason);
    });
}

function processCompilationOuput(output: any, outputChannel: OutputChannel, diagnosticCollection: DiagnosticCollection,
    buildDir: string, sourceDir: string, excludePath?: string, singleContractFilePath?: string): void {

    if (Object.keys(output).length === 0) {
        window.showWarningMessage('No output by the compiler');
        return;
    }

    diagnosticCollection.clear();

    if (output.errors) {
        const errorWarningCounts = errorsToDiagnostics(diagnosticCollection, output.errors);
        outputErrorsToChannel(outputChannel, output.errors);

        if (errorWarningCounts.errors > 0) {
            window.showErrorMessage(`Compilation failed with ${errorWarningCounts.errors} errors`);
            if (errorWarningCounts.warnings > 0) {
                window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
            }
        } else if (errorWarningCounts.warnings > 0) {
            writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, excludePath, singleContractFilePath);
            window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
            window.showInformationMessage('Compilation completed succesfully!');
        }
    } else {
        writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, excludePath, singleContractFilePath);
        // outputChannel.hide();
        window.showInformationMessage('Compilation completed succesfully!');
    }
}

function writeCompilationOutputToBuildDirectory(output: any, buildDir: string, sourceDir: string,
    excludePath?: string, singleContractFilePath?: string): void {

    const binPath = join(workspace.rootPath, buildDir);

    if (!existsSync(binPath)) {
        mkdirSync(binPath);
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

                            const relativePath = relative(workspace.rootPath, source);

                            const dirName = dirname(join(binPath, relativePath));

                            if (!existsSync(dirName)) {
                                mkdirsSync(dirName);
                            }

                            const contractAbiPath = join(dirName, contractName + Extensions.abi);
                            const contractBinPath = join(dirName, contractName + Extensions.bin);
                            const contractJsonPath = join(dirName, contractName + Extensions.json);
                            const truffleArtifactPath = join(dirName, contractName + Extensions.soljs);

                            if (existsSync(contractAbiPath)) {
                                unlinkSync(contractAbiPath);
                            }

                            if (existsSync(contractBinPath)) {
                                unlinkSync(contractBinPath);
                            }

                            if (existsSync(contractJsonPath)) {
                                unlinkSync(contractJsonPath);
                            }

                            if (existsSync(truffleArtifactPath)) {
                                unlinkSync(truffleArtifactPath);
                            }

                            writeFileSync(contractBinPath, output.contracts[source + ':' + contractName].bytecode);
                            writeFileSync(contractAbiPath, output.contracts[source + ':' + contractName].interface);

                            const shortJsonOutput = {
                                abi: output.contracts[source + ':' + contractName].interface,
                                bytecode: output.contracts[source + ':' + contractName].bytecode,
                                functionHashes: output.contracts[source + ':' + contractName].functionHashes,
                                gasEstimates: output.contracts[source + ':' + contractName].gasEstimates,
                                runtimeBytecode: output.contracts[source + ':' + contractName].runtimeBytecode,
                            };

                            writeFileSync(contractJsonPath, JSON.stringify(shortJsonOutput, null, 4));
                        }
                    });
                }
            }
        }
    }
}
