import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import * as projectService from './projectService';
import * as solidityErrorsConvertor from './solErrorsToDiagnostics';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import {ContractCollection} from './model/contractsCollection';

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
    private localSolc: any;

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
    public initialisedAlready(localInstallationPath: string, remoteInstallationVersion: string): boolean {
        // tslint:disable-next-line:curly
        if (this.localSolc === null) return false;

        let installedNodeLocally = false;
        if (this.isRootPathSet()) {
            installedNodeLocally = this.isInstalledSolcUsingNode(this.rootPath);
            if (this.currentCompilerType === compilerType.localNode && installedNodeLocally) {
                return true;
            }
        }

        if (this.currentCompilerType === compilerType.localFile && localInstallationPath === this.currentCompilerSetting) {
            return true;
        }

        if (this.currentCompilerType === compilerType.Remote && localInstallationPath === this.currentCompilerSetting) {
            return true;
        }

        if (this.currentCompilerType === compilerType.default && !installedNodeLocally &&
            (typeof localInstallationPath === 'undefined' || localInstallationPath === null) &&
            (typeof remoteInstallationVersion === 'undefined' || remoteInstallationVersion === null)) {
                return true;
        }

        return false;
    }

    public intialiseCompiler(localInstallationPath: string, remoteInstallationVersion: string): Promise<void> {
            return new Promise<void> ((resolve, reject) => {
            try {
                if (this.initialisedAlready(localInstallationPath, remoteInstallationVersion)) {
                    resolve();
                }
                let solidityfile = '';
                if (this.isInstalledSolcUsingNode(this.rootPath)) {
                    solidityfile = require(this.getLocalSolcNodeInstallation());
                    this.localSolc = solc.setupMethods(solidityfile);
                    this.currentCompilerType = compilerType.localNode;
                    this.currentCompilerSetting = null;
                    resolve();
                } else {
                    // local file
                    if (typeof localInstallationPath !== 'undefined' && localInstallationPath !== null) {
                        solidityfile = require(localInstallationPath);
                        this.localSolc = solc.setupMethods(solidityfile);
                        this.currentCompilerType = compilerType.localFile;
                        this.currentCompilerSetting = localInstallationPath;
                        resolve();
                    } else {
                        // remote
                        if (typeof remoteInstallationVersion !== 'undefined' && remoteInstallationVersion !== null) {
                            const solcService = this;
                            solc.loadRemoteVersion(remoteInstallationVersion, function(err, solcSnapshot) {
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
            } catch (error) {
                reject(error);
            }
            } );
    }

    public getLocalSolcNodeInstallation() {
        return path.join(this.rootPath, 'node_modules', 'solc', 'soljson.js');
    }

    public isInstalledSolcUsingNode(rootPath: string): boolean {
        return fs.existsSync(this.getLocalSolcNodeInstallation());
    }


    public compile(contracts: any) {
        return this.localSolc.compile(contracts, 1);
    }

    public loadRemoteVersion(remoteCompiler: any, cb: any) {
        solc.loadRemoteVersion(remoteCompiler, cb);
    }

    public compileSolidityDocumentAndGetDiagnosticErrors(filePath: string, documentText: string,
                packageDefaultDependenciesDirectory: string, packageDefaultDependenciesContractsDirectory: string ) {
        if (this.isRootPathSet()) {
            const contracts = new ContractCollection();
            contracts.addContractAndResolveImports(
                filePath,
                documentText,
                projectService.initialiseProject(this.rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory));

            const output = this.compile({sources: contracts.getContractsForCompilation()});

            if (output.errors) {
                return output
                    .errors
                    .map(error => solidityErrorsConvertor.errorToDiagnostic(error));
            }
        } else {
            const contract = {};
            contract[filePath] = documentText;
            const output = this.compile({sources: contract });
            if (output.errors) {
                return output.errors.map((error) => solidityErrorsConvertor.errorToDiagnostic(error));
            }
        }
        return [];
    }
}
