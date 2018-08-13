import * as linter from 'solhint/lib/index';
import Linter from './linter';
import * as fs from 'fs';
import * as vscode from 'vscode-languageserver';

export default class SolhintService implements Linter {
    private config: ValidationConfig;

    constructor(rootPath: string, rules: any) {
        this.config = new ValidationConfig(rootPath, rules);
    }

    public setIdeRules(rules: any) {
        this.config.setIdeRules(rules);
    }

    public validate(filePath: string, documentText: string): vscode.Diagnostic[] {
        return linter
            .processStr(documentText, this.config.build())
            .messages
            .map(e => this.toDiagnostic(e));
    }

    private toDiagnostic(error) {
        return {
            message: `${error.message} [${error.ruleId}]`,
            range: this.rangeOf(error),
            severity: this.severity(error),
        };
    }

    private severity(error: any): vscode.DiagnosticSeverity {
        return (error.severity === 3) ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
    }

    private rangeOf(error: any): vscode.Range {
        const line = error.line - 1;
        const character = error.column - 1;

        return {
            start: { line, character },
            // tslint:disable-next-line:object-literal-sort-keys
            end: { line, character: character + 1 },
        };
    }
}


class ValidationConfig {
    public static readonly DEFAULT_RULES = {'func-visibility': false};
    public static readonly EMPTY_CONFIG = {rules: {}};

    private ideRules: any;
    private fileConfig: any;

    constructor(rootPath: string, ideRules: any) {
        this.setIdeRules(ideRules);
        this.loadFileConfig(rootPath);
    }

    public setIdeRules(rules: any) {
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

    private loadFileConfig(rootPath: string) {
        const filePath = `${rootPath}/.solhint.json`;
        const readConfig = this.readFileConfig.bind(this, filePath);

        readConfig();
        fs.watchFile(filePath, {persistent: false}, readConfig);
    }

    private readFileConfig(filePath: string) {
        this.fileConfig = ValidationConfig.EMPTY_CONFIG;
        fs.readFile(filePath, 'utf-8', this.onConfigLoaded.bind(this));
    }

    private onConfigLoaded(err: any, data: string) {
        this.fileConfig = (!err) && JSON.parse(data);
    }
}
