'use strict';
import * as path from 'path';
import { formatPath } from '../util';
import { Project } from './project';

export class SourceDocument {
    public code: string;
    public unformattedCode: string;
    // TODO: Import needs to be a class including if is local, absolutePath, module etc
    public imports: Array<string>;
    public absolutePath: string;
    public packagePath: string;
    public abi: string;
    public project: Project;

    public static getAllLibraryImports(code: string): string[] {
        const importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
        const imports: string[] = [];
        let foundImport = importRegEx.exec(code);
        while (foundImport != null) {
            const importPath = foundImport[1];

            if (!this.isImportLocal(importPath)) {
                imports.push(importPath);
            }

            foundImport = importRegEx.exec(code);
        }
        return imports;
    }

    public static isImportLocal(importPath: string) {
        return importPath.startsWith('.');
    }

    constructor(absoulePath: string, code: string, project: Project) {
        this.absolutePath = this.formatDocumentPath(absoulePath);
        this.code = code;
        this.unformattedCode = code;
        this.project = project;
        this.imports = new Array<string>();
    }

    /**
   * Resolve import statement to absolute file path
   *
   * @param {string} importPath import statement in *.sol contract
   * @param {SourceDocument} contract the contract where the import statement belongs
   * @returns {string} the absolute path of the imported file
   */
    public resolveImportPath(importPath: string): string {
        if (this.isImportLocal(importPath)) {
        return this.formatDocumentPath(path.resolve(path.dirname(this.absolutePath), importPath));
        } else if (this.project !== undefined && this.project !== null) {
        const remapping = this.project.findImportRemapping(importPath);
            if (remapping !== undefined && remapping != null) {
                return this.formatDocumentPath(remapping.resolveImport(importPath));
            } else {
                const depPack = this.project.findDependencyPackage(importPath);
                if (depPack !== undefined) {
                return this.formatDocumentPath(depPack.resolveImport(importPath));
                }
            }
        }
        return path.resolve(this.project.projectPackage.absoluletPath, importPath);
    }

    public getAllImportFromPackages() {
        const importsFromPackages = new Array<string>();
        this.imports.forEach(importElement => {
            if (!this.isImportLocal(importElement)) {
                importsFromPackages.push(importElement);
            }
        });
        return importsFromPackages;
    }

    public isImportLocal(importPath: string) {
        return SourceDocument.isImportLocal(importPath);
    }

    public formatDocumentPath(contractPath: string) {
        return formatPath(contractPath);
    }

    public replaceDependencyPath(importPath: string, depImportAbsolutePath: string) {
        const importRegEx = /(^\s?import\s+[^'"]*['"])(.*)(['"]\s*)/gm;
        this.code = this.code.replace(importRegEx, (match, p1, p2, p3) => {
            if (p2 === importPath) {
                return p1 + depImportAbsolutePath + p3;
            } else {
                return match;
            }
        });
    }

    public resolveImports() {
        const importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
        let foundImport = importRegEx.exec(this.code);
        while (foundImport != null) {
            const importPath = foundImport[1];

            if (this.isImportLocal(importPath)) {
                const importFullPath = this.formatDocumentPath(path.resolve(path.dirname(this.absolutePath), foundImport[1]));
                this.imports.push(importFullPath);
            } else {
                this.imports.push(importPath);
            }

            foundImport = importRegEx.exec(this.code);
        }
    }
}
