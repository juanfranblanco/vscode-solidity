import * as linter from 'solhint/lib/index';
import { DiagnosticSeverity, Diagnostic, IConnection,
} from 'vscode-languageserver';


export class SolhintService {

    private solhintRules;
    private vsConnection: IConnection;

    constructor(solhintRules: any, vsConnection: IConnection) {
        this.InitSolhintRules(solhintRules);
    }

    public InitSolhintRules(rules: any) {
        if (typeof rules === 'undefined' || rules === null) {
            this.solhintRules = {};
        } else {
            this.solhintRules = rules;
        }
    }

    public validate(filePath, documentText) {
        let report = linter.processStr(documentText, {
            rules: this.solhintRules
        });

        return report.messages.map(this.solhintLintResultToDiagnostic);
    }

    public solhintLintResultToDiagnostic(lintResult) {
        const severity = lintResult.severity === 3 ?
            DiagnosticSeverity.Warning :
            DiagnosticSeverity.Error;

        const line = lintResult.line;

        return {
            message: `${lintResult.message} [${lintResult.ruleId}]`,
            range: {
                end: {
                    character: lintResult.column,
                    line: line - 1,
                },
                start: {
                    character: lintResult.column - 1,
                    line: line - 1,
                },
            },
            severity: severity,
        };
    }
}
