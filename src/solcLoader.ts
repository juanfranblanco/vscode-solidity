'use strict';

import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';

export function getLocalSolcInstallation(rootPath: string) {
    return path.join(rootPath, 'node_modules', 'solc', 'soljson.js');
}

export function isInstalledSolcLocally(rootPath: string) {
    return fs.existsSync(getLocalSolcInstallation(rootPath));
}

export function initialiseLocalSolc(compileUsingLocalVersion: string, rootPath: string) {
    let solidityfile = '';
    if (isInstalledSolcLocally(rootPath)) {
        solidityfile = require(getLocalSolcInstallation(rootPath));
        solc.setupMethods(solidityfile);
        return true;
    }else {
        if ( compileUsingLocalVersion !== 'undefined' || compileUsingLocalVersion !== null) {
            solidityfile = require(compileUsingLocalVersion);
            solc.setupMethods(solidityfile);
            return true;
        }
    }
}

export function compile(contracts: any) {
    return solc.compile(contracts, 1);
}

export function loadRemoteVersion(remoteCompiler: any, cb: any) {
    solc.loadRemoteVersion(remoteCompiler, cb);
}

