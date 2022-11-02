import { workspace } from "vscode";
import { DevelopmentEnvironment } from "./env";
import { parseForgeTestResults } from "./forge";

export type TestResults = {
    contracts: ContractTestResults[];
};

export type ContractTestResults = {
    file: string;
    contract: string;
    results: TestResult[];
};

export type TestResult = TestResultPass | TestResultFailure;

export type TestResultPass = {
    name: string;
    pass: true;
    logs: string[];
};

export type TestResultFailure = {
    name: string;
    pass: false;
    reason: string;
    logs: string[];
};

export const testResultIsFailure = (r: TestResult): r is TestResultFailure => {
    return !r.pass;
};

/**
 * parseTestResults parses raw test result data into a format which can be interpreted
 * by the extension.
 * It currently only supports output from 'forge'.
 * @param data Raw data from test command
 * @returns TestResults, or null if unable to interpret the data
 */
export const parseTestResults = (data: string): TestResults | null => {
    const devEnv = workspace.getConfiguration('solidity').get<DevelopmentEnvironment>('developmentEnvironment');
    if (devEnv === DevelopmentEnvironment.Forge) {
        return parseForgeTestResults(data);
    }
    return null
}

/**
 * Construct output to be printed which summarizes test results.
 * @param results Parsed test results
 * @returns Array of lines which produce a test run summary.
 */
export const constructTestResultOutput = (results: TestResults): string[] =>  {
    const lines = [];

    const withFailures = results.contracts.filter(c => {
        return c.results.filter(r => !r.pass).length > 0;
    });
    const hasFailures = withFailures.length > 0;

    if (hasFailures) {
        lines.push('Tests FAILED');
        lines.push('------------');
    }
    results.contracts.forEach((c) => {
        lines.push(`${c.contract} in ${c.file}:`);

        const passes = c.results.filter(f => f.pass);
        const failures = c.results.filter(f => !f.pass) as TestResultFailure[];

        passes.forEach(r => {
            lines.push(`\tPASS ${r.name}`);
        });

        failures.forEach((r) => {
            lines.push(`\tFAIL ${r.name}`);
            if (r.reason) {
                lines.push(`\t REVERTED with reason: ${r.reason}`);
            }

            r.logs.forEach((log) => {
                lines.push(`\t\t ${log}`);
            });
        });
        // Add some spacing between contract results
        lines.push('');
    });

    if (!hasFailures) {
        lines.push('All tests passed.');
        return lines;
    }

    lines.push('\nSummary:');
    withFailures.forEach(f => {
        const numFailures = f.results.filter(r => !r.pass).length;
        lines.push(`\t${numFailures} failure(s) in ${f.contract} (${f.file})`);
    });
    return lines;
};