import * as vscode from 'vscode';
import { replaceRemappings } from '../common/util';
import { findFirstRootProjectFile } from '../common/projectService';


export function getCurrentProjectInWorkspaceRootFsPath() {
    const monoreposupport = vscode.workspace.getConfiguration('solidity').get<boolean>('monoRepoSupport');
    const currentRootPath = getCurrentWorkspaceRootFsPath();
    if ( monoreposupport ) {
        const editor = vscode.window.activeTextEditor;
        const currentDocument = editor.document.uri;
        const projectFolder = findFirstRootProjectFile(currentRootPath, currentDocument.fsPath);
        if (projectFolder == null) {
            return currentRootPath;
        } else {
            return projectFolder;
        }
    } else {
        return currentRootPath;
    }

}

export function getCurrentWorkspaceRootFsPath() {
    return getCurrentWorkspaceRootFolder().uri.fsPath;
}

export function getCurrentWorkspaceRootFolder() {
    const editor = vscode.window.activeTextEditor;
    const currentDocument = editor.document.uri;
    return vscode.workspace.getWorkspaceFolder(currentDocument);

}

export function getSolidityRemappings(): string[] {
    const remappings = vscode.workspace.getConfiguration('solidity').get<string[]>('remappings');
    if (process.platform === 'win32') {
        return replaceRemappings(remappings, vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsWindows'));
    } else {
        return replaceRemappings(remappings, vscode.workspace.getConfiguration('solidity').get<string[]>('remappingsUnix'));
    }
}
