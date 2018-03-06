'use strict';
import * as path from 'path';
import * as fs from 'fs';

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

    public checkSolSources() {
        this.sol_sources = 'contracts';
        let pathToCheck = path.join(this.absoluletPath, this.sol_sources);
        if(!fs.existsSync(pathToCheck)) {
            this.sol_sources = 'src';
        }
    }

    public getSolSourcesAbsolutePath() {
        if (this.sol_sources !== undefined || this.sol_sources === '') {
            return path.join(this.absoluletPath, this.sol_sources);
        }
        return this.absoluletPath;
    }

    public  isImportForThis(contractDependencyImport: string) {
       let splitDirectories = contractDependencyImport.split('/');
        if (splitDirectories.length === 1) {
            return false;
        }
        return splitDirectories[0] === this.name;
    }

    public resolveImport(contractDependencyImport: string) {
        if (this.isImportForThis(contractDependencyImport)) {
            let importPath = path.join(this.absoluletPath, this.sol_sources, contractDependencyImport.substring(this.name.length));
            if(fs.existsSync(importPath)) {
                return importPath;
            }
            
            importPath = path.join(this.absoluletPath, contractDependencyImport.substring(this.name.length));
            if(fs.existsSync(importPath)) {
                return importPath;
            }

            return importPath;
        }
        return null;
    }
}
