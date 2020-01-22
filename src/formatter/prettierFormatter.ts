import * as prettier from 'prettier';
import * as vscode from 'vscode';
import * as path from 'path';
export function formatDocument(document: vscode.TextDocument, context: vscode.ExtensionContext): vscode.TextEdit[] {
    const source = document.getText();
    const pluginPath = path.join(context.extensionPath, 'node_modules', 'prettier-plugin-solidity');
    const options = {
      'parser' : 'solidity-parse',
      'pluginSearchDirs': [context.extensionPath],
      'plugins': [pluginPath],
    };
    const config = prettier.resolveConfig.sync(document.uri.fsPath, options);
    Object.assign(options, config);
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const fullTextRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
    const formatted = prettier.format(source, options);
    return [vscode.TextEdit.replace(fullTextRange, formatted)];
}
