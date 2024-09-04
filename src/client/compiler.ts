'use strict';

import * as vscode from 'vscode';
import * as workspaceUtil from './workspaceUtil';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as https from 'https';
import { SolcCompiler, compilerType, RemoteCompilerDownloader, RemoteReleases } from '../common/solcCompiler';
import { errorsToDiagnostics } from './solErrorsToDiaganosticsClient';
import { OutputChannelService } from './outputChannelService';


export class Compiler {
    private solcCachePath: string;
    private outputChannel: vscode.OutputChannel;
    private solc: SolcCompiler;

    constructor(solcCachePath: string) {
        this.solcCachePath = solcCachePath;
        this.outputChannel = OutputChannelService.getInstance().getSolidityCompilerOutputChannel();
    }

    public outputCompilerInfoEnsuringInitialised() {
        // initialise compiler outputs the information and validates existing settings
        this.initialiseCompiler();
    }

    public async changeDefaultCompilerType(target: vscode.ConfigurationTarget) {
        try {
            // tslint:disable-next-line:max-line-length
            const compilers: string[] = [compilerType[compilerType.remote], compilerType[compilerType.localFile], compilerType[compilerType.localNodeModule], compilerType[compilerType.embedded]];
            const selectedCompiler: string = await vscode.window.showQuickPick(compilers);
            vscode.workspace.getConfiguration('solidity').update('defaultCompiler', selectedCompiler, target);
            vscode.window.showInformationMessage('Compiler changed to: ' + selectedCompiler);
        } catch (e) {
            vscode.window.showErrorMessage('Error changing default compiler: ' + e);
        }
    }

    public async downloadRemoteVersionAndSetLocalPathSetting(target: vscode.ConfigurationTarget, folderPath: string) {
        const downloadPath = await this.downloadRemoteVersion(folderPath);
        vscode.workspace.getConfiguration('solidity').update('compileUsingLocalVersion', downloadPath, target);
    }

    public async downloadRemoteVersion(folderPath: string): Promise<string> {
        try {
            const releases = await this.getSolcReleases();
            const releasesToSelect: string[] = [];
            // tslint:disable-next-line: forin
            for (const release in releases) {
                releasesToSelect.push(release);
            }
            const selectedVersion: string = await vscode.window.showQuickPick(releasesToSelect);
            let version = '';

            const value: string = releases[selectedVersion];
            if (value !== 'undefined') {
                version = value.replace('soljson-', '');
                version = version.replace('.js', '');
            }
            const pathVersion = path.resolve(path.join(folderPath, 'soljson-' + version + '.js'));
            await new RemoteCompilerDownloader().downloadCompilationFile(version, pathVersion);
            vscode.window.showInformationMessage('Compiler downloaded: ' + pathVersion);
            return pathVersion;
        } catch (e) {
            vscode.window.showErrorMessage('Error downloading compiler: ' + e);
        }

    }

    public async selectRemoteVersion(target: vscode.ConfigurationTarget) {
        const releases = await this.getSolcReleases();
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

    public getSolcReleases(): Promise<any> {
        return new RemoteReleases().getSolcReleases();
    }

    public async outputSolcReleases() {
        this.outputChannel.clear();
        this.outputChannel.appendLine('Retrieving solc versions ..');
        try {
            const releases = await this.getSolcReleases();
            // tslint:disable-next-line: forin
            for (const release in releases) {
                this.outputChannel.appendLine(release + ': ' + releases[release]);
            }
        } catch (error) {
            this.outputChannel.appendLine('Error:' + error);
        }
    }

    public async compile(contracts: any,
        diagnosticCollection: vscode.DiagnosticCollection,
        buildDir: string,
        rootDir: string,
        sourceDir: string,
        excludePath?: string[],
        singleContractFilePath?: string,
        overrideDefaultCompiler: compilerType = null): Promise<Array<string>> {
        // Did we find any sol files after all?
        if (Object.keys(contracts).length === 0) {
            this.outputChannel.appendLine("No solidity files (*.sol) found")
            return;
        }       
        
        var rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        return new Promise((resolve, reject) => {
            this.initialiseCompiler(overrideDefaultCompiler).then(() => {
                try {
                    const output = this.solc.compile(JSON.stringify(contracts), overrideDefaultCompiler);
                    const files = this.processCompilationOutput(output, this.outputChannel, diagnosticCollection, buildDir, sourceDir, rootPath, excludePath, singleContractFilePath);
                    resolve(files);
                } catch (reason) {
                    this.outputChannel.appendLine("Error:" + reason)
                    reject(reason);
                }

            });
        });
    }

    private outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any) {
        errors.forEach(error => {
            outputChannel.appendLine(error.formattedMessage);
        });
        outputChannel.show();
    }

    private outputCompilerInfo(overrideDefaultCompiler: compilerType = null) {
        this.outputChannel.show();
        this.outputChannel.appendLine('Retrieving compiler information:');
        const compiler = this.solc.getCompiler(overrideDefaultCompiler);
        if (compiler.compilerType === compilerType.localFile) {
            this.outputChannel.appendLine("Compiler using local file: '" + compiler.getConfiguration() + "', solidity version: " + compiler.getVersion());
        }

        if (compiler.compilerType === compilerType.localNodeModule) {
            this.outputChannel.appendLine('Compiler using solidity from node_module: ' + compiler.getConfiguration() + ' solidity version: ' + compiler.getVersion());
        }

        if (compiler.compilerType === compilerType.remote) {
            this.outputChannel.appendLine("Compiler using remote version: '" + compiler.getConfiguration() + "', solidity version: " + compiler.getVersion());
        }

        if (compiler.compilerType === compilerType.embedded) {
            this.outputChannel.appendLine('Compiler using default compiler (embedded on extension), solidity version: ' + compiler.getVersion());
        }
    }

    private initialiseCompiler(overrideDefaultCompiler: compilerType = null): Promise<void> {
        const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();

        if (typeof this.solc === 'undefined' || this.solc === null) {
            this.solc = new SolcCompiler(rootPath);
            this.solc.setSolcCache(this.solcCachePath);
        }
        this.outputChannel.appendLine(this.solcCachePath);
        this.outputChannel.clear();
        this.outputChannel.show();
        const remoteCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingRemoteVersion');
        const localCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingLocalVersion');
        const nodeModulePackage = vscode.workspace.getConfiguration('solidity').get<string>('nodemodulespackage');
        const compilerSetting = vscode.workspace.getConfiguration('solidity').get<string>('defaultCompiler');
        const defaultCompiler = compilerType[compilerSetting];
        this.outputChannel.appendLine('Initialising compiler with settings:');
        this.outputChannel.appendLine('Remote compiler: ' + remoteCompiler);
        this.outputChannel.appendLine('Local compiler: ' + localCompiler);
        this.outputChannel.appendLine('Node compiler module: ' + nodeModulePackage);
        this.outputChannel.appendLine('Default compiler: ' + compilerSetting);

        if (overrideDefaultCompiler != null) {
            this.outputChannel.appendLine('Compiling with compiler: ' + compilerType[overrideDefaultCompiler]);
        }
        this.outputChannel.appendLine('This may take a couple of seconds as we may need to download the solc binaries...');
        return new Promise((resolve, reject) => {
            this.solc.initialiseAllCompilerSettings(remoteCompiler, localCompiler, nodeModulePackage, defaultCompiler);

            if (overrideDefaultCompiler == null) {
                this.solc.initialiseSelectedCompiler().then(() => {
                    this.outputCompilerInfo();
                    resolve();
                }).catch((reason: any) => {
                    vscode.window.showWarningMessage(reason);
                    reject(reason);
                });
            } else {
                this.solc.initialiseCompiler(overrideDefaultCompiler).then(() => {
                    this.outputCompilerInfo(overrideDefaultCompiler);
                    resolve();
                }).catch((reason: any) => {
                    vscode.window.showWarningMessage(reason);
                    reject(reason);
                });
            }
        });
    }

    private processCompilationOutput(outputString: any, outputChannel: vscode.OutputChannel, diagnosticCollection: vscode.DiagnosticCollection,
        buildDir: string, sourceDir: string, rootPath: string, excludePath?: string[], singleContractFilePath?: string): Array<string> {
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
            this.outputErrorsToChannel(outputChannel, output.errors);

            if (errorWarningCounts.errors > 0) {
                const compilationWithErrorsMessage = `Compilation failed with ${errorWarningCounts.errors} errors`;
                vscode.window.showErrorMessage(compilationWithErrorsMessage);
                vscode.window.setStatusBarMessage(compilationWithErrorsMessage);
                outputChannel.appendLine(compilationWithErrorsMessage);
                if (errorWarningCounts.warnings > 0) {
                    vscode.window.showWarningMessage(`Compilation had ${errorWarningCounts.warnings} warnings`);
                }
            } else if (errorWarningCounts.warnings > 0) {
                const files = this.writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, rootPath, excludePath, singleContractFilePath);
                if(files.length === 0) {
                    const noOutputMessage = `Could not output any files from the compilation, compilation warnings: ${errorWarningCounts.warnings} warnings`;
                    vscode.window.showWarningMessage(noOutputMessage);
                    vscode.window.setStatusBarMessage(noOutputMessage);
                    outputChannel.appendLine(noOutputMessage);
                    return files;
                } else {
                    const compilationWithWarningsMessage = `Compilation completed successfully!, with ${errorWarningCounts.warnings} warnings`;
                    vscode.window.showWarningMessage(compilationWithWarningsMessage);
                    vscode.window.setStatusBarMessage(compilationWithWarningsMessage);
                    outputChannel.appendLine(compilationWithWarningsMessage);
                }
                return files;
            }
        } else {
            const files = this.writeCompilationOutputToBuildDirectory(output, buildDir, sourceDir, rootPath, excludePath, singleContractFilePath);
            if(files.length === 0) {
                const noOutputMessage = `Could not output any files from the compilation`;
                vscode.window.showWarningMessage(noOutputMessage);
                vscode.window.setStatusBarMessage(noOutputMessage);
                outputChannel.appendLine(noOutputMessage);
                return files;
            }else{
                const compilationSuccessMessage = `Compilation completed successfully!`;
                vscode.window.showInformationMessage(compilationSuccessMessage);
                vscode.window.setStatusBarMessage(compilationSuccessMessage);
                outputChannel.appendLine(compilationSuccessMessage);
            }
            return files;
        }
    }

    private ensureDirectoryExistence(filePath: string) {
        const dirname = path.dirname(filePath);
        if (fs.existsSync(dirname)) {
            return true;
        }
        this.ensureDirectoryExistence(dirname);
        fs.mkdirSync(dirname);
    }

    private writeCompilationOutputToBuildDirectory(output: any, buildDir: string, sourceDir: string, rootPath: string,
        excludePath?: string[], singleContractFilePath?: string): Array<string> {
        const compiledFiles: Array<string> = new Array<string>();
        if(rootPath == null) {
            this.outputChannel.appendLine('No root path found');
            return compiledFiles;
        }
        const binPath = path.join(rootPath, buildDir);
       

        if (!fs.existsSync(binPath)) {
            fs.mkdirSync(binPath);
        }

        if (typeof singleContractFilePath !== 'undefined' && singleContractFilePath !== null) {
            const relativePath = path.relative(rootPath, singleContractFilePath);
            const dirName = path.dirname(path.join(binPath, relativePath));
            const outputCompilationPath = path.join(dirName, path.basename(singleContractFilePath, '.sol') + '-solc-output' + '.json');
            this.ensureDirectoryExistence(outputCompilationPath);
            fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4));
        } else {
            const dirName = binPath;
            const outputCompilationPath = path.join(dirName, 'solc-output-compile-all' + '.json');
            this.ensureDirectoryExistence(outputCompilationPath);
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

                if (!excludePath || !excludePath.some(x => source.startsWith(x))) {
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

}
