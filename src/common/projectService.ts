'use strict';
import * as fs from 'fs';
import * as os from 'os';
import * as toml from '@iarna/toml';
import * as path from 'path';
import * as yaml from 'yaml-js';
import {Package} from './model/package';
import {Project} from './model/project';
import * as util from './util';
import { Remapping } from './model/remapping';

// TODO: These are temporary constants until standard agreed
// A project standard is needed so each project can define where it store its project dependencies
// and if are relative or at project source
// also versioning (as it was defined years ago)


const packageConfigFileName = 'dappFile';
const remappingConfigFileName = 'remappings.txt';
const brownieConfigFileName = 'brownie-config.yaml';
const hardhatConfigFileName = 'hardhat.config.js';
const truffleConfigFileName = 'truffle-config.js';
const foundryConfigFileName = 'foundry.toml';

const projectFilesAtRoot = [remappingConfigFileName, brownieConfigFileName, foundryConfigFileName, hardhatConfigFileName, truffleConfigFileName, packageConfigFileName];

// These are set using user configuration settings
let defaultPackageDependenciesDirectory = 'lib';
let packageDependenciesContractsDirectory = 'src';
let defaultPackageDependenciesContractsDirectories = ['', 'src', 'contracts'];

export function findFirstRootProjectFile(rootPath: string, currentDocument: string) {
    return util.findDirUpwardsToCurrentDocumentThatContainsAtLeastFileNameSync(projectFilesAtRoot, currentDocument, rootPath);
}

function createPackage(rootPath: string, packageContractsDirectory: string) {
    const projectPackageFile = path.join(rootPath, packageConfigFileName);
    if (fs.existsSync(projectPackageFile)) {
        // TODO: automapper
        const packageConfig = readYamlSync(projectPackageFile);
        // TODO: throw expection / warn user of invalid package file
        const projectPackage = new Package(packageContractsDirectory);
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

function readYamlSync(filePath: string) {
    const fileContent = fs.readFileSync(filePath);
    return yaml.load(fileContent);
}

export function initialiseProject(rootPath: string,
    packageDefaultDependenciesDirectories: string[],
    packageDefaultDependenciesContractsDirectory: string,
    remappings: string[]): Project {

    packageDependenciesContractsDirectory = packageDefaultDependenciesContractsDirectory;
    const projectPackage = createProjectPackage(rootPath, packageDefaultDependenciesContractsDirectory);
    // adding defaults to packages
    const packegesContractsDirectories = [...new Set(defaultPackageDependenciesContractsDirectories.concat(packageDefaultDependenciesContractsDirectory))];
    const packageDependencies: Package[] = loadAllPackageDependencies(packageDefaultDependenciesDirectories, rootPath, projectPackage, packegesContractsDirectories);
    remappings = loadRemappings(rootPath, remappings);
    return new Project(projectPackage, packageDependencies, packageDefaultDependenciesDirectories, remappings);
}

function loadAllPackageDependencies(packageDefaultDependenciesDirectories: string[], rootPath: string, projectPackage: Package, packageDependenciesContractsDirectories: string[]) {
    let packageDependencies: Package[] = [];
    packageDefaultDependenciesDirectories.forEach(packageDependenciesDirectory => {
            packageDependencies = packageDependencies.concat(loadDependencies(rootPath, projectPackage, packageDependenciesDirectory,
                packageDependenciesContractsDirectories));
    });
    return packageDependencies;
}

function getRemappingsFromFoundryConfig(rootPath: string): string[] {
    const foundryConfigFile = path.join(rootPath, foundryConfigFileName);
    if (fs.existsSync(foundryConfigFile)) {

        try {
            const fileContent = fs.readFileSync(foundryConfigFile, 'utf8');
            const configOutput = toml.parse(fileContent);
            let remappingsLoaded: string[];
            remappingsLoaded = configOutput['profile']['default']['remappings'];
            if (!remappingsLoaded) {
                return null;
            }
            if (remappingsLoaded.length === 0) {
                return null;
            }
            return remappingsLoaded;
        } catch (error) {
            // ignore error
            console.log(error);
        }
        return ;
    }
    return null;
}


function getRemappingsFromBrownieConfig(rootPath: string): string[] {
    const brownieConfigFile = path.join(rootPath, brownieConfigFileName);
    if (fs.existsSync(brownieConfigFile)) {
        const config = readYamlSync(brownieConfigFile);
        let remappingsLoaded: string[];
        try {
            remappingsLoaded = config.compiler.solc.remappings;
            if (!remappingsLoaded) {
                return;
            }
        } catch (TypeError) {
            return;
        }
        const remappings = remappingsLoaded.map(i => {
            const [alias, packageID] = i.split('=') ;
            if (packageID.startsWith('/')) { // correct processing for imports defined with global path
                return `${alias}=${packageID}`;
            } else {
                return `${alias}=${path.join(os.homedir(), '.brownie', 'packages', packageID)}`;
            }
        });
        return remappings;
    }
    return null;
}

function getRemappingsFromRemappingsFile(rootPath) {
    const remappingsFile = path.join(rootPath, remappingConfigFileName);
    if (fs.existsSync(remappingsFile)) {
        const remappings = [];
        const fileContent = fs.readFileSync(remappingsFile, 'utf8');
        const remappingsLoaded = fileContent.split(/\r\n|\r|\n/); // split lines
        if (remappingsLoaded) {
            remappingsLoaded.forEach(element => {
                remappings.push(element);
            });
        }
        return remappings;
    }
    return null;
}

export function loadRemappings(rootPath: string, remappings: string[]): string[] {
    if (remappings === undefined) { remappings = []; }

    // Brownie prioritezes brownie-config.yml over remappings.txt
    remappings = getRemappingsFromBrownieConfig(rootPath) ??
                 getRemappingsFromFoundryConfig(rootPath) ??
                 getRemappingsFromRemappingsFile(rootPath) ??
                 remappings;

    return remappings;
}

function loadDependencies(rootPath: string, projectPackage: Package,
                        packageDefaultDependenciesDirectory: string,
                        dependencyAlternativeSmartContractDirectories: string[],
                        depPackages: Array<Package> = new Array<Package>()) {
    if (projectPackage.dependencies !== undefined) {
        Object.keys(projectPackage.dependencies).forEach(dependency => {
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name === dependency)) {
                const depPackageDependencyPath = path.join(rootPath, packageDefaultDependenciesDirectory, dependency);
                const depPackage = createPackage(depPackageDependencyPath, '');
                depPackage.sol_sources_alternative_directories = dependencyAlternativeSmartContractDirectories;

                if (depPackage !== null) {
                    depPackages.push(depPackage);
                    // Assumed the package manager will install all the dependencies at root so adding all the existing ones
                    loadDependencies(rootPath, depPackage, packageDefaultDependenciesDirectory, dependencyAlternativeSmartContractDirectories, depPackages);
                } else {
                    // should warn user of a package dependency missing
                }
            }
        });
    }
    // lets not skip packages in lib
    const depPackagePath = path.join(projectPackage.absoluletPath, packageDefaultDependenciesDirectory);
    if (fs.existsSync(depPackagePath)) {
        const depPackagesDirectories = getDirectories(depPackagePath);
        depPackagesDirectories.forEach(depPackageDir => {
            const fullPath = path.join(depPackagePath, depPackageDir);
            let depPackage = createPackage(fullPath, null);
            if (depPackage == null) {
                depPackage = createDefaultPackage(fullPath);
                depPackage.sol_sources_alternative_directories = dependencyAlternativeSmartContractDirectories;
            }
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name === depPackage.name)) {
                depPackages.push(depPackage);
                    loadDependencies(rootPath, depPackage, packageDefaultDependenciesDirectory, dependencyAlternativeSmartContractDirectories, depPackages);
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

function createDefaultPackage(packagePath: string, packageDependencySmartContractDirectory = ''): Package {
    const defaultPackage = new Package(packageDependencySmartContractDirectory);
    defaultPackage.absoluletPath = packagePath;
    defaultPackage.name = path.basename(packagePath);
    return defaultPackage;
}

function createProjectPackage(rootPath: string, packageDependencySmartContractDirectory = ''): Package {
    let projectPackage = createPackage(rootPath, packageDependencySmartContractDirectory);
    // Default project package,this could be passed as a function
    if (projectPackage === null) {
        projectPackage = createDefaultPackage(rootPath, packageDependencySmartContractDirectory);
    }
    return projectPackage;
}
