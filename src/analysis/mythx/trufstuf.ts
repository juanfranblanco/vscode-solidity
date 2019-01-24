// Truffle related code.
/* FIXME - use truffle libraries more */

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

export function getBuildContractsDir(p: string): string {
    return `${p}/build/contracts`;
}

export function getContractsDir(p: string) {
    return `${p}/contracts`;
}

export function getMythReportsDir(buildContractsDir: string) {
    return path.normalize(path.join(buildContractsDir, '..', 'mythx'));
}

export function getTruffleBuildJsonFiles(directory: string): Array<string> {
    const files = fs.readdirSync(directory);
    const filteredFiles = files.filter(f => f !== 'Migrations.json');
    const filePaths = filteredFiles.map(f => path.join(directory, f));
    return filePaths;
}

export function guessTruffleBuildJson(directory: string): string {
    const jsonPaths = exports.getTruffleBuildJsonFiles(directory);
    if (!jsonPaths || jsonPaths.length < 1) {
        throw new Error('Build contracts folder is empty, no smart contracts to analyze.');
    }
    const jsonPathsFiltered = [];
    for (const p of jsonPaths) {
        if ((path.basename(p) !== 'Migrations.json') &&
            (path.basename(p) !== 'mythx.json')) {
            jsonPathsFiltered.push(p);
        }
    }
    let jsonPath: string;
    if (jsonPathsFiltered.length >= 1) {
        jsonPath = jsonPathsFiltered[0];
    } else {
        jsonPath = jsonPaths[0];
    }
    return jsonPath;
}
/**
 * Extracts path to solidity file from smart contract build object
 * found in json files in truffle build directories.
 *
 * Build objects have property "sourcePath".
 * For simplicity and readabilty build object is destructured and
 * "sourcePath" property extracted to output directly.
 *
 * @param {Object} param - Smart contract build object,
 * @returns {String} - Absolute path to solidity file.
 */
export const getSolidityFileFromJson = ({ sourcePath }) => sourcePath;
