'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as https from 'https';
import { SolcCompiler, compilerType } from './solcCompiler';
import { errorsToDiagnostics } from './solErrorsToDiaganosticsClient';

function outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any) {
    errors.forEach(error => {
        outputChannel.appendLine(error.formattedMessage);
    });
    outputChannel.show();
}

let outputChannel: vscode.OutputChannel;
let solc: SolcCompiler;

export function initialiseSolidityCompilationOutput() {
    outputChannel = vscode.window.createOutputChannel('solidity compilation');
}
export function outputCompilerInfoEnsuringInitialised() {
    // initialise compiler outputs the information and validates existing settings
    initialiseCompiler();
}

export function outputCompilerInfo() {
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine('Retrieving compiler information:');
    if (solc.currentCompilerType === compilerType.localFile) {
        outputChannel.appendLine("Compiler using local file: '" + solc.currentCompilerSetting + "', solidity version: " + solc.getVersion());
    }

    if (solc.currentCompilerType === compilerType.localNode) {
        outputChannel.appendLine('Compiler using solidity from node_modules, solidity version: ' + solc.getVersion());
    }

    if (solc.currentCompilerType === compilerType.Remote) {
        outputChannel.appendLine("Compiler using remote version: '" + solc.currentCompilerSetting + "', solidity version: " + solc.getVersion());
    }

    if (solc.currentCompilerType === compilerType.default) {
        outputChannel.appendLine('Compiler using default compiler (embedded on extension), solidity version: ' + solc.getVersion());
    }
}

export async function selectRemoteVersion(target: vscode.ConfigurationTarget) {
    const releases = await getSolcReleases();
    const releasesToSelect: string[] = ['none', 'latest'];
    // tslint:disable-next-line: forin
    for (const release in releases) {
        releasesToSelect.push(release);
    }
    vscode.window.showQuickPick(releasesToSelect).then((selected: string) => {
        let updateValue = '';
        if (selected !== 'none') {
            if (selected === 'latest') {
                updateValue = selected;
            } else {
                const value: string = releases[selected];
                if (value !== 'undefined') {
                    updateValue = value.replace('soljson-', '');
                    updateValue = updateValue.replace('.js', '');
                }
            }
        }
        vscode.workspace.getConfiguration('solidity').update('compileUsingRemoteVersion', updateValue, target);
    });
}

export function getSolcReleases(): Promise<any> {
    const url = 'https://solc-bin.ethereum.org/bin/list.json';
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const binList = JSON.parse(body);
                    resolve(binList.releases);
                } catch (error) {
                    reject(error.message);
                }
            });
        }).on('error', (error) => {
            reject(error.message);
        });
    });
}

export async function outputSolcReleases() {
    outputChannel.clear();
    outputChannel.appendLine('Retrieving solc versions ..');
    try {
        const releases = await getSolcReleases();
        // tslint:disable-next-line: forin
        for (const release in releases) {
            outputChannel.appendLine(release + ': ' + releases[release]);
        }
    } catch (error) {
        outputChannel.appendLine('Error:' + error);
    }
}

export function initialiseCompiler(): Promise<void> {
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (typeof solc === 'undefined' || solc === null) {
        solc = new SolcCompiler(rootPath);
    }
    outputChannel.clear();
    outputChannel.show();
    const remoteCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingRemoteVersion');
    const localCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingLocalVersion');
    const enableNodeCompiler = vscode.workspace.getConfiguration('solidity').get<boolean>('enableLocalNodeCompiler');
    outputChannel.appendLine('Initialising compiler with settings:');
    outputChannel.appendLine('Remote compiler: ' + remoteCompiler);
    outputChannel.appendLine('Local compiler: ' + localCompiler);
    outputChannel.appendLine('Node compiler enabled: ' + enableNodeCompiler);
    outputChannel.appendLine('This may take a couple of seconds as we may need to download the solc binaries...');
    return new Promise((resolve, reject) => {
        solc.intialiseCompiler(localCompiler, remoteCompiler, enableNodeCompiler).then(() => {
            outputCompilerInfo();
            resolve();
        }).catch((reason: any) => {
            vscode.window.showWarningMessage(reason);
            reject(reason);
        });
    });
}

export async function compile(contracts: any,
    diagnosticCollection: vscode.DiagnosticCollection,
    buildDir: string, rootDir: string, sourceDir: string, excludePath?: string, singleContractFilePath?: string): Promise<Array<string>> {
    // Did we find any sol files after all?
    if (Object.keys(contracts).length === 0) {
        vscode.window.showWarningMessage('No solidity files (*.sol) found');
        return;
    }
    return new Promise((resolve, reject) => {
        initialiseCompiler().then(() => {
            try {
                const output = solc.compile(JSON.stringify(contracts));
                resolve(processCompilationOutput(output, outputChannel, diagnosticCollection, buildDir,
                    sourceDir, excludePath, singleContractFilePath));
            } catch (reason) {
                vscode.window.showWarningMessage(reason);
                reject(reason);
            }

        });
    });
}

function processCompilationOutput(outputString: any, outputChannel: vscode.OutputChannel, diagnosticCollection: vscode.DiagnosticCollection,
    buildDir: string, sourceDir: string, excludePath?: string, singleContractFilePath?: string): Array<string> {
    const output = JSON.parse(outputString);
    if (Object.keys(output).length === 0) {
        const noOutputMessage = `No output by the compiler`;
        vscode.window.showWarningMessage(noOutputMessage);
        vscode.window.setStatusBarMessage(noOutputMessage);
        outputChannel.appendLine(noOutputMessage);
        return;
    }

    diagnosticCollection.clear();

    if (output.errors) {
        const errorWarningCounts = errorsToDiagnostics(diagnosticCollection, output.errors);
        outputErrorsToChannel(outputChannel, output.errors);

        if (errorWarningCounts.errors > 0) {
            const compilationWithErrorsMessage = `Compilation failed with ${errorWarningCounts.errors} errors`;
            vscode.window.showErrorMessage(compilationWithErrorsMessage);
            vscode.window.setStatusBarMessage(compilationWithErrorsMessage);
            outputChannel.appendLine(compilationWithErrorsMessage);
            if (errorWarningCounts.warnings > 0) {
                vscode.window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
            }
        } else if (errorWarningCounts.warnings > 0) {
            const files = writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, excludePath, singleContractFilePath);
            const compilationWithWarningsMessage = `Compilation completed successfully!, with ${errorWarningCounts.warnings} warnings`;
            vscode.window.showWarningMessage(compilationWithWarningsMessage);
            vscode.window.setStatusBarMessage(compilationWithWarningsMessage);
            outputChannel.appendLine(compilationWithWarningsMessage);
            return files;
        }
    } else {
        const files = writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, excludePath, singleContractFilePath);
        const compilationSuccessMessage = `Compilation completed successfully!`;
        vscode.window.showInformationMessage(compilationSuccessMessage);
        vscode.window.setStatusBarMessage(compilationSuccessMessage);
        outputChannel.appendLine(compilationSuccessMessage);
        return files;
    }
}

function ensureDirectoryExistence(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function writeCompilationOutputToBuildDirectory(output: any, buildDir: string, sourceDir: string,
    excludePath?: string, singleContractFilePath?: string): Array<string> {
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const binPath = path.join(rootPath, buildDir);
    const compiledFiles: Array<string> = new Array<string>();

    if (!fs.existsSync(binPath)) {
        fs.mkdirSync(binPath);
    }

    if (typeof singleContractFilePath !== 'undefined' && singleContractFilePath !== null) {
        const relativePath = path.relative(rootPath, singleContractFilePath);
        const dirName = path.dirname(path.join(binPath, relativePath));
        const outputCompilationPath = path.join(dirName, path.basename(singleContractFilePath, '.sol') + '-solc-output' + '.json');
        ensureDirectoryExistence(outputCompilationPath);
        fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4));
    } else {
        const dirName = binPath;
        const outputCompilationPath = path.join(dirName, 'solc-output-compile-all' + '.json');
        ensureDirectoryExistence(outputCompilationPath);
        if (fs.existsSync(outputCompilationPath)) {
            fs.unlinkSync(outputCompilationPath);
        }
        fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4));
    }

    // iterate through all the sources,
    // find contracts and output them into the same folder structure to avoid collisions, named as the contract
    for (const source in output.contracts) {

        // TODO: ALL this validation to a method

        // Output only single contract compilation or all
        if (!singleContractFilePath || source === singleContractFilePath) {

            if (!excludePath || !source.startsWith(excludePath)) {
                // Output only source directory compilation or all (this will exclude external references)
                if (!sourceDir || source.startsWith(sourceDir)) {

                    for (const contractName in output.contracts[source]) {
                        if (output.contracts[source].hasOwnProperty(contractName)) {

                            const contract = output.contracts[source][contractName];
                            const relativePath = path.relative(rootPath, source);
                            const dirName = path.dirname(path.join(binPath, relativePath));

                            if (!fs.existsSync(dirName)) {
                                fsex.mkdirsSync(dirName);
                            }

                            const contractAbiPath = path.join(dirName, contractName + '.abi');
                            const contractBinPath = path.join(dirName, contractName + '.bin');
                            const contractJsonPath = path.join(dirName, contractName + '.json');

                            if (fs.existsSync(contractAbiPath)) {
                                fs.unlinkSync(contractAbiPath);
                            }

                            if (fs.existsSync(contractBinPath)) {
                                fs.unlinkSync(contractBinPath);
                            }

                            if (fs.existsSync(contractJsonPath)) {
                                fs.unlinkSync(contractJsonPath);
                            }

                            fs.writeFileSync(contractBinPath, contract.evm.bytecode.object);
                            fs.writeFileSync(contractAbiPath, JSON.stringify(contract.abi));

                            let version = '';
                            try {
                                version = JSON.parse(contract.metadata).compiler.version;
                                // tslint:disable-next-line: no-empty
                            } catch { } // i could do a check for string.empty but this catches (literally :) ) all scenarios

                            const shortJsonOutput = {
                                contractName: contractName,
                                // tslint:disable-next-line:object-literal-sort-keys
                                abi: contract.abi,
                                metadata: contract.metadata,
                                bytecode: contract.evm.bytecode.object,
                                deployedBytecode: contract.evm.deployedBytecode.object,
                                sourceMap: contract.evm.bytecode.sourceMap,
                                deployedSourceMap: contract.evm.deployedBytecode.sourceMap,
                                sourcePath: source,
                                compiler: {
                                    name: 'solc',
                                    version: version,
                                },
                                ast: output.sources[source].ast,
                                functionHashes: contract.evm.methodIdentifiers,
                                gasEstimates: contract.evm.gasEstimates,

                            };

                            fs.writeFileSync(contractJsonPath, JSON.stringify(shortJsonOutput, null, 4));
                            compiledFiles.push(contractJsonPath);
                        }
                    }
                }
            }
        }
    }
    return compiledFiles;
}
