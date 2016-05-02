'use strict';
import {Package} from './package';

export class Project {
    public projectPackage: Package;
    public dependencies: Array<Package>;
    public packagesDir: string;

    constructor(projectPackage: Package, dependencies: Array<Package>, packagesDir: string) {
        this.projectPackage = projectPackage;
        this.dependencies = dependencies;
        this.packagesDir = packagesDir;
    }
    // This will need to add the current package as a parameter to resolve version dependencies
    public findPackage(contractDependencyImport: string) {
        return this.dependencies.find((depPack: Package) => depPack.isImportForThis(contractDependencyImport));
    }
}