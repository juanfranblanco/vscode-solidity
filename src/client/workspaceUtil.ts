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
    const editor = vscode.window.activeTextEditor;
    const currentDocument = editor.document.fileName;
    return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(currentDocument));

}

export function getSolidityRemappings(): string[] {
    const remappings = SettingsService.getRemappings();
    if (process.platform === 'win32') {
        return replaceRemappings(remappings, SettingsService.getRemappingsWindows());
    } else {
        return replaceRemappings(remappings, SettingsService.getRemappingsUnix());
    }
}
