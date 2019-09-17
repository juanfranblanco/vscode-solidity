import { workspace, WorkspaceConfiguration, Uri, ConfigurationTarget } from 'vscode';

export const extensionPrefix = 'mythx';

export function getExtensionSetting<T>(key: string, fsPath?: string): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix, fsPath ? Uri.file(fsPath) : undefined);
    return projectConfiguration.get<T>(key);
}

export async function updateSetting<T = string>(section: string, value: T, prefix: string = extensionPrefix): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix);
    await projectConfiguration.update(section, value, ConfigurationTarget.Global);
}
