'use strict';
import * as fs from 'fs';
import * as path from 'path';
import * as readyaml from 'read-yaml';
import {Package} from './model/package';
import {Project} from  './model/project';

// TODO: These are temporary constants until standard agreed
const packageConfigFileName = 'dappFile';
const packageDependenciesDirectory = 'lib';

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
                if (projectPackage.build_dir !== undefined) {
                projectPackage.build_dir = packageConfig.layout.build_dir;
                }
                if (projectPackage.sol_sources !== undefined) {
                projectPackage.sol_sources = packageConfig.layout.sol_sources;
                }
            }
            if (projectPackage.name !== undefined) {
                projectPackage.name = packageConfig.name;
            } else {
                projectPackage.name = path.basename(rootPath);
            }

            if (projectPackage.version !== undefined) {
                projectPackage.version = packageConfig.name;
            }

            if (projectPackage.dependencies !== undefined) {
                projectPackage.dependencies = packageConfig.dependencies;
            }
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
                let depPackageDependencyPath = path.join(rootPath, packageDependenciesDirectory, dependency);
                let depPackage = createPackage(depPackageDependencyPath);

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
    // lets not skip packages in lib
    let depPackagePath = path.join(projectPackage.absoluletPath, packageDependenciesDirectory);
    if (fs.existsSync(depPackagePath)) {
        let depPackagesDirectories = getDirectories(depPackagePath);
        depPackagesDirectories.forEach(depPackageDir => {
            let fullPath = path.join(depPackagePath, depPackageDir);
            let depPackage = createPackage(fullPath);
            if (depPackage == null) {
                depPackage = createDefaultPackage(fullPath);
            }
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name === depPackage.name)) {
                depPackages.push(depPackage);
                    loadDependencies(rootPath, depPackage, depPackages);
            }
        });
    }
    return depPackages;
}

function getDirectories(dirPath: string): string[] {
  return fs.readdirSync(dirPath).filter(function (file) {
    const subdirPath = path.join(dirPath, file);
    return fs.statSync(subdirPath).isDirectory();
  });
}

function createDefaultPackage(packagePath: string): Package {
    let defaultPackage = new Package();
    defaultPackage.absoluletPath = packagePath;
    defaultPackage.name = path.basename(packagePath);
    return defaultPackage;
}

function createProjectPackage(rootPath: string): Package {
    let projectPackage = createPackage(rootPath);
    // Default project package,this could be passed as a function
    if (projectPackage === null) {
        projectPackage = createDefaultPackage(rootPath);
    }
    return projectPackage;
}
