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

type forgeTestResult = {
    success: boolean,
    reason?: string,
    counterexample?: null,
    decoded_logs: string[],
};

export const parseForgeTestResults = (data: string): TestResults | null => {
    try {
        const parsed = JSON.parse(data);
        const contractResults = Object.entries(parsed).map(([key, rest]: [string, any]) => {
            const [file, contract] = key.split(':');
            const results = Object.entries(rest.test_results).map(([name, res]: [string, forgeTestResult]) => {
                return {
                    name,
                    pass: res.success,
                    reason: res.reason,
                    logs: res.decoded_logs,
                };
            });
            const out: ContractTestResults = {
                file,
                contract,
                results,
            };
            return out;
        });
        return {
            contracts: contractResults,
        };
    } catch (err) {
        return null;
    }
};

export const testResultIsFailure = (r: TestResult): r is TestResultFailure => {
    return !r.pass;
};

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
