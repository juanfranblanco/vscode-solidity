'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';

let diagnosticCollection: vscode.DiagnosticCollection;

//working spike needs refactoring MVP

export function activate(context: vscode.ExtensionContext) {

    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
    context.subscriptions.push(diagnosticCollection);

    let disposable = vscode.commands.registerCommand('solidity.compile', () => {

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // We need something open
        }

        //Check if is folder, if not stop we need to output to a bin folder on rootPath
        if (vscode.workspace.rootPath === undefined) {
              vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
              return; 
        }
        
        let contracts = {};

        //Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?) 
        vscode.workspace.textDocuments.forEach(document => {
            
            if(path.extname(document.fileName) === 'sol'){
                let contract = {}
                let contractRelativePath = path.relative(vscode.workspace.rootPath, document.fileName).replace(/\\/g, '/');
                let currentDirectory = path.dirname(document.fileName);
                let contractCode = document.getText();
                contractCode = convertImportsToRelativeToRoot(contractCode, currentDirectory);
                contracts[contractRelativePath] = contractCode;
            }
        });

        //Find all the other sol files, to compile them (1000 maximum should be enough for now)
        let files = vscode.workspace.findFiles('**/*.sol', '**/bin/**', 1000);
        
        return files.then(documents => {
                
                documents.forEach(document => {
                    let contractRelativePath = path.relative(vscode.workspace.rootPath, document.fsPath).replace(/\\/g, '/');
                    
                    //have we got this already opened? used those instead
                    if (!contracts.hasOwnProperty(contractRelativePath)) {

                        let contractCode = fs.readFileSync(document.fsPath, "utf8");
                        let currentDirectory = path.dirname(document.fsPath);
                        contractCode = convertImportsToRelativeToRoot(contractCode, currentDirectory);
                        contracts[contractRelativePath] = contractCode;
                    }
                });
                
                //Did we find any sol files after all?
                if(Object.keys(contracts).length === 0){
                     vscode.window.showWarningMessage('No solidity files (*.sol) found');
                     return;
                }
                
                let output = solc.compile({ sources: contracts }, 1);
                
                if(Object.keys(output).length === 0){
                     vscode.window.showWarningMessage('No output by the compiler');
                     return;
                }
                
                diagnosticCollection.clear();

                if (output.errors) {

                    let diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();

                    vscode.window.showErrorMessage('Compilation Error', output.errors);

                    output.errors.forEach(error => {
                        //TODO: No file?
                        //TODO: No Line Number?
                        let errorSplit = error.split(":");
                        let fileName = errorSplit[0];
                        let line = parseInt(errorSplit[1]);
                        let column = parseInt(errorSplit[2]);
                        let targetUri = vscode.Uri.file(path.join(vscode.workspace.rootPath, fileName));
                        let range = new vscode.Range(line - 1, column, line - 1, column);
                        let diagnostic = new vscode.Diagnostic(range, error, vscode.DiagnosticSeverity.Error);
                        let diagnostics = diagnosticMap.get(targetUri);
                        if (!diagnostics) {
                            diagnostics = [];
                        }
                        diagnostics.push(diagnostic);
                        diagnosticMap.set(targetUri, diagnostics);
                    });
                    let entries: [vscode.Uri, vscode.Diagnostic[]][] = [];
                    diagnosticMap.forEach((diags, uri) => {
                        entries.push([uri, diags]);
                    });
                    diagnosticCollection.set(entries);
                } else {

                    let binPath = path.join(vscode.workspace.rootPath, 'bin');
                
                    if (!fs.existsSync(binPath)) {
                        fs.mkdirSync(binPath);
                    }
                    
                    //iterate through all the sources, find contracts and output them into the same folder structure to avoid collisions, named as the contract
                    for(var source in output.sources){
                        
                        output.sources[source].AST.children.forEach(child => {
                            if(child.name == "Contract"){
                                let contractName = child.attributes.name;
                                let dirName = path.dirname(path.join(binPath, source));
                                
                                 if (!fs.existsSync(dirName)) {
                                    fsex.mkdirsSync(dirName);
                                 }
                                
                                let contractAbiPath = path.join(dirName, contractName + ".abi");
                                let contractBinPath = path.join(dirName, contractName + ".bin");

                                if (fs.existsSync(contractAbiPath)) {
                                    fs.unlinkSync(contractAbiPath)
                                }

                                if (fs.existsSync(contractBinPath)) {
                                    fs.unlinkSync(contractBinPath)
                                }

                                fs.writeFileSync(contractBinPath, output.contracts[contractName].bytecode);
                                fs.writeFileSync(contractAbiPath, output.contracts[contractName].interface);
                            }
                        });
                                                
                    }

                    vscode.window.showInformationMessage('Compiled succesfully!');
                }
            });
           

    });

    context.subscriptions.push(disposable);
}


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

// this method is called when your extension is deactivated
export function deactivate() {
}