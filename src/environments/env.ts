export enum DevelopmentEnvironment {
    Forge = 'forge',
    Hardhat = 'hardhat',
    None = 'none',
    NotSet = '',
}

type ConfigDefaultAndTargetValue = {
    default: any;
    target: any;
};

export const defaultEnvironmentConfiguration: Partial<Record<DevelopmentEnvironment, Record<string, ConfigDefaultAndTargetValue>>> = {
    [DevelopmentEnvironment.Forge]: {
        'test.command': {
            default: '',
            target: 'forge test --silent --json',
        },
    },
};

