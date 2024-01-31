import * as prettier from 'prettier';
import * as vscode from 'vscode';
import * as path from 'path';
import * as workspaceUtil from '../workspaceUtil';
import * as solidityprettier from 'prettier-plugin-solidity';

export async function formatDocument(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<vscode.TextEdit[]> {
    const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
    const ignoreOptions = { ignorePath: path.join(rootPath, '.prettierignore') };
    const fileInfo =  await prettier.getFileInfo(document.uri.fsPath, ignoreOptions);
    if (!fileInfo.ignored) {
      const source = document.getText();
    //  const pluginPath = path.join(context.extensionPath, 'node_modules', 'prettier-plugin-solidity');
      const options = {
        'parser': 'solidity-parse',
        'pluginSearchDirs': [context.extensionPath],
        'plugins': [solidityprettier],
      };
      //
      const config = await prettier.resolveConfig(document.uri.fsPath);
      if (config !== null) {
        await prettier.clearConfigCache();
      }
      Object.assign(options, config);
      const firstLine = document.lineAt(0);
      const lastLine = document.lineAt(document.lineCount - 1);
      const fullTextRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
      const formatted = await prettier.format(source, options);
      return [vscode.TextEdit.replace(fullTextRange, formatted)];
    }
}
