'use strict';
import * as fs from 'fs';
import { SourceDocument } from './sourceDocument';
import { Project } from './project';
import { formatPath } from '../util';

export class SourceDocumentCollection {
    public documents: Array<SourceDocument>;

    public static getAllLibraryImports(codeFiles: string[]): string[] {
        let imports: string[] = [];
        codeFiles.forEach(x => imports = imports.concat(SourceDocument.getAllLibraryImports(x)));
        return [...new Set(imports)];
    }

    constructor() {
        this.documents = new Array<SourceDocument>();
    }

    public isDocumentPathTheSame(contract: SourceDocument, contractPath: string) {
        return contract.absolutePath === contractPath;
    }

    public containsSourceDocument(contractPath: string) {
        return this.documents.findIndex((contract: SourceDocument) => { return contract.absolutePath === contractPath; }) > -1;
    }

    public getDefaultSourceDocumentsForCompilation(optimizeCompilationRuns = 200, evmVersion = "", viaIR: boolean = false) {
        const compilerOutputSelection = {
            '*': {
                '': ['ast'],
                '*': ['abi', 'devdoc', 'userdoc', 'storageLayout', 'metadata', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers', 'evm.gasEstimates'],
            },
        };

        return this.getSourceDocumentsForCompilation(true, optimizeCompilationRuns, evmVersion, viaIR, compilerOutputSelection);
    }

    public getDefaultSourceDocumentsForCompilationDiagnostics(evmVersion: string = "", viaIR: boolean = false) {
        const compilerOutputSelection = {
            '*': {
                '': [],
                '*': [],
            },
        };

        return this.getSourceDocumentsForCompilation(false, 0, evmVersion, viaIR, compilerOutputSelection);
    }

    public getSourceDocumentsForCompilation(optimizeCompilation: boolean, optimizeCompilationRuns: number, evmVersion: string = "", viaIR: boolean = false, outputSelection) {
        const contractsForCompilation = {};
        this.documents.forEach(contract => {
            contractsForCompilation[contract.absolutePath] = { content: contract.code };
        });

        if (evmVersion === "" || evmVersion === undefined || evmVersion === null) {
            const compilation = {
                language: 'Solidity',
                settings:
                {
                    optimizer: {
                        enabled: optimizeCompilation,
                        runs: optimizeCompilationRuns,
                    },
                    outputSelection: outputSelection,
                    viaIR: true,
                },

                sources: contractsForCompilation,
            };
            return compilation;
        } else {
            const compilation = {
                language: 'Solidity',
                settings:
                {
                    optimizer: {
                        enabled: optimizeCompilation,
                        runs: optimizeCompilationRuns,
                    },
                    outputSelection: outputSelection,
                    evmVersion: evmVersion,

                },

                sources: contractsForCompilation,
            };
            return compilation;
        }
    }


    public addSourceDocumentAndResolveImports(contractPath: string, code: string, project: Project) {
        const contract = this.addSourceDocument(contractPath, code, project);
        if (contract !== null) {
            contract.resolveImports();
            contract.imports.forEach(foundImport => {
                if (fs.existsSync(foundImport)) {
                    if (!this.containsSourceDocument(foundImport)) {
                        const importContractCode = this.readContractCode(foundImport);
                        if (importContractCode != null) {
                            this.addSourceDocumentAndResolveImports(foundImport, importContractCode, project);
                        }
                    }
                } else {
                    this.addSourceDocumentAndResolveDependencyImport(foundImport, contract, project);
                }
            });
        }
        return contract;
    }

    private addSourceDocument(contractPath: string, code: string, project: Project) {
        if (!this.containsSourceDocument(contractPath)) {
            const contract = new SourceDocument(contractPath, code, project);
            this.documents.push(contract);
            return contract;
        }
        return null;
    }

    private formatContractPath(contractPath: string) {
        return formatPath(contractPath);
    }

    private getAllImportFromPackages() {
        const importsFromPackages = new Array<string>();
        this.documents.forEach(contract => {
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

    private addSourceDocumentAndResolveDependencyImport(dependencyImport: string, contract: SourceDocument, project: Project) {
        // find re-mapping
        const remapping = project.findImportRemapping(dependencyImport);
        if (remapping !== undefined && remapping !== null) {
            const importPath = this.formatContractPath(remapping.resolveImport(dependencyImport));
            this.addSourceDocumentAndResolveDependencyImportFromContractFullPath(importPath, project, contract, dependencyImport);
        } else {
            const depPack = project.findDependencyPackage(dependencyImport);
            if (depPack !== undefined) {
                const depImportPath = this.formatContractPath(depPack.resolveImport(dependencyImport));
                this.addSourceDocumentAndResolveDependencyImportFromContractFullPath(depImportPath, project, contract, dependencyImport);
            }
        }
    }

    private addSourceDocumentAndResolveDependencyImportFromContractFullPath(importPath: string, project: Project, contract: SourceDocument, dependencyImport: string) {
        if (!this.containsSourceDocument(importPath)) {
            const importContractCode = this.readContractCode(importPath);
            if (importContractCode != null) {
                this.addSourceDocumentAndResolveImports(importPath, importContractCode, project);
                contract.replaceDependencyPath(dependencyImport, importPath);
            }
        } else {
            contract.replaceDependencyPath(dependencyImport, importPath);
        }
    }
}
