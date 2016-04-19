'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    
    diagnosticCollection = vscode.languages.createDiagnosticCollection('solidity');
    context.subscriptions.push(diagnosticCollection);
    
    let disposable = vscode.commands.registerCommand('solidity.compile', () => {
     
       let editor = vscode.window.activeTextEditor;
       if (!editor) {
         return; // No open text editor
       }
      
       //TODO: if not saved? force saving? what happens if it is just a new file?
       if(vscode.window.activeTextEditor.document.fileName){
           
       }
       
       //TODO: Check if is folder, if not stop
       if(vscode.workspace.rootPath == null){
           
       }
       
       let binPath = path.join(vscode.workspace.rootPath, 'bin');
       //TODO 
       if(!fs.existsSync(binPath)){
          fs.mkdirSync(binPath);
       }
       
       
       //TODO: use linker from dapple https://github.com/nexusdev/dapple/blob/master/lib/linker.js and get all the contracts dependencies
       
       let contractCode = editor.document.getText();
       
       let output = solc.compile(contractCode, 1);
      
       diagnosticCollection.clear();
       
       if(output.errors){
           
           
           let diagnosticMap: Map<vscode.Uri, vscode.Diagnostic[]> = new Map();
           
           vscode.window.showErrorMessage('Compilation Error', output.errors);
           
           output.errors.forEach(error => {
           //TODO: No file?
               let targetUri = vscode.Uri.file(vscode.window.activeTextEditor.document.fileName);
           //TODO: No Line Number?
               let errorSplit = error.split(":");
               let line = parseInt(errorSplit[1]);
               let column = parseInt(errorSplit[2]);
               let range = new vscode.Range(line -1, column, line-1, column);
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
       }else{
       
       for (var contractName in output.contracts) {
           let contractAbiPath = path.join(binPath, contractName + ".abi");
           let contractBinPath = path.join(binPath, contractName + ".bin");
           
           //TODO: Refactor all this when doing multiple contracts, including all the sync 
           if(fs.existsSync(contractAbiPath)){
               fs.unlinkSync(contractAbiPath)
           }
           
           if(fs.existsSync(contractBinPath)){
               fs.unlinkSync(contractBinPath)
           }
           
           fs.writeFileSync(path.join(binPath, contractName + ".bin" ), output.contracts[contractName].bytecode);
           fs.writeFileSync(path.join(binPath, contractName + ".abi" ), output.contracts[contractName].interface);
        }
       
         vscode.window.showInformationMessage('Compiled succesfully!');
       }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}