import * as vscode from 'vscode';
import { replaceRemappings } from '../common/util';
import { findFirstRootProjectFile } from '../common/projectService';
import { SettingsService } from './settingsService';


export function getCurrentProjectInWorkspaceRootFsPath() {
    const monoreposupport = SettingsService.getMonoRepoSupport();
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
    return getCurrentWorkspaceRootFolder()?.uri?.fsPath;
}

export function getCurrentWorkspaceRootFolder() {

    //  Try active editor
    const activeUri = vscode.window.activeTextEditor?.document?.uri;
    if (activeUri) {
        const folder = vscode.workspace.getWorkspaceFolder(activeUri);
        if (folder) { return folder; }
    }

    // Try first visible editor
    const visibleUri = vscode.window.visibleTextEditors[0]?.document?.uri;
    if (visibleUri) {
        const folder = vscode.workspace.getWorkspaceFolder(visibleUri);
        if (folder) { return folder; }
    }

    // Try workspace folders
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0];
    }
    return undefined;
}

export function getSolidityRemappings(): string[] {
    const remappings = SettingsService.getRemappings();
    if (process.platform === 'win32') {
        return replaceRemappings(remappings, SettingsService.getRemappingsWindows());
    } else {
        return replaceRemappings(remappings, SettingsService.getRemappingsUnix());
    }
}
