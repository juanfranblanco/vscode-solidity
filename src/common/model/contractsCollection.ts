'use strict';
import * as fs from 'fs';
import {Contract} from './contract';
import {Project} from './project';
import {formatPath} from '../util';

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

    public getDefaultContractsForCompilation(optimizeCompilationRuns = 200) {
        const compilerOutputSelection = {
            '*': {
                '': ['ast'],
                '*': ['abi', 'devdoc', 'userdoc', 'storageLayout', 'metadata', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers', 'evm.gasEstimates'],
            },
        };

        return this.getContractsForCompilation(true, optimizeCompilationRuns, compilerOutputSelection);
    }

    public getDefaultContractsForCompilationDiagnostics() {
        const compilerOutputSelection = {
            '*': {
                '': [],
                '*': [],
            },
        };

        return this.getContractsForCompilation(false, 0, compilerOutputSelection);
    }

    public getContractsForCompilation(optimizeCompilation: boolean, optimizeCompilationRuns: number, outputSelection) {
        const contractsForCompilation = {};
        this.contracts.forEach(contract => {
            contractsForCompilation[contract.absolutePath] = {content: contract.code};
        });
        const compilation = {
            language: 'Solidity',
            settings:
            {
                optimizer: {
                    enabled: optimizeCompilation,
                    runs: optimizeCompilationRuns,
                },
                outputSelection: outputSelection,
            },
            sources : contractsForCompilation,
        };
        return compilation;
    }


    public addContractAndResolveImports(contractPath: string, code: string, project: Project) {
        const contract = this.addContract(contractPath, code);
        if (contract !== null) {
            contract.resolveImports();
            contract.imports.forEach(foundImport => {
                if (fs.existsSync(foundImport)) {
                    if (!this.containsContract(foundImport)) {
                        const importContractCode = this.readContractCode(foundImport);
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
            const contract = new Contract(contractPath, code);
            this.contracts.push(contract);
            return contract;
        }
        return null;
    }

    private formatContractPath(contractPath: string) {
        return formatPath(contractPath);
    }

    private getAllImportFromPackages() {
        const importsFromPackages = new Array<string>();
        this.contracts.forEach(contract => {
            const contractImports = contract.getAllImportFromPackages();
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
        //find re-mapping
        const remapping = project.findImportRemapping(dependencyImport);
        if(remapping !== undefined && remapping !== null) {
            const importPath = this.formatContractPath(remapping.resolveImport(dependencyImport));
            this.addContractAndResolveDependencyImportFromContractFullPath(importPath, project, contract, dependencyImport);
        } else {
            const depPack = project.findDependencyPackage(dependencyImport);
            if (depPack !== undefined) {
                const depImportPath = this.formatContractPath(depPack.resolveImport(dependencyImport));
                this.addContractAndResolveDependencyImportFromContractFullPath(depImportPath, project, contract, dependencyImport);
            }
        }
    }

    private addContractAndResolveDependencyImportFromContractFullPath(importPath: string, project: Project, contract: Contract, dependencyImport: string) {
        if (!this.containsContract(importPath)) {
            const importContractCode = this.readContractCode(importPath);
            if (importContractCode != null) {
                this.addContractAndResolveImports(importPath, importContractCode, project);
                contract.replaceDependencyPath(dependencyImport, importPath);
            }
        } else {
            contract.replaceDependencyPath(dependencyImport, importPath);
        }
    }
}
