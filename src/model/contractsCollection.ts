
'use strict';
import * as fs from 'fs';
import * as path from 'path';
import {Contract} from './contract';
import {Project} from './project';
import * as util from '../util';

export class ContractCollection {
    contracts: Array<Contract>;
    constructor() {
        this.contracts = new Array<Contract>();
    }

    formatPath(contractPath: string) {
        return util.formatPath(contractPath);
    }

    findContract(contract: Contract, contractPath: string) {
        return contract.absolutePath === contractPath;
    }

    containsContract(contractPath: string) {
        return this.contracts.findIndex((contract: Contract) => { return contract.absolutePath === contractPath }) > -1;
    }

    addContract(contractPath: string, code: string) {
        if (!this.containsContract(contractPath)) {
            let contract = new Contract(contractPath, code);
            this.contracts.push(contract);
            return contract;
        }
        return null;
    }

    getContractsForCompilation() {
        let contractsForCompilation = {};
        this.contracts.forEach(contract => {
            contractsForCompilation[contract.absolutePath] = contract.code;
        });
        return contractsForCompilation;
    }

    getAllImportFromPackages() {
        let importsFromPackages = new Array<string>();
        this.contracts.forEach(contract => {
            let contractImports = contract.getAllImportFromPackages();
            contractImports.forEach(contractImport => {
                if (importsFromPackages.indexOf(contractImport) < 0) {
                    importsFromPackages.push(contractImport);
                }
            });
        });
        return importsFromPackages;
    }

    private readContractCode(contractPath: string) {
        if (fs.existsSync(contractPath)) {
            return fs.readFileSync(contractPath, "utf8");
        }
        return null;
    }

    private addContractAndResolveDependencyImport(dependencyImport: string, contract: Contract, project: Project) {
        let depPack = project.findPackage(dependencyImport);
        
        if (depPack !== undefined) {
            let depImportPath = this.formatPath(depPack.resolveImport(dependencyImport));
            if (!this.containsContract(depImportPath)) {
                let importContractCode = this.readContractCode(depImportPath);
                if (importContractCode != null) {
                    this.addContractAndResolveImports(depImportPath, importContractCode, project);
                    contract.replaceDependencyPath(dependencyImport, depImportPath);
                }
            } else {
                contract.replaceDependencyPath(dependencyImport, depImportPath);
            }
        }
    }

    addContractAndResolveImports(contractPath: string, code: string, project: Project) {
        let contract = this.addContract(contractPath, code);
        if (contract !== null) {
            contract.resolveImports();
            contract.imports.forEach(foundImport => {
                if (fs.existsSync(foundImport)) {
                    if (!this.containsContract(foundImport)) {
                        let importContractCode = this.readContractCode(foundImport);
                        if (importContractCode != null) {
                            this.addContractAndResolveImports(foundImport, importContractCode, project);
                        }
                    }
                } else {
                    this.addContractAndResolveDependencyImport(foundImport, contract, project);
                }
            });
        }
        return contract;
    }
}