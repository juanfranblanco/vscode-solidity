'use strict';
import {Package} from './package';

export class Project {
    projectPackage: Package;
    dependencies: Array<Package>;
    packagesDir: string;

    constructor(projectPackage: Package, dependencies: Array<Package>, packagesDir:string) {
        this.projectPackage = projectPackage;
        this.dependencies = dependencies;
        this.packagesDir = packagesDir;
    }
    //this will need to add the current package as a parameter to resolve version dependencies
    findPackage(contractDependencyImport: string) {
        return this.dependencies.find((depPack: Package) => depPack.isImportForThis(contractDependencyImport));
    }
}