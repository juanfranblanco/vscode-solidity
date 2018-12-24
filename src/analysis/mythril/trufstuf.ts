// Truffle related code.
/* FIXME - use truffle libraries more */

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

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

export function getBuildContractsDir(p: string): string {
    return `${p}/build/contracts`;
}

export function getContractsDir(p: string) {
    return `${p}/contracts`;
}

export function getMythReportsDir(buildContractsDir: string) {
    return path.normalize(path.join(buildContractsDir, '..', 'mythril'));
}

export function getTruffleBuildJsonFiles(directory): any {
    const files = fs.readdirSync(directory);
    const result = [];
    for (const file of files) {
        if (path.extname(file) === '.json' && path.basename(file)[0] !== '.') {
            result.push(file);
        }
    }
    return result;
}

export function guessTruffleBuildJson(directory: string): string {
    const jsonPaths = exports.getTruffleBuildJsonFiles(directory);
    const jsonPathsFiltered = [];
    for (const p of jsonPaths) {
        if ((path.basename(p) !== 'Migrations.json') &&
            (path.basename(p) !== 'mythril.json')) {
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
