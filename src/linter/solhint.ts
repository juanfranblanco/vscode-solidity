import * as linter from 'solhint/lib/index';
import { DiagnosticSeverity as Severity, Diagnostic, Range } from 'vscode-languageserver/lib/main';
import Linter from './linter';
import { watchFile, readFile } from 'fs';
import { IDiagnostic } from '../model/idiagnostic';

export default class SolhintService implements Linter {
    private config: ValidationConfig;

    constructor(rootPath: string, rules: any) {
        this.config = new ValidationConfig(rootPath, rules);
    }

    public setIdeRules(rules: any): void {
        this.config.setIdeRules(rules);
    }

    public validate(documentText: string): Diagnostic[] {
        return linter
            .processStr(documentText, this.config.build())
            .messages
            .map(e => this.toDiagnostic(e));
    }

    private toDiagnostic(error): IDiagnostic {
        return {
            message: `${error.message} [${error.ruleId}]`,
            range: this.rangeOf(error),
            severity: this.severity(error),
        } as IDiagnostic;
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
        } as Range;
    }
}

class ValidationConfig {
    public static readonly DEFAULT_RULES = { 'func-visibility': false };
    public static readonly EMPTY_CONFIG = { rules: {} };

    private ideRules: any;
    private fileConfig: any;

    constructor(rootPath: string, ideRules: any) {
        this.setIdeRules(ideRules);
        this.loadFileConfig(rootPath);
    }

    public setIdeRules(rules: any): void {
        this.ideRules = rules || {};
    }

    public build() {
        return {
            rules: Object.assign(
                ValidationConfig.DEFAULT_RULES,
                this.ideRules,
                this.fileConfig.rules,
            ),
        };
    }

    private loadFileConfig(rootPath: string): void {
        const filePath = `${rootPath}/.solhint.json`;
        const readConfig = this.readFileConfig.bind(this, filePath);

        readConfig();
        watchFile(filePath, { persistent: false }, readConfig);
    }

    private readFileConfig(filePath: string): void {
        this.fileConfig = ValidationConfig.EMPTY_CONFIG;
        readFile(filePath, 'utf-8', this.onConfigLoaded.bind(this));
    }

    private onConfigLoaded(err: any, data: string): void {
        this.fileConfig = (!err) && JSON.parse(data);
    }
}
