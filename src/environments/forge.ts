import { ContractTestResults, TestResults } from "./tests";

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
