import * as vscode from 'vscode';

export async function getFileContent(): Promise<string> {
    const currentlyOpenTabfilePath = vscode.window.activeTextEditor.document.fileName;

    const documentObj = await vscode.workspace.openTextDocument(currentlyOpenTabfilePath);
    const content = documentObj.getText();
    return content;
}
