'use strict';

import * as vscode from 'vscode';
import { ApiVersion } from 'armlet';

export function mythrilVersion() {
    const outputChannel = vscode.window.createOutputChannel('Mythril');
    outputChannel.clear();
    outputChannel.show();
    ApiVersion().then(
    result => {
        const mess = JSON.stringify(result, null, 4);
        vscode.window.showInformationMessage(mess);
        outputChannel.appendLine(mess);
    });
}
