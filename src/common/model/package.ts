'use strict';
import * as path from 'path';
import * as fs from 'fs';
import { Remapping } from './remapping';

export class Package {
    public name: string;
    public version: string;
    public sol_sources: string;
    public build_dir: string;
    public absoluletPath: string;
    public dependencies: any;
    public sol_sources_alternative_directories: string[] = [];

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
            const defaultPath = path.join(this.getSolSourcesAbsolutePath(), contractDependencyImport.substring(this.name.length));
             if (fs.existsSync(defaultPath)) {
                return defaultPath;
             } else {
                for (let index = 0; index < this.sol_sources_alternative_directories.length; index++) {
                    const directory = this.sol_sources_alternative_directories[index];
                    if (directory !== undefined || directory === '') {
                        const fullpath = path.join(this.absoluletPath, directory, contractDependencyImport.substring(this.name.length));
                        if (fs.existsSync(fullpath)) {
                            return fullpath;
                        }
                    }
                }
             }
        }
        return null;
    }
}
