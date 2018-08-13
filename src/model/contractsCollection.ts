
'use strict';
import * as fs from 'fs';
import { Contract } from './contract';
import { Project } from './project';
import { formatPath } from '../util';

export class ContractCollection {
    public contracts: Array<Contract>;
    constructor() {
        this.contracts = new Array<Contract>();
    }

    public findContract(contract: Contract, contractPath: string) {
        return contract.absolutePath === contractPath;
    }

    public containsContract(contractPath: string) {
        return this.contracts.findIndex((contract: Contract) => { return contract.absolutePath === contractPath; }) > -1;
    }

    public getContractsForCompilation() {
        let contractsForCompilation = {};
        this.contracts.forEach(contract => {
            contractsForCompilation[contract.absolutePath] = contract.code;
        });
        return contractsForCompilation;
    }

    public addContractAndResolveImports(contractPath: string, code: string, project: Project) {
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

    private addContract(contractPath: string, code: string) {
        if (!this.containsContract(contractPath)) {
            let contract = new Contract(contractPath, code);
            this.contracts.push(contract);
            return contract;
        }
        return null;
    }

    private getAllImportFromPackages() {
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
            return fs.readFileSync(contractPath, 'utf8');
        }
        return null;
    }

    private addContractAndResolveDependencyImport(dependencyImport: string, contract: Contract, project: Project) {
        let depPack = project.findPackage(dependencyImport);
        if (depPack !== undefined) {
            let depImportPath = formatPath(depPack.resolveImport(dependencyImport));
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
}
