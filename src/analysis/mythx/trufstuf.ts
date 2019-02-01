// Truffle related code.
/* FIXME - use truffle libraries more */

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

const readdir = util.promisify(fs.readdir);
const fsStat = util.promisify(fs.stat);


// Directories that must be in a truffle project

const TRUFFLE_ROOT_DIRS = ['contracts', 'migrations'];


// FIXME: remove this after tests are covered and async  is used
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

// FIXME: remove this after tests are covered and async  is used
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

export const isTruffleRootAsync = async (p: string): Promise<boolean> => {
    const all = await Promise.all(TRUFFLE_ROOT_DIRS.map(async (shortDir) => {
        try {
            const dir = await fsStat(`${p}/${shortDir}`);
            return dir.isDirectory();
        } catch (err) {
            return false;
        }
    }));
    const notTruffleDirs = all.filter(x => x === false);
    return notTruffleDirs.length === 0;
};

export const getRootDirAsync = async (p: string): Promise<string> => {
    const dirname = path.resolve(path.dirname(p));
    if (path.basename(dirname) === 'contracts') {
        const parent = path.normalize(`${dirname}/..`);
        const isRoot = await isTruffleRootAsync(parent);
        if (isRoot) {
            return parent;
        }
    }
    return dirname;
};

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
