import * as vscode from 'vscode';
const os = require('os');
const path = require('path');

import { Bytecode, AnalyzeOptions } from './types';
import { hasPlaceHolder } from './hasPlaceHolder';

export async function getAstData(contractName: string, fileContent: string): Promise<AnalyzeOptions>  {
    try {
        let outputAST;
        let fixedPath = vscode.window.activeTextEditor.document.fileName;
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // Windows OS hack
        if (os.platform() === 'win32') {
            fixedPath = fixedPath.replace(/\\/g, '/');
            if (fixedPath.charAt(0) === '/') {
                fixedPath = fixedPath.substr(1);
            }
        }

        const fileName = fixedPath.split('/').pop();
        const fileNameTrimmed = fileName.replace('.sol', '');


        const pathNoFileName = fixedPath.substring(0, fixedPath.lastIndexOf('/'));

        // Find differences between two path
        const relativePath = path.relative(rootPath, pathNoFileName);

        if (pathNoFileName === rootPath) {
            outputAST = path.join(rootPath, 'bin', `${fileNameTrimmed}-solc-output.json`);
        } else {
            outputAST =  path.join(rootPath, 'bin', relativePath, `${fileNameTrimmed}-solc-output.json`);
        }

        const documentObj = await vscode.workspace.openTextDocument(outputAST);
        const compiled = JSON.parse(documentObj.getText());

        const contract = compiled.contracts[fixedPath];

        const sources = compiled.sources;

        // source is required by our API but does not exist in solc output
        sources[fixedPath].source = fileContent;

        /*
         Data to submit
        */

        // Bytecode
        const bytecode: Bytecode = contract[contractName].evm.bytecode;
        const deployedBytecode: Bytecode = contract[contractName].evm.deployedBytecode;

        // Metadata
        const metadata = JSON.parse(contract[contractName].metadata);
        const solcVersion = metadata.compiler.version;

        const request: AnalyzeOptions = {
            bytecode: hasPlaceHolder(bytecode.object),
            contractName: contractName,
            deployedBytecode: hasPlaceHolder(deployedBytecode.object),
            deployedSourceMap: deployedBytecode.sourceMap,
            mainSource: fixedPath,
            solcVersion: solcVersion,
            sourceList: Object.keys(compiled.sources),
            sourceMap: bytecode.sourceMap,
            sources: sources,
            toolName: 'mythx-vscode-extension',
        };

        return request;

    } catch (err) {
        vscode.window.showWarningMessage(`Mythx error with analysing your AST. ${err}`);
        throw new Error(`Mythx error with analysing your AST. ${err}`);
    }
}
