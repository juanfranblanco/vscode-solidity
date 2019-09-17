// BUSINESS OBJECTS

export interface JwtTokensInterface {
    access: string;
    refresh: string;
}

// tslint:disable-next-line:class-name
export interface loginResponse {
    jwtTokens: JwtTokensInterface;
    access: string;
    refresh: string;
}

export interface AnalyzeOptions {
    toolName?: string;
    contractName?: string;
    bytecode?: string;
    sourceMap?: string;
    deployedBytecode?: string;
    deployedSourceMap?: string;
    mainSource?: string;
    sources?: any;
    sourceList?: Array<string>;
    solcVersion?: string;
    analysisMode?: string;
}

export interface SubmitContractRes {
    apiVersion: string;
    harveyVersion: string;
    maestroVersion: string;
    maruVersion: string;
    mythrilVersion: string;
    queueTime: number;
    runTime: number;
    status: string;
    submittedAt: string;
    submittedBy: string;
    uuid: string;
}
// tslint:disable-next-line:class-name
export interface descriptionObj {
    head: string;
    tail: string;
    // Make below a mapping of severity warnings
    severity: string;
}
// tslint:disable-next-line:class-name
export interface decodedLocationsObj {
    line: number;
    column: number;
}
// tslint:disable-next-line:class-name
export interface issueObj {
    swcID: string;
    swcTitle: string;
    description: descriptionObj;
    severity: 'Low';
    locations: Array<any>;
    extra: any;
    decodedLocations?: Array<Array<decodedLocationsObj>>;
}

export interface Bytecode {
    linkReferences: any;
    object: string;
    opcodes: string;
    sourceMap: string;
}

export interface Credentials {
    ethAddress: string;
    password: string;
}
