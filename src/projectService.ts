'use strict';
import * as vscode from 'vscode';
import * as solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as readyaml from 'read-yaml';
import {compile, compileAndHighlightErrors} from './compiler';
import {Package} from './model/package';
import {Project} from  './model/project';

//todo: this needs to be validated
const packageConfigFileName = 'dappfile';
const packageDependenciesDirectory = 'dapple-packages';

function createPackage(rootPath: string) {
    let projectPackageFile = path.join(rootPath, packageConfigFileName);
    if (fs.existsSync(projectPackageFile)) {
        //todo automapper
        let packageConfig = readyaml.sync(projectPackageFile);
        var projectPackage = new Package();
        projectPackage.absoluletPath = rootPath;
        if (packageConfig) {
            if (packageConfig.layout !== undefined) {
                projectPackage.build_dir = packageConfig.layout.build_dir;
                projectPackage.sol_sources = packageConfig.layout.sol_sources;
            }
            projectPackage.name = packageConfig.name;
            projectPackage.version = packageConfig.version;
            projectPackage.dependencies = packageConfig.dependencies;
        }
        return projectPackage;
    }
    return null;
}

export function initialiseProject() {
    let projectPackage = createProjectPackage(vscode.workspace.rootPath);
    let dependencies = loadDependencies(vscode.workspace.rootPath, projectPackage);
    return new Project(projectPackage, dependencies);
}

function loadDependencies(rootPath: string, projectPackage: Package, depPackages: Array<Package> = new Array<Package>()) {
    if (projectPackage.dependencies != undefined) {
        Object.keys(projectPackage.dependencies).forEach(dependency => {
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name == dependency)) {
                let depPackagePath = path.join(rootPath, packageDependenciesDirectory, dependency);
                let depPackage = createPackage(depPackagePath);

                if (depPackage !== null) {
                    depPackages.push(depPackage);
                    //Assumed the package manager will install all the dependencies at root so adding all the existing ones
                    loadDependencies(rootPath, depPackage, depPackages);
                } else {
                    //should warn user of a package dependency missing
                }
            }
        });
    }
    return depPackages;
}

function createProjectPackage(rootPath: string) {
    let projectPackage = createPackage(rootPath);
    //Default project package,this could be passed as a function
    if (projectPackage === null) {
        projectPackage = new Package();
        projectPackage.absoluletPath = rootPath;
    }
    return projectPackage;
}
