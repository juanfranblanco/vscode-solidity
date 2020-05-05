'use strict';
import { errorToDiagnostic } from './solErrorsToDiagnostics';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { ContractCollection } from './model/contractsCollection';
import { initialiseProject } from './projectService';

export enum compilerType {
    localNode,
    Remote,
    localFile,
    default,
}

export class SolcCompiler {

    public rootPath: string;
    public currentCompilerType: compilerType;
    public currentCompilerSetting: string;
    public enableNodeCompilerSetting: boolean;
    private localSolc: any;
    private solcCachePath: string;

    public setSolcCache(solcCachePath: string): void {
        this.solcCachePath = solcCachePath;
    }

    public getVersion(): string {
        return this.localSolc.version();
    }

    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.localSolc = null;
        this.currentCompilerType = compilerType.default;
    }

    public isRootPathSet(): boolean {
        return typeof this.rootPath !== 'undefined' && this.rootPath !== null;
    }

    // simple validation to match our settings with the ones passed
    public initialisedAlready(localInstallationPath: string, remoteInstallationVersion: string, enableNodeCompiler: boolean): boolean {
        // tslint:disable-next-line:curly
        if (this.localSolc === null) return false;
        // tslint:disable-next-line: curly
        if (this.enableNodeCompilerSetting !== enableNodeCompiler) return false;

        let installedNodeLocally = false;
        if (this.isRootPathSet() && enableNodeCompiler) {
            installedNodeLocally = this.isInstalledSolcUsingNode(this.rootPath);
            if (this.currentCompilerType === compilerType.localNode && installedNodeLocally) {
                return true;
            }
        }

        if (this.currentCompilerType === compilerType.localFile && localInstallationPath === this.currentCompilerSetting) {
            return true;
        }

        if (this.currentCompilerType === compilerType.Remote && remoteInstallationVersion === this.currentCompilerSetting) {
            return true;
        }

        if (this.currentCompilerType === compilerType.default && !installedNodeLocally &&
            (typeof localInstallationPath === 'undefined' || localInstallationPath === null || localInstallationPath === '') &&
            (typeof remoteInstallationVersion === 'undefined' || remoteInstallationVersion === null || remoteInstallationVersion === '')) {
            return true;
        }

        return false;
    }

    public intialiseCompiler(localInstallationPath: string, remoteInstallationVersion: string, enableNodeCompiler: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                if (this.initialisedAlready(localInstallationPath, remoteInstallationVersion, enableNodeCompiler)) {
                    resolve();
                } else {
                    let solidityfile = '';
                    this.enableNodeCompilerSetting = enableNodeCompiler;
                    if (enableNodeCompiler && this.isInstalledSolcUsingNode(this.rootPath)) {
                        solidityfile = require(this.getLocalSolcNodeInstallation());
                        this.localSolc = solc.setupMethods(solidityfile);
                        this.currentCompilerType = compilerType.localNode;
                        this.currentCompilerSetting = null;
                        resolve();
                    } else {
                        // local file
                        if (typeof localInstallationPath !== 'undefined' && localInstallationPath !== null && localInstallationPath !== '') {
                            solidityfile = require(localInstallationPath);
                            this.localSolc = solc.setupMethods(solidityfile);
                            this.currentCompilerType = compilerType.localFile;
                            this.currentCompilerSetting = localInstallationPath;
                            resolve();
                        } else {
                            // remote
                            if (typeof remoteInstallationVersion !== 'undefined' && remoteInstallationVersion !== null && remoteInstallationVersion !== '') {
                                const solcService = this;
                                this.loadRemoteWasmVersion(remoteInstallationVersion, function (err, solcSnapshot) {
                                    if (err) {
                                        reject('There was an error loading the remote version: ' + remoteInstallationVersion);
                                    } else {
                                        solcService.currentCompilerType = compilerType.Remote;
                                        solcService.currentCompilerSetting = remoteInstallationVersion;
                                        solcService.localSolc = solcSnapshot;
                                        resolve();
                                    }
                                });
                                // default
                            } else {
                                this.localSolc = require('solc');
                                this.currentCompilerType = compilerType.default;
                                this.currentCompilerSetting = null;
                                resolve();
                            }
                        }
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    public getLocalSolcNodeInstallation() {
        return path.join(this.rootPath, 'node_modules', 'solc', 'soljson.js');
    }

    public isInstalledSolcUsingNode(rootPath: string): boolean {
        return fs.existsSync(this.getLocalSolcNodeInstallation());
    }


    public compile(contracts: any) {
        return this.localSolc.compile(contracts);
    }

    public loadRemoteVersion(remoteCompiler: any, cb: any) {
        solc.loadRemoteVersion(remoteCompiler, cb);
    }

    public compileSolidityDocumentAndGetDiagnosticErrors(filePath: string, documentText: string,
        packageDefaultDependenciesDirectory: string, packageDefaultDependenciesContractsDirectory: string) {
        if (this.isRootPathSet()) {
            const contracts = new ContractCollection();
            contracts.addContractAndResolveImports(
                filePath,
                documentText,
                initialiseProject(this.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory));
            const contractsForCompilation = contracts.getDefaultContractsForCompilationDiagnostics();
            contractsForCompilation.settings = null;
            const outputString = this.compile(JSON.stringify(contractsForCompilation));
            const output = JSON.parse(outputString);
            if (output.errors) {
                return output
                    .errors
                    .map(error => errorToDiagnostic(error));
            }
        } else {
            const contract = {};
            contract[filePath] = documentText;
            const output = this.compile({ sources: contract });
            if (output.errors) {
                return output.errors.map((error) => errorToDiagnostic(error));
            }
        }
        return [];
    }

    private loadRemoteWasmVersion (versionString, cb) {
        const pathVersion = path.resolve(path.join(this.solcCachePath, 'soljson-' + versionString + '.js'));
        if (fs.existsSync(pathVersion) && versionString !== 'latest') {
            const solidityfile = require(pathVersion);
                const solcConfigured = solc.setupMethods(solidityfile);
                cb(null, solcConfigured);
        } else {
            const file = fs.createWriteStream(pathVersion);
            // the files have a redirection.. so we are not using the wasm path for the time being until i check with Christian
            const url = 'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/soljson-' + versionString + '.js';
            https.get(url, function (response) {
                if (response.statusCode !== 200) {
                cb(new Error('Error retrieving binary: ' + response.statusMessage));
                } else {
                response.pipe(file);
                response.on('end', function () {
                    const solidityfile = require(pathVersion);
                    const solcConfigured = solc.setupMethods(solidityfile);
                    cb(null, solcConfigured);
                });
                }
            }).on('error', function (error) {
                cb(error);
            });
        }
    }
}
