import * as fs from 'fs';

import * as linter from 'solhint/lib/index';
import { Diagnostic, Range, DiagnosticSeverity as Severity } from 'vscode-languageserver';

import Linter from './linter';

export default class SolhintService implements Linter {
    private config: ValidationConfig;

    constructor(rootPath: string, rules: any) {
        this.config = new ValidationConfig(rootPath, rules);
    }

    public loadFileConfig(rootPath: string) {
        this.config.loadFileConfig(rootPath);
    }

    public setIdeRules(rules: any) {
        this.config.setIdeRules(rules);
    }

    public validate(filePath: string, documentText: string): Diagnostic[] {
        return linter
            .processStr(documentText, this.config.build())
            .messages
            .map(e => this.toDiagnostic(e));
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


class ValidationConfig {
    public static readonly DEFAULT_RULES = {'func-visibility': false};
    public static readonly EMPTY_CONFIG = {rules: {}};

    private ideRules: any;
    private fileConfig: any;
    private currentWatchFile: string;

    constructor(rootPath: string, ideRules: any) {
        this.setIdeRules(ideRules);
        this.loadFileConfig(rootPath);
    }

    public setIdeRules(rules: any) {
        this.ideRules = rules || {};
    }

    public build() {
        let extendsConfig = ['solhint:recommended'];
        if (this.fileConfig.extends !== 'undefined' && this.fileConfig.extends !== null) {
            extendsConfig = this.fileConfig.extends;
        }

        return {
            extends: extendsConfig,
            // plugins: ["prettier"], // removed plugins as it crashes the extension until this is fully supported path etc loading in solhint
            rules: Object.assign(
                ValidationConfig.DEFAULT_RULES,
                this.ideRules,
                this.fileConfig.rules,
            ),
        };
    }

    public isRootPathSet(rootPath: string): boolean {
        return typeof rootPath !== 'undefined' && rootPath !== null;
    }

    public loadFileConfig(rootPath: string) {

        if (this.isRootPathSet(rootPath)) {
            const filePath = `${rootPath}/.solhint.json`;
            const readConfig = this.readFileConfig.bind(this, filePath);

            readConfig();
            this.currentWatchFile = filePath;
            // fs.watchFile(filePath, {persistent: false}, readConfig);
        } else {
            this.fileConfig = ValidationConfig.EMPTY_CONFIG;
        }
    }

    private readFileConfig(filePath: string) {
        this.fileConfig = ValidationConfig.EMPTY_CONFIG;
        if (fs.existsSync(filePath)) {
            this.fileConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    }

}
