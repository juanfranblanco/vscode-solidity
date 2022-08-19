import * as vscode from 'vscode';
import * as cp from 'child_process';

export async function formatDocument(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<vscode.TextEdit[]> {
  const firstLine = document.lineAt(0);
  const lastLine = document.lineAt(document.lineCount - 1);
  const fullTextRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

  const p = cp.execFile('forge', ['fmt', '--check', '--raw', document.uri.fsPath]);

  let formatted = '';
  for await (const chunk of p.stdout) {
    formatted += chunk;
  }

  return [vscode.TextEdit.replace(fullTextRange, formatted)];
}
