import * as vscode from "vscode";
const os = require('os');
const path = require('path')

import { Bytecode, AnalyzeOptions } from "./types"
import { hasPlaceHolder } from './hasPlaceHolder'

export async function getAstData(contractName: string, fileContent: string): Promise<AnalyzeOptions>  {
	try {
		let outputAST
		let fixedPath = vscode.window.activeTextEditor.document.fileName;
		const roothPath = vscode.workspace.rootPath;

		// Windows OS hack
		if(os.platform() === 'win32') {
			fixedPath = fixedPath.replace(/\\/g, '/') 
			if (fixedPath.charAt(0) === '/') {
				fixedPath = fixedPath.substr(1);
			}
		}
		
		const fileName = fixedPath.split("/").pop();
		const fileNameTrimmed = fileName.replace('.sol', '')


		const pathNoFileName = fixedPath.substring(0, fixedPath.lastIndexOf("/"));

		// Find differences between two path
		const relativePath = path.relative(vscode.workspace.rootPath, pathNoFileName);

		if(pathNoFileName === roothPath) {
			outputAST = `${roothPath}/bin/${fileNameTrimmed}-solc-output.json`
		} else {
			outputAST = `${roothPath}/bin/${relativePath}/${fileNameTrimmed}-solc-output.json`
		}

		const documentObj = await vscode.workspace.openTextDocument(outputAST)
		const compiled = JSON.parse(documentObj.getText());

		const contract = compiled.contracts[fixedPath]
		
		const sources = compiled.sources

		// source is required by our API but does not exist in solc output
		sources[fixedPath].source = fileContent

		/*
		 Data to submit
		*/

		// Bytecode
		const bytecode: Bytecode = contract[contractName].evm.bytecode
		const deployedBytecode: Bytecode = contract[contractName].evm.deployedBytecode

		// Metadata
		const metadata = JSON.parse(contract[contractName].metadata)
		const solcVersion = metadata.compiler.version

		const request: AnalyzeOptions = {
				toolName: "mythx-vscode-extension",
				contractName: contractName,
				bytecode: hasPlaceHolder(bytecode.object),
				sourceMap: bytecode.sourceMap,
				deployedBytecode: hasPlaceHolder(deployedBytecode.object),
				deployedSourceMap: deployedBytecode.sourceMap,
				mainSource: fixedPath,
				sources: sources,
				sourceList: Object.keys(compiled.sources),
				solcVersion: solcVersion
		}

		return request
	
	} catch(err) {
		vscode.window.showWarningMessage(`Mythx error with analysing your AST. ${err}`);
		throw new Error(`Mythx error with analysing your AST. ${err}`)
	}
}