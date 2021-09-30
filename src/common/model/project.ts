'use strict';
import {Package} from './package';
import { Remapping, importRemappings, importRemappingArray } from './remapping';

export class Project {
    public projectPackage: Package;
    public dependencies: Array<Package>;
    public packagesDir: string;
    private remappings: Remapping[]

    constructor(projectPackage: Package, dependencies: Array<Package>, packagesDir: string, remappings: string[]) {
        this.projectPackage = projectPackage;
        this.dependencies = dependencies;
        this.packagesDir = packagesDir;
        this.remappings = importRemappingArray(remappings, this);
    }
    // This will need to add the current package as a parameter to resolve version dependencies
    public findDependencyPackage(contractDependencyImport: string) {
        return this.dependencies.find((depPack: Package) => depPack.isImportForThis(contractDependencyImport));
    }

    public findImportRemapping(contractDependencyImport: string): Remapping {
        //const remappings = importRemappings("@openzeppelin/=lib/openzeppelin-contracts//\r\nds-test/=lib/ds-test/src/", this);
        return this.remappings.find( x => x.isImportForThis(contractDependencyImport));
    }
}


