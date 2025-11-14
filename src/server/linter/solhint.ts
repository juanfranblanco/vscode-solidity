import * as fs from 'fs';
import * as path from 'path';

import * as linter_ from 'solhint';
import { Diagnostic, Range, DiagnosticSeverity as Severity } from 'vscode-languageserver';

import Linter from './linter';

export default class SolhintService implements Linter {
    private rootPath: string;
    private linter: any;

    constructor(rootPath: string, packageDirectory: string) {
        this.rootPath = rootPath;
        this.linter = packageDirectory ? require(path.join(rootPath, packageDirectory)) : linter_;
    }

    public loadFileConfig(rootPath: string) {
      // No-op: configuration is handled by solhint processFile
    }

    public setIdeRules(rules: any) {
      // No-op: IDE rules are not supported anymore
    }

    public validate(filePath: string, documentText: string): Diagnostic[] {
        const result = this.rootPath
          ? this.linter.processFile(filePath, undefined, this.rootPath)
          : this.linter.processFile(filePath);
        return (result.messages || []).map((e) => this.toDiagnostic(e));
    }

    private toDiagnostic(error) {
        return {
            message: `Linter: ${error.message} [${error.ruleId}]`,
            range: this.rangeOf(error),
            severity: this.severity(error),
        };
    }

    private severity(error: any): Severity {
        return (error.severity === 3) ? Severity.Warning : Severity.Error;
    }

    private rangeOf(error: any): Range {
        const line = error.line - 1;
        const character = error.column - 1;

        return {
            start: { line, character },
            // tslint:disable-next-line:object-literal-sort-keys
            end: { line, character: character + 1 },
        };
    }
}
