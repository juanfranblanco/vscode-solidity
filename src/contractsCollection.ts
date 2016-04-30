'use strict';
import * as fs from 'fs';
import * as path from 'path';

export class Project {
    projectPackage: Package;
    dependencies: Array<Package>;

    constructor(projectPackage: Package, dependencies: Array<Package>) {
        this.projectPackage = projectPackage;
        this.dependencies = dependencies;
    }
    //this will need to add the current package as a parameter to resolve version dependencies
    findPackage(contractDependencyImport: string) {
        return this.dependencies.find((depPack: Package) => depPack.isImportForThis(contractDependencyImport));
    }
}

export class Package {
    name: string;
    version: string;
    sol_sources: string;
    build_dir: string;
    absoluletPath: string;
    dependencies: any;

    isImportForThis(contractDependencyImport: string) {
        return contractDependencyImport.startsWith(this.name);
    }

    resolveImport(contractDependencyImport: string) {
        if (this.isImportForThis(contractDependencyImport)) {
            return path.join(this.absoluletPath, this.sol_sources, contractDependencyImport.substring(this.name.length));
        }
        return null;
    }
}

export class Contract {
    code: string;
    imports: Array<string>;
    absolutePath: string;
    packagePath: string;
    abi: string;
    
    
    constructor(absoulePath: string, code: string) {
        this.absolutePath = this.formatPath(absoulePath);
        this.code = code;
        this.imports = new Array<string>();
    }

    getAllImportFromPackages() {
        let importsFromPackages = new Array<string>();
        this.imports.forEach(importElement => {
            if (!this.isImportLocal(importElement)) {
                importsFromPackages.push(importElement);
            }
        });
        return importsFromPackages;
    }

    isImportLocal(importPath: string) {
        return importPath.startsWith('.');
    }

    formatPath(contractPath: string) {
        return contractPath.replace(/\\/g, '/');
    }
    
    replaceDependencyPath(importPath:string, depImportAbsolutePath:string){
        let importRegEx =  /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm; 
        this.code = this.code.replace(importRegEx, (match, p1, p2, p3) =>{
            if(p2 === importPath){
                return p1 + depImportAbsolutePath + p3;
            }else{
                return match;
            }
        });
    }
    
 
    resolveImports() {
        let importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;;
        let foundImport = importRegEx.exec(this.code);
        while (foundImport != null) {
            let importPath = foundImport[1];

            if (this.isImportLocal(importPath)) {
                let importFullPath = this.formatPath(path.resolve(path.dirname(this.absolutePath), foundImport[1]));
                this.imports.push(importFullPath);
            } else {

                this.imports.push(importPath);
            }

            foundImport = importRegEx.exec(this.code);
        }
    }
}

export class ContractCollection {
    contracts: Array<Contract>;
    constructor() {
        this.contracts = new Array<Contract>();
    }

    formatPath(contractPath: string) {
        return contractPath.replace(/\\/g, '/');
    }

    isImportLocal(importPath: string) {
        return importPath.startsWith('.');
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

    addContractAndResolveImports(contractPath: string, code: string, project: Project) {
        let contract = this.addContract(contractPath, code);
        if (contract !== null) {
            contract.resolveImports();
            contract.imports.forEach(foundImport => {
                if (fs.existsSync(foundImport)) {
                    //have we found it already? Is it referenced already?
                    if (!this.containsContract(foundImport)) {
                        let importContractCode = fs.readFileSync(foundImport, "utf8");
                        this.addContractAndResolveImports(foundImport, importContractCode, project);
                    }
                } else {
                    if (!this.isImportLocal(foundImport)) {
                        let depPack = project.findPackage(foundImport);
                        if (depPack !== null) {
                            let depImportPath = this.formatPath(depPack.resolveImport(foundImport));
                            if (fs.existsSync(depImportPath)) {
                                //have we found it already? Is it referenced already?
                                if (!this.containsContract(depImportPath)) {
                                    let importContractCode = fs.readFileSync(depImportPath, "utf8");
                                    this.addContractAndResolveImports(depImportPath, importContractCode, project);

                                }
                                contract.replaceDependencyPath(foundImport, depImportPath);
                            }
                        }
                    }
                }
            });
        }
        return contract;
    }
}