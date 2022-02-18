import * as vscode from 'vscode';

export function getCurrentWorkspaceRootFsPath(){
    return getCurrentWorkspaceRootFolder().uri.fsPath;
}

export function getCurrentWorkspaceRootFolder(){
    var editor = vscode.window.activeTextEditor;
    const currentDocument = editor.document.uri;
    return vscode.workspace.getWorkspaceFolder(currentDocument);
}

export function getSolidityRemappings(): string[] {
    const remappings = vscode.workspace.getConfiguration('solidity').get<string[]>('remappings');
    if (process.platform === 'win32') {
            return remappings.concat(vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsWindows'));
    }
    return remappings.concat(vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsUnix'));
}
