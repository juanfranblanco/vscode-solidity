import { ExtensionContext, OutputChannel } from 'vscode';

export namespace ext {
    export let context: ExtensionContext;
    export let outputChannel: OutputChannel;
}
