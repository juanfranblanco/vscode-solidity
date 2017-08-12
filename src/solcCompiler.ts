import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import * as projectService from './projectService';
import * as solidityErrorsConvertor from './solErrorsToDiagnostics';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import {ContractCollection} from './model/contractsCollection';

enum compilerType {
    localNode,
    Remote,
    localFile,
    default,
}

export class SolcCompiler {

    public rootPath: string;
    public currentCompilerType: compilerType;
    public currentCompilerSetting: string;
    private solc: any;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.solc = solc;
        this.currentCompilerType = compilerType.default;
    }

    // simple validation to match our settings with the ones passed
    public initialisedAlready(localInstallationPath: string, remoteInstallationVersion: string): boolean {
        let installedNodeLocally = this.isInstalledSolcUsingNode(this.rootPath);
        if (this.currentCompilerType === compilerType.localNode && installedNodeLocally) {
            return true;
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
                    this.solc.setupMethods(solidityfile);
                    this.currentCompilerType = compilerType.localNode;
                    this.currentCompilerSetting = null;
                    resolve();
                } else {
                    // local file
                    if (typeof localInstallationPath !== 'undefined' && localInstallationPath !== null) {
                        solidityfile = require(localInstallationPath);
                        solc.setupMethods(solidityfile);
                        this.currentCompilerType = compilerType.localFile;
                        this.currentCompilerSetting = localInstallationPath;
                        resolve();
                    } else {
                        // remote
                        if (typeof remoteInstallationVersion !== 'undefined' && remoteInstallationVersion !== null) {
                            let solcService = this;
                            this.solc.loadRemoteVersion(remoteInstallationVersion, function(err, solcSnapshot) {
                                if (err) {
                                        reject('There was an error loading the remote version: ' + remoteInstallationVersion);
                                } else {
                                    solcService.currentCompilerType = compilerType.Remote;
                                    solcService.currentCompilerSetting = remoteInstallationVersion;
                                    resolve();
                                }
                            });
                        // default
                        } else {
                            this.solc = require('solc');
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
        return this.solc.compile(contracts, 1);
    }

    public loadRemoteVersion(remoteCompiler: any, cb: any) {
        solc.loadRemoteVersion(remoteCompiler, cb);
    }

    public compileSolidityDocumentAndGetDiagnosticErrors(filePath, documentText) {
        const contracts = new ContractCollection();
        contracts.addContractAndResolveImports(
            filePath,
            documentText,
            projectService.initialiseProject(this.rootPath));

        const output = this.compile({sources: contracts.getContractsForCompilation()});

        if (output.errors) {
            return output.errors.map((error) => solidityErrorsConvertor.errorToDiagnostic(error).diagnostic);
        }
        return [];
    }

}



