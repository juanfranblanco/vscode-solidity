'use strict';
import * as path from 'path';

export class Package {
    public name: string;
    public version: string;
    public sol_sources: string;
    public build_dir: string;
    public absoluletPath: string;
    public dependencies: any;

    constructor(solidityDirectory: string) {
        this.build_dir = 'bin';
        this.sol_sources = solidityDirectory;
    }

    public getSolSourcesAbsolutePath() {
        if (this.sol_sources !== undefined || this.sol_sources === '') {
            return path.join(this.absoluletPath, this.sol_sources);
        }
        return this.absoluletPath;
    }

    public isImportForThis(contractDependencyImport: string) {
       const splitDirectories = contractDependencyImport.split('/');
        if (splitDirectories.length === 1) {
            return false;
        }
        return splitDirectories[0] === this.name;
    }

    public resolveImport(contractDependencyImport: string) {
        if (this.isImportForThis(contractDependencyImport)) {
            return path.join(this.getSolSourcesAbsolutePath(), contractDependencyImport.substring(this.name.length));
        }
        return null;
    }
}
