
const { Worker } = require('worker_threads');

import * as vscode from 'vscode';
import * as path from 'path';

export async function formatDocument(document, context) : Promise<vscode.TextEdit[]> {
    const source = document.getText();
    const documentPath = document.uri.fsPath;
    const pluginPathFile = path.join(context.extensionPath, 'node_modules', 'prettier-plugin-solidity', 'dist','standalone.cjs');
    const prettierPathFile = path.join(context.extensionPath, 'node_modules', 'prettier');
    const pluginPath =  pluginPathFile ; 
    const prettierPath = prettierPathFile; 
    const options = {
        parser: 'solidity-parse',
        pluginSearchDirs: [context.extensionPath],
    };

    return new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'formatterPrettierWorker.js');
        let uri = vscode.Uri.file(workerPath).fsPath;
        const worker = new Worker(uri.toString());
        worker.on('message', (response) => {
            worker.terminate(); 
            if (response.success) {
                const firstLine = document.lineAt(0);
                const lastLine = document.lineAt(document.lineCount - 1);
                const fullTextRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
                resolve([vscode.TextEdit.replace(fullTextRange, response.formatted)]);
            } else {
                console.error(response.error);
                resolve([]);
            }
        });
        worker.on('error', (err) => {
            worker.terminate(); 
            console.error(err);
            resolve([]);
        });

        worker.postMessage({ source, options, documentPath, prettierPath, pluginPath });
    });
}

