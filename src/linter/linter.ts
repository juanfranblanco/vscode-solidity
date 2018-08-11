import { Diagnostic } from 'vscode-languageserver/lib/main';

export default interface Linter {
    setIdeRules(rules: any): void;
    validate(filePath: string, documentText: string): Diagnostic[];
}
