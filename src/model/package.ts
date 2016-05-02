'use strict';
import * as path from 'path';

export class Package {
    public name: string;
    public version: string;
    public sol_sources: string;
    public build_dir: string;
    public absoluletPath: string;
    public dependencies: any;

    constructor() {
        this.build_dir = 'bin';
    }

    public getSolSourcesAbsolutePath() {
        if (this.sol_sources !== undefined || this.sol_sources === '') {
            return path.join(this.absoluletPath, this.sol_sources);
        }
        return this.absoluletPath;
    }

    public isImportForThis(contractDependencyImport: string) {
        return contractDependencyImport.startsWith(this.name);
    }

    public resolveImport(contractDependencyImport: string) {
        if (this.isImportForThis(contractDependencyImport)) {
            return path.join(this.absoluletPath, this.sol_sources, contractDependencyImport.substring(this.name.length));
        }
        return null;
    }
}
