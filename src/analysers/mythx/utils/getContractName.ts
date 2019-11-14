import * as vscode from 'vscode';
const os = require('os');
const path = require('path');

export async function getContractName(fileUri: vscode.Uri): Promise<string>  {
    try {
        let outputAST;
        let contractName;
        let fixedPath = fileUri.fsPath;
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

        const contract = compiled.contracts[fixedPath]
        const contractsNames = Object.keys(contract);
        await vscode.window.showQuickPick(contractsNames, {
            canPickMany: false,
            placeHolder: 'Contract Name (please select main contract):'
        }).then(
            value => {
                if (value === undefined) {
                    throw new Error('Contract Name cancelled. Please re-run analysis.');
                }
                contractName = value;
            },
        );
        return contractName;

    } catch (err) {
        vscode.window.showWarningMessage(`Mythx error with getting your contract name. ${err}`);
        throw new Error(`Mythx error with getting your contract name. ${err}`);
    }
}
