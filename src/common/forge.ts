export type TestResults = {
    contracts: ContractTestResults[];
}

export type ContractTestResults = {
    file: string;
    contract: string;
    results: TestResult[];
}

export type TestResult = TestResultPass | TestResultFailure;

export type TestResultPass = {
    name: string;
    pass: true;
    logs: string[];
}

export type TestResultFailure = {
    name: string;
    pass: false;
    reason: string;
    logs: string[];
}

type forgeTestResult = {
    success: boolean,
    reason?: string,
    counterexample?: null,
}

export const parseForgeTestResults = (data: string): TestResults | null => {
    try {
        const parsed = JSON.parse(data);
        const results = Object.entries(parsed).map(([key, rest]: [string, any]) => {
            const [file, contract] = key.split(":");
            const results = Object.entries(rest.test_results).map(([name, res]: [string, forgeTestResult]) => {
                return {
                    name,
                    pass: res.success,
                    reason: res.reason,
                    logs: [],
                }
            })
            const out: ContractTestResults = {
                file,
                contract,
                results,
            }
            return out;
        })
        return {
            contracts: results,
        }
    } catch (err) {
        return null;
    }
}