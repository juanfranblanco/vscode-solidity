'use strict';
import * as path from 'path';

export class Package {
    name: string;
    version: string;
    sol_sources: string;
    build_dir: string;
    absoluletPath: string;
    dependencies: any;
    
    constructor(){
        this.build_dir = "bin";
    }
    
    getSolSourcesAbsolutePath(){
        return path.join(this.absoluletPath, this.sol_sources);
    }
    
    isImportForThis(contractDependencyImport: string) {
        return contractDependencyImport.startsWith(this.name);
    }

    resolveImport(contractDependencyImport: string) {
        if (this.isImportForThis(contractDependencyImport)) {
            return path.join(this.absoluletPath, this.sol_sources, contractDependencyImport.substring(this.name.length));
        }
        return null;
    }
}
