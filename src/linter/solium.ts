import * as Solium from 'solium';
import { DiagnosticSeverity, Diagnostic, IConnection,
} from 'vscode-languageserver';
import Linter from './linter';


export const defaultSoliumRules = {
    'array-declarations': true,
    'blank-lines': false,
    'camelcase': true,
    'deprecated-suicide': true,
    'double-quotes': true,
    'imports-on-top': true,
    'indentation': false,
    'lbrace': true,
    'mixedcase': true,
    'no-empty-blocks': true,
    'no-unused-vars': true,
    'no-with': true,
    'operator-whitespace': true,
    'pragma-on-top': true,
    'uppercase': true,
    'variable-declarations': true,
    'whitespace': true,
};

export default class SoliumService implements Linter {

    private soliumRules;
    private vsConnection: IConnection;

    constructor(soliumRules: any, vsConnection: IConnection) {
      this.setIdeRules(soliumRules);
    }

    public setIdeRules(soliumRules: any) {
        if (typeof soliumRules === 'undefined' || soliumRules === null) {
            this.soliumRules = defaultSoliumRules;
        } else {
            this.soliumRules = soliumRules;
        }
    }

    public validate(filePath, documentText) {
        let items = [];
        try {
            items = Solium.lint(documentText, {
                rules: this.soliumRules,
            });
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
