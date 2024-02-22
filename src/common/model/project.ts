'use strict';
import {Package} from './package';
import { Remapping, importRemappings, importRemappingArray } from './remapping';
import * as path from 'path';
import { glob } from 'glob';

export class Project {
    public projectPackage: Package;
    public dependencies: Array<Package>;
    public packagesDir: string[];
    public remappings: Remapping[];

    constructor(projectPackage: Package, dependencies: Array<Package>, packagesDir: string[], remappings: string[]) {
        this.projectPackage = projectPackage;
        this.dependencies = dependencies;
        this.packagesDir = packagesDir;
        this.remappings = importRemappingArray(remappings, this);
    }
    // This will need to add the current package as a parameter to resolve version dependencies
    public findDependencyPackage(contractDependencyImport: string) {
        return this.dependencies.find((depPack: Package) => depPack.isImportForThis(contractDependencyImport));
    }

    public getAllSolFilesIgnoringDependencyFolders() {
       const solPath = this.projectPackage.getSolSourcesAbsolutePath() + '/**/*.sol';
       const exclusions: string[] = [];
       this.packagesDir.forEach(x => {
            exclusions.push(path.join(this.projectPackage.getSolSourcesAbsolutePath(), x, '**'));
       });
       exclusions.push(path.join(this.projectPackage.getSolSourcesAbsolutePath(), this.projectPackage.build_dir, '**'));
       this.getAllRelativeLibrariesAsExclusionsFromRemappings().forEach(x => exclusions.push(x));
       return glob.sync( solPath, { ignore: exclusions, nodir: true });
    }

    public getAllRelativeLibrariesAsExclusionsFromRemappings(): string[] {
       return this.getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths().map(x => path.join(x, '**'));
    }

    public getAllRelativeLibrariesRootDirsFromRemappings(): string[] {
        const results: string[] = [];
        this.remappings.forEach(element => {
            const dirLib =  element.getLibraryPathIfRelative(this.projectPackage.getSolSourcesAbsolutePath());
            if (dirLib !== null && results.find(x => x === dirLib) === undefined) {
                results.push(dirLib);
            }
        });
        return results;
    }

    public getAllRelativeLibrariesRootDirsFromRemappingsAbsolutePaths() {
        return this.getAllRelativeLibrariesRootDirsFromRemappings().map(x => path.resolve(this.projectPackage.getSolSourcesAbsolutePath(), x));
    }

    public findImportRemapping(contractDependencyImport: string): Remapping {
        // const remappings = importRemappings("@openzeppelin/=lib/openzeppelin-contracts//\r\nds-test/=lib/ds-test/src/", this);
        const foundRemappings = [];
        this.remappings.forEach(element => {
            if ( element.isImportForThis(contractDependencyImport)) {
                foundRemappings.push(element);
            }
        });

        if (foundRemappings.length > 0) {
            return this.sortByLength(foundRemappings)[foundRemappings.length - 1];
        }
        return null;
    }

    public findRemappingForFile(filePath: string): Remapping {
        const foundRemappings = [];
        this.remappings.forEach(element => {
            if ( element.isFileForThis(filePath)) {
                foundRemappings.push(element);
            }
        });

        if (foundRemappings.length > 0) {
            return this.sortByLength(foundRemappings)[foundRemappings.length - 1];
        }
        return null;
    }

    private sortByLength(array) {
        return array.sort(function(a, b) {
          return a.length - b.length;
        });
    }
}


