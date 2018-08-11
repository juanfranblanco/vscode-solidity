'use strict';
import { join } from 'path';

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

    public getSolSourcesAbsolutePath(): string {
        if (this.sol_sources !== undefined || this.sol_sources === '') {
            return join(this.absoluletPath, this.sol_sources);
        }
        return this.absoluletPath;
    }

    public isImportForThis(contractDependencyImport: string): boolean {
        const splitDirectories = contractDependencyImport.split('/');
        if (splitDirectories.length === 1) {
            return false;
        }
        return splitDirectories[0] === this.name;
    }

    public resolveImport(contractDependencyImport: string): string {
        if (this.isImportForThis(contractDependencyImport)) {
            return join(this.getSolSourcesAbsolutePath(), contractDependencyImport.substring(this.name.length));
        }
        return null;
    }
}
