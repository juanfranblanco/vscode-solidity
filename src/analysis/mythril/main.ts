'use strict';

import * as path from 'path';
import * as solc from 'solc';
import * as vscode from 'vscode';
import { DiagnosticSeverity as Severity, Diagnostic, Range } from 'vscode-languageserver';
import { ContractCollection } from '../../model/contractsCollection';
import { ApiVersion, Client } from 'armlet';
import { SolcCompiler } from '../../solcCompiler';
import { versionJSON2String } from './util';

// What we use in a new armlet.Client()
interface ArmletOptions {
    apiKey: string;
    userEmail: string;
    platforms: Array<string>;
}

// What we use in a new armlet analyze call
interface AnalyzeOptions {
    data: any;  // Actually a JSON dictionary
    timeout: number;
}

// This is adapted from 'remix-lib/src/sourceMappingDecoder.js'
function showMessage (mess) {
    const outputChannel = vscode.window.createOutputChannel('Mythril');
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine(mess);
}

// This is adapted from 'remix-lib/src/sourceMappingDecoder.js'
function compilerInput (contracts) {
    return JSON.stringify({
    language: 'Solidity',
    settings: {
        optimizer: {
        enabled: false,
        runs: 200,
        },
        outputSelection: {
        '*': {
            '': [ 'legacyAST' ],
            '*': [ 'abi', 'metadata', 'evm.legacyAssembly', 'evm.bytecode', 'evm.deployedBytecode', 'evm.methodIdentifiers'],
            },
        },
    },
    sources: {
            'test.sol': {
                content: contracts,
            },
        },
    });
}

// Take solc's JSON output and make it compatible with the Mythril Platform API
function solc2MythrilJSON(inputSolcJSON, contractName, sourceCode,
                analysisMode) {

    // Add/remap some fields because the Mythril Platform API doesn't
    // align with solc's JSON.

    const solcJSON = {
        analysisMode: analysisMode,
        bytecode: '',
        contractName: contractName,
        deployedBytecode: '',
        deployedSourceMap: '',
        sourceList: [contractName],
        sourceMap: '',
        sources: {},
    };
    solcJSON.sources[contractName] = sourceCode;

    for (const field of ['bytecode', 'deployedBytecode']) {
        solcJSON[field] = inputSolcJSON.evm[field].object;
    }

    solcJSON.deployedSourceMap = inputSolcJSON.evm.deployedBytecode.sourceMap;
    solcJSON.sourceMap = inputSolcJSON.evm.bytecode.sourceMap;

    return solcJSON;
}

function solidityPathAndSource() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No file opened');
        return null; // We need something open
    }

    const fileName = path.extname(editor.document.fileName);
    if (fileName !== '.sol') {
        vscode.window.showErrorMessage(`{$fileName} not a solidity file; should match: *.sol`);
        return null;
    }

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');
        return null;
    }

    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;
    return {
        code: contractCode,
        path: contractPath,
    };
}


export function mythrilVersion() {
    ApiVersion().then(
        result => {
            const mess = versionJSON2String(result);
            vscode.window.showInformationMessage(mess);
        });
}

export function mythrilAnalyze() {
    const solidityConfig = vscode.workspace.getConfiguration('solidity');
    const outputChannel = vscode.window.createOutputChannel('Mythril');
    const options = {
        apiKey: solidityConfig.mythrilAPIKey,
        platforms: ['vscode-solidity'],  // client chargeback
        userEmail: 'user@example.com',
    };


    const pathAndCode = solidityPathAndSource();
    if (!pathAndCode) {
        return;
    }
    const output = solc.compileStandardWrapper(compilerInput(pathAndCode.code));
    const outputJSON = JSON.parse(output);
    if ('errors' in outputJSON) {
        outputChannel.clear();
        outputChannel.show();
        outputJSON.array.forEach(element => {
            outputChannel.appendLine(element);
        });
        return;
    }

    const contractsJSON = outputJSON.contracts['test.sol'];
    const contractNames = Object.keys(contractsJSON);
    if (contractNames.length === 0) {
        showMessage('No contract found');
    return;
    } else if (contractNames.length !== 1) {
        vscode.window.showWarningMessage(`more than one contract found; ${contractNames[0]} used`);
    }
    const contractName = contractNames[0];
    const contractData = solc2MythrilJSON(contractsJSON[contractName], contractName,
        pathAndCode.code, 'full');

    const client = new Client(options);

    const analyzeOptions = {
    // FIXME: data: JSON.parse(fs.readFileSync(jsonPath, 'utf8')),
    data: contractData,
    timeout: solidityConfig.mythrilTimeout * 1000,  // convert secs to millisecs
    };

    client.analyze(analyzeOptions)
    .then(issues => {const mess = JSON.stringify(issues, null, 4);
        showMessage(mess);
    }).catch(err => {
        showMessage(err);
        vscode.window.showWarningMessage(err);
    });
}
