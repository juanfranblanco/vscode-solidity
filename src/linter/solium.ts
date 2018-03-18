import * as Solium from 'solium';
import { DiagnosticSeverity, Diagnostic, IConnection,
} from 'vscode-languageserver';
import Linter from './linter';

export const defaultSoliumRules = {
};

export default class SoliumService implements Linter {

    private soliumRules;
    private vsConnection: IConnection;

    constructor(soliumRules: any, vsConnection: IConnection) {
      this.vsConnection = vsConnection;
      this.setIdeRules(soliumRules);
    }

    public setIdeRules(soliumRules: any) {
        if (typeof soliumRules === 'undefined' || soliumRules === null) {
            this.soliumRules = defaultSoliumRules;
        } else {
            this.soliumRules = soliumRules;
        }
    }

    public lintAndFix(documentText) {
        return Solium.lintAndFix(documentText, this.getAllSettings());
    }

    public getAllSettings() {
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
            let match = /An error .*?\nSyntaxError: (.*?) Line: (\d+), Column: (\d+)/.exec(err.message);

            if (match) {
                let line = parseInt(match[2], 10) - 1;
                let character = parseInt(match[3], 10) - 1;

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
                this.vsConnection.window.showErrorMessage('solium error: ' + err);
                console.error('solium error: ' + err);
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
}
