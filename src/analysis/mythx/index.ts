import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as mythx from './mythx';
import * as trufstuf from './trufstuf';
import { ApiVersion, Client } from 'armlet';
import { versionJSON2String, getFormatter } from './util';
import { writeMarkdownReportAsync, writeMarkdownReport } from './md-reporter';
import * as util from 'util';
import { getUniqueIssues } from './eslint';

// vscode-solidity's wrapper around solc
import {SolcCompiler} from '../../solcCompiler';


import * as Config from 'truffle-config';
import { compile } from 'truffle-workflow-compile';
import * as stripAnsi from 'strip-ansi';


const trialEthAddress = '0x0000000000000000000000000000000000000000';
const trialPassword = 'trial';
const defaultAnalyzeRateLimit = 4;


const fsExists = util.promisify(fs.exists);
const fsMkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);

const warnFn = vscode.window.showWarningMessage;

const outputChannel = vscode.window.createOutputChannel('MythX');

// What we use in a new armlet.Client()
interface ArmletOptions {
    apiKey: string;
}

// What we use in a new armlet analyze call
interface AnalyzeOptions {
    clientToolName: string;
    data: any;  // Actually a JSON dictionary
    timeout: number;
}

// What we use in a new armlet analyze call
interface SolidityMythXOption {
    password: string;
    ethAddress: string;
}

// FIXME: util.promisify breaks compile internal call to writeContracts
// const contractsCompile = util.promisify(contracts.compile);
const contractsCompile = config => {
    return new Promise((resolve, reject) => {
        compile(config, (err, result) => {
            if (err) {
                reject(err);
                return ;
            }
            resolve(result);
        });
    });
};

// This is adapted from 'remix-lib/src/sourceMappingDecoder.js'
function showMessage (mess: string) {
    outputChannel.clear();
    outputChannel.show();
    if (process.platform === 'darwin') {
        // OSX OutputChannel can't handle ANSI codes, I think.
        mess = stripAnsi(mess);
    }
    outputChannel.appendLine(mess);
}

// Take solc's JSON output and make it compatible with the Mythril Platform API
function solc2MythrilJSON(inputSolcJSON: any,
                          contractName: string,
                          sourceCode: string,
                          analysisMode: string) {

    // Add/remap some fields because the MythX Platform API doesn't
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

function getArmletCredentialKeys(config: SolidityMythXOption): any {
    const { password, ethAddress } = config;
    return {
        ethAddress: (ethAddress || trialEthAddress),
        password: (password || trialPassword),
    };
}

function solidityPathAndSource() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        warnFn('No file opened');
        return null; // We need something open
    }

    const contractPath = editor.document.fileName;
    const extName = path.extname(contractPath);
    if (extName !== '.sol') {
        warnFn(`${contractPath} not a solidity file; should match: *.sol`);
        return null;
    }

    const rootDir = trufstuf.getRootDir(contractPath);
    const contractCode = editor.document.getText();

    return {
        buildContractsDir: trufstuf.getBuildContractsDir(rootDir),
        code: contractCode,
        path: contractPath,
        rootDir: rootDir,
    };
}

/**
 * A 2-level line-column comparison function.
 * @returns {integer} -
      zero:      line1/column1 == line2/column2
      negative:  line1/column1 < line2/column2
      positive:  line1/column1 > line2/column2
*/
function compareLineCol(line1: number, column1: number, line2: number, column2: number) {
    return line1 === line2 ?
        (column1 - column2) :
        (line1 - line2);
}

/**
 * A 2-level comparison function for eslint message structure ranges
 * the fields off a message
 * We use the start position in the first comparison and then the
 * end position only when the start positions are the same.
 *
 * @returns {integer} -
      zero:      range(mess1) == range(mess2)
      negative:  range(mess1) <  range(mess2)
      positive:  range(mess1) > range(mess)

*/
function compareMessLCRange(mess1: any, mess2: any) {
    const c = compareLineCol(mess1.line, mess1.column, mess2.line, mess2.column);
    return c !== 0 ? c : compareLineCol(mess1.endLine, mess1.endCol, mess2.endLine, mess2.endCol);
}

const groupEslintIssuesByBasename = (issues: any) => {
    const mappedIssues = issues.reduce((accum: any, issue: any) => {
        const {
            errorCount,
            warningCount,
            fixableErrorCount,
            fixableWarningCount,
            filePath,
            messages,
        } = issue;

        const basename = path.basename(filePath);
        if (!accum[basename]) {
            accum[basename] = {
                errorCount: 0,
                filePath: filePath,
                fixableErrorCount: 0,
                fixableWarningCount: 0,
                messages: [],
                warningCount: 0,
            };
        }
        accum[basename].errorCount += errorCount;
        accum[basename].warningCount += warningCount;
        accum[basename].fixableErrorCount += fixableErrorCount;
        accum[basename].fixableWarningCount += fixableWarningCount;
        accum[basename].messages = accum[basename].messages.concat(messages);
        return accum;
    }, {});

    const issueGroups: any = Object.values(mappedIssues);
    for (const group of issueGroups) {
        group.messages = group.messages.sort(function(mess1: any, mess2: any) {
            return compareMessLCRange(mess1, mess2);
        });

    }

    return issueGroups;
};

// Run MythX  analyze after we have
// ensured via compile that JSON data is there and
// up to date.
// Parameters "config", and "done" are implicitly passed in.
async function analyzeWithBuildDir({
    pathInfo,
    config,
    buildContractsDir,
    solidityConfig,
    progress,
}: any) {
    let buildJsonPath: string;

    try {
        const jsonFiles = await trufstuf.getTruffleBuildJsonFilesAsync(buildContractsDir);
        buildJsonPath = jsonFiles[0];
    } catch (err) {
        console.log(err);
        vscode.window.showWarningMessage(err.message);
        return;
    }

    // console.log(`Reading ${buildJsonPath}`);

    // get armlet authentication options
    const armletAuthOptions = getArmletCredentialKeys(solidityConfig.mythx);

    const armletOptions = {
        ...armletAuthOptions,
    };

    let client: any;
    try {
        client = new Client(armletOptions, solidityConfig.mythx.apiUrl);
    } catch (err) {
        console.log(err);
        warnFn(err);
        return;
    }

    const isBuildJsonPathExists = await fsExists(buildJsonPath);

    if (!isBuildJsonPathExists) {
        vscode.window.showWarningMessage("Can't read build/contract JSON file: " +
                                            `${buildJsonPath}`);
        return;
    }

    let buildObj: any;
    try {
        const buildJson = await readFile(buildJsonPath, 'utf8');
        buildObj = JSON.parse(buildJson);
    } catch (err) {
        console.log(err);
        warnFn(`Error parsing JSON file: ${buildJsonPath}`);
        return;
    }

    const obj = new mythx.MythXIssues(buildObj);

    const mythxBuilObj: any = obj.getBuildObj();
    const analyzeOpts = {
        clientToolName: 'vscode-solidity',
        data: mythxBuilObj,
        timeout: solidityConfig.mythx.timeout * 1000,  // convert secs to millisecs
    };

    analyzeOpts.data.analysisMode = solidityConfig.mythx.analysisMode;

    const contractName: string = buildObj.contractName;

    const timeout = solidityConfig.mythx.timeout;
    const progressStep = 100 / timeout;
    let progressBarcurrStep = 0;
    let progressBarInterval = setInterval(() => {
        if (progressBarInterval && progressBarcurrStep >= 100) {
            clearInterval(progressBarInterval);
            progressBarInterval = null;
            return ;
        }
        progressBarcurrStep += progressStep;

        progress.report({ increment: progressBarcurrStep, message: `Running ${contractName}` });
    }, 1000);

    let mythXresult: any;
    try {
        mythXresult = await client.analyzeWithStatus(analyzeOpts);

        if (progressBarcurrStep < 100 ) {
            progressBarcurrStep = 100;
            progress.report({ increment: progressBarcurrStep, message: `Running ${contractName}` });
        }
        obj.setIssues(mythXresult.issues);
        if (!config.style) {
            config.style = 'stylish';
        }
        const spaceLimited: boolean = ['tap', 'markdown'].indexOf(config.style) === -1;
        const eslintIssues = obj.getEslintIssues(spaceLimited);
        const formatter = getFormatter(solidityConfig.mythx.reportFormat);
        const groupedEslintIssues = groupEslintIssuesByBasename(eslintIssues);

        const uniqueIssues = getUniqueIssues(groupedEslintIssues);
        showMessage(formatter(uniqueIssues));

        const reportsDir = trufstuf.getMythReportsDir(buildContractsDir);
        const mdData = {
            analysisMode: analyzeOpts.data.analysisMode,
            compilerVersion: analyzeOpts.data.version,
            contractName,
            groupedEslintIssues,
            reportsDir: reportsDir,
            sourcePath: mythxBuilObj.sourceList[0], // FIXME: We currently analyze single file. It's ok to take first item
            status: mythXresult.status,
            timeout: solidityConfig.mythx.timeout,
            // Add stuff like mythx version
        };
        await writeMarkdownReportAsync(mdData);
    } catch (err) {
        if (progressBarInterval) {
            clearInterval(progressBarInterval);
            progressBarInterval = null;
        }
        console.log(err);
        showMessage(err);
        vscode.window.showWarningMessage(err);
    }
    return true;
}


export function mythxVersion() {
    ApiVersion().then(
        (result: any) => {
            const mess = versionJSON2String(result);
            vscode.window.showInformationMessage(mess);
        });
}

export async function mythxAnalyze(progress) {
    const solidityConfig = vscode.workspace.getConfiguration('solidity');
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

    let config: any;
    let buildContractsDir: string = pathInfo.buildContractsDir;
    // FIXME: Add a better test to see if we are a truffle project
    try {
        config = Config.detect(truffleOptions, pathInfo.rootDir);
        buildContractsDir = pathInfo.buildContractsDir;
    } catch (err) {
        // FIXME: Dummy up in config whatever we need to run compile.
        // FIXME: Pull in compiler from "compile".
        const buildDir = `${pathInfo.rootDir}/build`;
        const isBuildDirExists = await fsExists(buildDir);
        if (!isBuildDirExists) {
            await fsMkdir(buildDir);
        }

        const isbuildContractsDirExists = await fsExists(buildContractsDir);
        if (!isbuildContractsDirExists) {
            await fsMkdir(buildContractsDir);
        }
        config = {
            _: [],
            compilers: {
                solc: {
                    settings: {
                        evmVersion: 'byzantium',
                        optimizer: {
                            enabled: false,
                            runs: 200,
                        },
                    },
                },
            },
            contracts_build_directory: buildContractsDir,
            contracts_directory: pathInfo.rootDir,
        };
    }

    // This can cause vyper to fail if you don't have vyper installed
    delete config.compilers.vyper;

    // Get VSCode Solidity's solc information
    const vscode_solc = new SolcCompiler(vscode.workspace.rootPath);
    const remoteCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingRemoteVersion');
    const localCompiler = vscode.workspace.getConfiguration('solidity').get<string>('compileUsingLocalVersion');

    const initialized = await vscode_solc.intialiseCompiler(localCompiler, remoteCompiler);

    // Set truffle compiler version based on vscode solidity's version info
    config.compilers.solc.version = vscode_solc.getVersion();
    await contractsCompile(config);
    return await analyzeWithBuildDir({
        buildContractsDir,
        config,
        pathInfo,
        progress,
        solidityConfig,
    });
}
