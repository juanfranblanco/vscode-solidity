import * as fs from 'fs';
import * as path from 'path';
import * as solc from 'solc';
import * as vscode from 'vscode';
import * as myth from './myth';
import * as trufstuf from './trufstuf';
import { DiagnosticSeverity as Severity, Diagnostic, Range } from 'vscode-languageserver';
import { ContractCollection } from '../../model/contractsCollection';
import { ApiVersion, Client } from 'armlet';
import { versionJSON2String, getFormatter } from './util';
import { printReport } from './es-reporter';

import * as Config from 'truffle-config';
import { compile } from 'truffle-workflow-compile';

const warnFn = vscode.window.showWarningMessage;

// What we use in a new armlet.Client()
interface ArmletOptions {
    apiKey: string;
    // userEmail: string;
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
        warnFn('No file opened');
        return null; // We need something open
    }

    const fileName = path.extname(editor.document.fileName);
    if (fileName !== '.sol') {
        warnFn(`{$fileName} not a solidity file; should match: *.sol`);
        return null;
    }

    let rootDir = vscode.workspace.rootPath;
    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        warnFn('Please open a folder in Visual Studio Code as a workspace');
        return null;
    } else if (path.basename(rootDir) === 'contracts') {
        rootDir = path.dirname(rootDir);
    }

    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;

    return {
        buildDir: `${rootDir}/build/contracts`,
        code: contractCode,
        path: contractPath,
        rootDir: rootDir,
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
    const pathInfo = solidityPathAndSource();

    const truffleOptions = {
        _: [],
        logger: {
            debug: console.log,
            info: console.log,
            log: console.log,
            warn: console.log,
        },
        working_directory: pathInfo.rootDir,
    };
    const config = Config.detect(truffleOptions);
    const buildDir = pathInfo.buildDir;

    // Run Mythril Platform analyze after we have
    // ensured via compile that JSON data is there and
    // up to date.
    // Parameters "config", and "done" are implicitly passed in.
    function analyzeWithBuildDir() {
        // FIXME: use truffle library routine
        const contractsDir = trufstuf.getContractsDir(pathInfo.rootDir);

        let solidityFileBase: string;
        let solidityFile: string;
        let buildJsonPath: string;
        let buildJson;

        try {
            if (config._.length === 0) {
                buildJson = trufstuf.guessTruffleBuildJson(buildDir);
            } else {
                buildJson = path.basename(config._[0]);
            }
            solidityFileBase = path.basename(buildJson, '.json');

            if (! solidityFileBase.endsWith('.sol')) {
                solidityFileBase += '.sol';
            }

            solidityFile = path.join(contractsDir, solidityFileBase);
            if (config.debug) {
                warnFn(`Solidity file used: ${solidityFile}`);
            }

            buildJsonPath = path.join(buildDir, buildJson);
            if (! buildJsonPath.endsWith('.json')) {
                buildJsonPath += '.json';
            }

        } catch (err) {
            vscode.window.showWarningMessage(err);
            return;
        }

        // console.log(`Reading ${buildJsonPath}`);

        const armletOptions = {
            apiKey: solidityConfig.mythrilAPIKey,
            // email: 'user@example.com',
            platforms: ['vscode-solidity'],  // client chargeback
            // ethAddress: process.env.MYTHRIL_ETH_ADDRESS,
            // password: process.env.MYTHRIL_PASSWORD,
        };

        let client: any;
        try {
            client = new Client(armletOptions);
        } catch (err) {
            warnFn(err);
            return;
        }

        if (!fs.existsSync(buildJsonPath)) {
            vscode.window.showWarningMessage("Can't read build/contract JSON file: " +
                                             `${buildJsonPath}`);
            return;
        }

        let buildObj: any;
        try {
            buildObj = JSON.parse(fs.readFileSync(buildJsonPath, 'utf8'));
        } catch (err) {
            warnFn(`Error parsing JSON file: ${buildJsonPath}`);
            return;
        }

        const analyzeOpts = {
            data: myth.truffle2MythrilJSON(buildObj),
            mode: 'full',
            partners: ['vscode-solidity'],
            timeout: solidityConfig.mythrilTimeout * 1000,  // convert secs to millisecs

            // FIXME: The below "partners" will change when
            // https://github.com/ConsenSys/mythril-api/issues/59
            // is resolved.
            };

        analyzeOpts.data.analysisMode = 'full';

        const contractName: string = buildObj.contractName;

        client.analyze(analyzeOpts)
            .then(issues => {
                const formatter = getFormatter(solidityConfig.mythrilReportFormat);
                const esIssues = myth.issues2Eslint(issues, buildObj, analyzeOpts);
                printReport(esIssues, contractName, formatter, showMessage);
                // showMessage(mess);
            }).catch(err => {
                showMessage(err);
                vscode.window.showWarningMessage(err);
            });
        }

    // This can cause vyper to fail if you don't have vyper installed
    delete config.compilers.vyper;
    compile(config,
         function(arg) {
            if (arg !== null) {
                showMessage(`compile returns ${arg}`);
            } else {
                analyzeWithBuildDir();
            }
        });
}
