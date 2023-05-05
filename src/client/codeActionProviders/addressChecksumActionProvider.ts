
import * as vscode from 'vscode';

export class AddressChecksumCodeActionProvider implements vscode.CodeActionProvider {


        public static readonly providedCodeActionKinds = [
            vscode.CodeActionKind.QuickFix,
        ];
        public static ADDRESS_CHECKSUM_ERRORCODE = '9429';

        private static regex = /Correct checksummed address: "0x(?<address>[0-9a-fA-F]*)"/gm;


        public static createFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
            const match = this.regex.exec(diagnostic.message);
            if (match) {
                if (match.groups['address']) {
                    const fixedAddress = match.groups['address'];
                    const fix = new vscode.CodeAction(`Convert address to checksummed address: 0x${fixedAddress}`, vscode.CodeActionKind.QuickFix);

                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, new vscode.Range(diagnostic.range.start, diagnostic.range.start.translate(0, fixedAddress.length + 2)), '0x' + fixedAddress);
                    fix.isPreferred = true;
                    return fix;
                }
            }
            return null;
        }

        // tslint:disable-next-line:max-line-length
        public provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
            // for each diagnostic entry that has the matching `code`, create a code action command
            return context.diagnostics
                .filter(diagnostic => diagnostic.code === AddressChecksumCodeActionProvider.ADDRESS_CHECKSUM_ERRORCODE)
                .map(diagnostic => AddressChecksumCodeActionProvider.createFix(document, diagnostic));
        }


    }
