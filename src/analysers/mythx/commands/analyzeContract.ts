import * as vscode from 'vscode';
import { Client } from 'mythxjs';
import { getCredentials } from '../login/getCredentials';
import { errorCodeDiagnostic } from '../errorCodeDiagnostic';
import { AnalyzeOptions, Credentials } from '../utils/types';
import {  getFileContent } from '../utils/getFileContent';
import { getAstData } from '../utils/getAstData';
import { getContractName } from "../utils/getContractName";
import {compileActiveContract} from '../../../compileActive';

const { window } = vscode;

let mythx: Client;

const contractNameOption: vscode.InputBoxOptions = {
    ignoreFocusOut: true,
    placeHolder: 'Contract Name',
    prompt: 'Contract Name: ',
};

export async function analyzeContract(diagnosticCollection: vscode.DiagnosticCollection, fileUri: vscode.Uri): Promise<void> {
    let contractName;
    await compileActiveContract().then(async (compiledResults: string[]) => {
        if (!compiledResults) {
            throw new Error(`MythX error with compilation.`);
        }
        const credentials: Credentials = await getCredentials();
        mythx = new Client(credentials.ethAddress, credentials.password, 'mythXvsc');

        await mythx.login();

        const fileContent = await getFileContent(fileUri);

        const requestObj: AnalyzeOptions = await getAstData(contractName, fileContent);

        const analyzeRes = await mythx.analyze(
            requestObj,
        );

        const {uuid} = analyzeRes;

        // Get in progress bar
        await window.withProgress(
            {
                cancellable: true,
                location: vscode.ProgressLocation.Notification,
                title: `Analysing smart contract ${contractName}`,

            },
            (_) => new Promise(
                (resolve) => {
                    // Handle infinite queue
                    const timer = setInterval(async () => {
                        const analysis = await mythx.getAnalysisStatus(uuid);
                        if (analysis.status === 'Finished') {
                            clearInterval(timer);
                            resolve('done');
                        }
                    }, 10000);
                }));

        diagnosticCollection.clear();
        const analysisResult = await mythx.getDetectedIssues(uuid);

        const { issues } = analysisResult[0];

        // Some warning have messages but no SWCID (like free trial user warn)
        const filtered = issues.filter(
            issue => issue.swcID !== '',
        );
        if (!filtered) {
            vscode.window.showInformationMessage(`MythXvs: No security issues found in your contract.`);
        } else {
            vscode.window.showWarningMessage(`MythXvs: found ${filtered.length} security issues with contract.`);
        }

        // Diagnostic
        errorCodeDiagnostic(vscode.window.activeTextEditor.document, diagnosticCollection, analysisResult);

    }).catch(
        (err) => {
            vscode.window.showWarningMessage(`MythX error with compilation: ${err}`);
            throw new Error(`MythX error with compilation: ${err}`);
        },
    );

}
