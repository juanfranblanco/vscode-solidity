'use strict';
import { resolve, dirname } from 'path';
import { formatPath as utilFormatPath } from '../util';

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

    public getAllImportFromPackages(): string[] {
        const importsFromPackages = new Array<string>();
        this.imports.forEach((importElement: string) => {
            if (!this.isImportLocal(importElement)) {
                importsFromPackages.push(importElement);
            }
        });
        return importsFromPackages;
    }

    public isImportLocal(importPath: string): boolean {
        return importPath.startsWith('.');
    }

    public formatPath(contractPath: string): string {
        return utilFormatPath(contractPath);
    }

    public replaceDependencyPath(importPath: string, depImportAbsolutePath: string): void {
        const importRegEx = /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm;
        this.code = this.code.replace(importRegEx, (match: string, p1: string, p2: string, p3: string) => {
            if (p2 === importPath) {
                return `${p1}${depImportAbsolutePath}${p3}`;
            } else {
                return match;
            }
        });
    }

    public resolveImports(): void {
        const importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
        let foundImport = importRegEx.exec(this.code);
        while (foundImport !== null) {
            const importPath = foundImport[1];

            if (this.isImportLocal(importPath)) {
                const importFullPath = this.formatPath(resolve(dirname(this.absolutePath), foundImport[1]));
                this.imports.push(importFullPath);
            } else {
                this.imports.push(importPath);
            }

            foundImport = importRegEx.exec(this.code);
        }
    }
}
