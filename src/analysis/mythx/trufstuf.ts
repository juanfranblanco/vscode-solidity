// Truffle related code.
/* FIXME - use truffle libraries more */

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import * as util from 'util';

const readdir = util.promisify(fs.readdir);


// Directories that must be in a truffle project

const TRUFFLE_ROOT_DIRS = ['contracts', 'migrations'];

export function isTruffleRoot (p: string): boolean {
    for (const shortDir of TRUFFLE_ROOT_DIRS) {
        const dir = `${p}/${shortDir}`;
        if (!fs.existsSync(dir)) {
            return false;
        }
        const stat = fs.statSync(dir);
        if (!stat || !stat.isDirectory()) {
            return false;
        }
    }
    return true;
}

// Return dirname of path p, unless we think this
// part of a truffle project, in which case we'll
// it is in a "contracts" directory and then the
// we return the parent directory which is the
// root of the truffle project.
export function getRootDir (p: string): string {
    const dirname = path.resolve(path.dirname(p));
    if (path.basename(dirname) === 'contracts') {
        const parent = path.normalize(`${dirname}/..`);
        if (isTruffleRoot(parent)) {
            return parent;
        }
    }
    return dirname;
}

/**
 * Scans Truffle smart contracts build directory and returns
 * array of paths to smart contract build JSON files.
 *
 * @param {string} directory - path to truffle smart contracts build directory. {
 * @returns {Array<string>} - list of JSON files.
 */
export const getTruffleBuildJsonFilesAsync = async function(directory: string) {
    const files = await readdir(directory);
    const filteredFiles = files.filter(f => f !== 'Migrations.json');
    const filePaths = filteredFiles.map(f => path.join(directory, f));
    return filePaths;
};

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
