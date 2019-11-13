import * as vscode from "vscode";


export async function getFileContent(fileUri: vscode.Uri): Promise<string> {
    const documentObj = await vscode.workspace.openTextDocument(fileUri.fsPath)
    const fileContent = documentObj.getText();

    return fileContent
}