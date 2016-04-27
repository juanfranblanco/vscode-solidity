'use strict';
import * as fs from 'fs';
import * as path from 'path';

export class ContractCollection {
    contracts: any;
    constructor() {
        this.contracts = {};
    }

    formatPath(contractPath: string) {
        return contractPath.replace(/\\/g, '/');
    }

    containsContract(contractPath: string) {
        return this.contracts.hasOwnProperty(this.formatPath(contractPath));
    }

    addContract(contractPath: string, code: string) {
        if (!this.containsContract(contractPath)) {
            this.contracts[this.formatPath(contractPath)] = code;
            return true;
        }
        return false;
    }

    addContractAndResolveImports(contractPath: string, code: string) {

        if (this.addContract(contractPath, code)) {
            let importRegEx = /^\s?import\s+[^'"]*['"](.*)['"]\s*/gm;
            let foundImport = importRegEx.exec(code);
            while (foundImport != null) {
                //here we can validate if is relative path if starts with ./
                //if not it will be a package / global reference
                //or validate for a url ie.. github
                
                let importFullPath = this.formatPath(path.resolve(path.dirname(contractPath), foundImport[1]));
                //check if exists if it doesn't it will error compiling
                if (fs.existsSync(importFullPath)) {
                    //have we found it already? Is it referenced already?
                    if (!this.containsContract(importFullPath)) {
                        let importContractCode = fs.readFileSync(importFullPath, "utf8");
                        this.addContractAndResolveImports(importFullPath, importContractCode);
                        //lets find all the contracts this one imports
                    }
                }
                foundImport = importRegEx.exec(code);
            }
        }
    }
}