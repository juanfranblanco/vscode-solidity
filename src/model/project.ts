'use strict';
import {Package} from './package';

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