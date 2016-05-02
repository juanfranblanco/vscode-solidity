'use strict';
import * as path from 'path';
import * as util from '../util';

export class Contract {
    public code: string;
    // TODO: Import needs to be a class including if is local, absolutePath, module etc 
    public imports: Array<string>;
    public absolutePath: string;
    public packagePath: string;
    public abi: string;
    constructor(absoulePath: string, code: string) {
        this.absolutePath = this.formatPath(absoulePath);
        this.code = code;
        this.imports = new Array<string>();
    }

    public getAllImportFromPackages() {
        let importsFromPackages = new Array<string>();
        this.imports.forEach(importElement => {
            if (!this.isImportLocal(importElement)) {
                importsFromPackages.push(importElement);
            }
        });
        return importsFromPackages;
    }

    public isImportLocal(importPath: string) {
        return importPath.startsWith('.');
    }

    public formatPath(contractPath: string) {
        return util.formatPath(contractPath);
    }

    public replaceDependencyPath(importPath: string, depImportAbsolutePath: string) {
        let importRegEx = /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm;
        this.code = this.code.replace(importRegEx, (match, p1, p2, p3) => {
            if (p2 === importPath) {
                return p1 + depImportAbsolutePath + p3;
            } else {
                return match;
            }
        });
    }

    public resolveImports() {
        let importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
        let foundImport = importRegEx.exec(this.code);
        while (foundImport != null) {
            let importPath = foundImport[1];

            if (this.isImportLocal(importPath)) {
                let importFullPath = this.formatPath(path.resolve(path.dirname(this.absolutePath), foundImport[1]));
                this.imports.push(importFullPath);
            } else {
                this.imports.push(importPath);
            }

            foundImport = importRegEx.exec(this.code);
        }
    }
}
