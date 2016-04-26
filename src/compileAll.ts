'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import {compile} from './compiler';

export function compileAllContracts(diagnosticCollection : vscode.DiagnosticCollection) {

        //Check if is folder, if not stop we need to output to a bin folder on rootPath
        if (vscode.workspace.rootPath === undefined) {
              vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
              return; 
        }
        
        let contracts = {};

        //Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?) 
        vscode.workspace.textDocuments.forEach(document => {
            
            if(path.extname(document.fileName) === 'sol'){
                let contractPath = document.fileName.replace(/\\/g, '/'); 
                let contractCode = document.getText();
                contracts[contractPath] = contractCode;
            }
        });

        //Find all the other sol files, to compile them (1000 maximum should be enough for now)
        let files = vscode.workspace.findFiles('**/*.sol', '**/bin/**', 1000);
        
        return files.then(documents => {
                
                documents.forEach(document => {
                    let contractPath = document.fsPath.replace(/\\/g, '/'); 
                    
                    //have we got this already opened? used those instead
                    if (!contracts.hasOwnProperty(contractPath)) {
                        let contractCode = fs.readFileSync(document.fsPath, "utf8");
                        contracts[contractPath] = contractCode;
                    }
                });
               
               compile(contracts, diagnosticCollection); 
               
            });
}

/*
//this might be required to inject temp libraries
function convertImportsToRelativeToRoot(document: string, currentPath: string){
      var importRegex = /(^\s*import\s*['|""])([^'|"]+)/gm;
      return document.replace(
        importRegex, (_, importPrefix, importPath) => {
          let resolvedPath = convertImportToRelativeToRoot(importPath, currentPath);
          return importPrefix + resolvedPath;
       }); 
}

function convertImportToRelativeToRoot(importPath: string, currentPath: string){
    let absolutePath = path.join(currentPath, importPath);
    let resolvedPath = path.relative(vscode.workspace.rootPath, absolutePath).replace(/\\/g, '/');
    if(!resolvedPath.endsWith(".sol")){
        resolvedPath = resolvedPath + ".sol";
    }
    return resolvedPath;
}
*/

