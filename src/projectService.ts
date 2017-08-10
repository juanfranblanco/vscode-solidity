'use strict';
import * as fs from 'fs';
import * as path from 'path';
import * as readyaml from 'read-yaml';
import {Package} from './model/package';
import {Project} from  './model/project';

// TODO: These are temporary constants until standard agreed
const packageConfigFileName = 'dappfile';
const packageDependenciesDirectory = 'dapple_packages';

function createPackage(rootPath: string) {
    let projectPackageFile = path.join(rootPath, packageConfigFileName);
    if (fs.existsSync(projectPackageFile)) {
        // TODO: automapper
        let packageConfig = readyaml.sync(projectPackageFile);
        // TODO: throw expection / warn user of invalid package file
        let projectPackage = new Package();
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

export function initialiseProject(rootPath) {
    let projectPackage = createProjectPackage(rootPath);
    let dependencies = loadDependencies(rootPath, projectPackage);
    let packagesDirAbsolutePath = path.join(rootPath, packageDependenciesDirectory);
    return new Project(projectPackage, dependencies, packagesDirAbsolutePath);
}

function loadDependencies(rootPath: string, projectPackage: Package, depPackages: Array<Package> = new Array<Package>()) {
    if (projectPackage.dependencies !== undefined) {
        Object.keys(projectPackage.dependencies).forEach(dependency => {
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name === dependency)) {
                let depPackagePath = path.join(rootPath, packageDependenciesDirectory, dependency);
                let depPackage = createPackage(depPackagePath);

                if (depPackage !== null) {
                    depPackages.push(depPackage);
                    // Assumed the package manager will install all the dependencies at root so adding all the existing ones
                    loadDependencies(rootPath, depPackage, depPackages);
                } else {
                    // should warn user of a package dependency missing
                }
            }
        });
    }
    return depPackages;
}

function createProjectPackage(rootPath: string) {
    let projectPackage = createPackage(rootPath);
    // Default project package,this could be passed as a function
    if (projectPackage === null) {
        projectPackage = new Package();
        projectPackage.absoluletPath = rootPath;
    }
    return projectPackage;
}
