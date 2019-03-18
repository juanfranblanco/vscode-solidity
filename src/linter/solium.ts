'use strict';
import * as Solium from 'solium';
import { DiagnosticSeverity, IConnection,
} from 'vscode-languageserver';
import Linter from './linter';
import * as fs from 'fs';

export const defaultSoliumRules = {
};

export default class SoliumService implements Linter {

    public static readonly EMPTY_CONFIG = {rules: {}};

    private fileConfig: any;
    private soliumRules;
    private vsConnection: IConnection;

    constructor(rootPath: string, soliumRules: any, vsConnection: IConnection) {
      this.vsConnection = vsConnection;
      this.loadFileConfig(rootPath);
      this.setIdeRules(soliumRules);
    }

    public setIdeRules(soliumRules: any) {
        if (typeof soliumRules === 'undefined' || soliumRules === null) {
            this.soliumRules = defaultSoliumRules;
        } else {
            this.soliumRules = soliumRules;
        }

        if (typeof this.soliumRules['indentation'] === 'undefined' ||  this.soliumRules['indentation'] === null) {
            this.soliumRules['indentation'] = 'false';
        }

        if (process.platform === 'win32') {
            if (typeof  this.soliumRules['linebreak-style'] === 'undefined' ||  this.soliumRules['linebreak-style'] === null) {
                this.soliumRules['linebreak-style'] = 'off';
            }
        }
    }

    public lintAndFix(documentText) {
        return Solium.lintAndFix(documentText, this.getAllSettings());
    }

    public getAllSettings() {
        if (this.fileConfig !== SoliumService.EMPTY_CONFIG && this.fileConfig !== false) {
            return this.fileConfig;
        }
        return {
            'extends': 'solium:recommended',
            'options': { 'returnInternalIssues': true },
            'plugins': ['security'],
            'rules': this.soliumRules,
        };
    }

    public validate(filePath, documentText) {
        let items = [];
        try {
            items = Solium.lint(documentText, this.getAllSettings());
        } catch (err) {
            const match = /An error .*?\nSyntaxError: (.*?) Line: (\d+), Column: (\d+)/.exec(err.message);

            if (match) {
                const line = parseInt(match[2], 10) - 1;
                const character = parseInt(match[3], 10) - 1;

                return [
                    {
                        message: `Syntax error: ${match[1]}`,
                        range: {
                            end: {
                                character: character,
                                line: line,
                            },
                            start: {
                                character: character,
                                line: line,
                            },
                        },
                        severity: DiagnosticSeverity.Error,
                    },
                ];
            } else {
                // this.vsConnection.window.showErrorMessage('solium error: ' + err);
                this.vsConnection.console.error('solium error: ' + err);
            }
        }
        return items.map(this.soliumLintResultToDiagnostic);
    }

    public soliumLintResultToDiagnostic(lintResult) {
        const severity = lintResult.type === 'warning' ?
            DiagnosticSeverity.Warning :
            DiagnosticSeverity.Error;

        const line = lintResult.line - 1;

        return {
            message: `${lintResult.ruleName}: ${lintResult.message}`,
            range: {
                end: {
                    character: lintResult.node.end,
                    line: line,
                },
                start: {
                    character: lintResult.column,
                    line: line,
                },
            },
            severity: severity,
        };
    }

    private loadFileConfig(rootPath: string) {
        const filePath = `${rootPath}/.soliumrc.json`;
        const readConfig = this.readFileConfig.bind(this, filePath);

        readConfig();
        fs.watchFile(filePath, {persistent: false}, readConfig);
    }

    private readFileConfig(filePath: string) {
        this.fileConfig = SoliumService.EMPTY_CONFIG;
        fs.readFile(filePath, 'utf-8', this.onConfigLoaded.bind(this));
    }

    private onConfigLoaded(err: any, data: string) {
        this.fileConfig = (!err) && JSON.parse(data);
    }
}
