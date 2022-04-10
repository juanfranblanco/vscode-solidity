'use strict';
import * as fs from 'fs';
import * as os from 'os'
import * as path from 'path';
import * as yaml from 'yaml-js';
import {Package} from './model/package';
import {Project} from './model/project';
import { Remapping } from './model/remapping';

// TODO: These are temporary constants until standard agreed
// A project standard is needed so each project can define where it store its project dependencies
// and if are relative or at project source
// also versioning (as it was defined years ago)

const packageConfigFileName = 'dappFile';
const remappingConfigFileName = 'remappings.txt';
const brownieConfigFileName = 'brownie-config.yaml';
// These are set using user configuration settings
let packageDependenciesDirectory = 'lib';
let packageDependenciesContractsDirectory = 'src';

function createPackage(rootPath: string) {
    const projectPackageFile = path.join(rootPath, packageConfigFileName);
    if (fs.existsSync(projectPackageFile)) {
        // TODO: automapper
        const packageConfig = readYamlSync(projectPackageFile);
        // TODO: throw expection / warn user of invalid package file
        const projectPackage = new Package(packageDependenciesContractsDirectory);
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
    packageDefaultDependenciesDirectory: string, 
    packageDefaultDependenciesContractsDirectory: string,
    remappings: string[]) {
    
    packageDependenciesDirectory = packageDefaultDependenciesDirectory;
    packageDependenciesContractsDirectory = packageDefaultDependenciesContractsDirectory;
    const projectPackage = createProjectPackage(rootPath);
    const dependencies = loadDependencies(rootPath, projectPackage);
    remappings = loadRemappings(rootPath, remappings);
    let packagesDirAbsolutePath = null;
    if(packageDefaultDependenciesDirectory !== undefined && packageDefaultDependenciesDirectory !== '') {
         packagesDirAbsolutePath = path.join(rootPath, packageDependenciesDirectory);
    }
    return new Project(projectPackage, dependencies, packagesDirAbsolutePath, remappings);
}

function getRemappingFromBrownieConfig(rootPath:string): string[] {
    const brownieConfigFile = path.join(rootPath, brownieConfigFileName);
    const config = readYamlSync(brownieConfigFile);
    let remappingsLoaded: string[];
    try {
        remappingsLoaded = config.compiler.solc.remappings
    } catch (TypeError) {
        return [];
    }
    const remappings = remappingsLoaded.map(i => {
        const [alias, packageID] = i.split('=')
        return `${alias}=${path.join(os.homedir(), ".brownie", "packages", packageID)}`;
    });
    return remappings
}

export function loadRemappings(rootPath:string, remappings: string[]): string[]{
    console.log("Here")
    const remappingsFile = path.join(rootPath, remappingConfigFileName);
    const brownieRemappings = getRemappingFromBrownieConfig(rootPath);
    
    if(remappings == undefined) remappings = [];
    if (fs.existsSync(remappingsFile)) {
        const fileContent = fs.readFileSync(remappingsFile, 'utf8');
        const remappingsLoaded = fileContent.split(/\r\n|\r|\n/); //split linses
        if(remappingsLoaded){
            remappings = [];
            remappingsLoaded.forEach(element => {
                remappings.push(element);
            });
        }
    }
    else if (brownieRemappings.length) {
        remappings =  brownieRemappings;
    }
    return remappings;
}

function loadDependencies(rootPath: string, projectPackage: Package, depPackages: Array<Package> = new Array<Package>()) {
    if (projectPackage.dependencies !== undefined) {
        Object.keys(projectPackage.dependencies).forEach(dependency => {
            if (!depPackages.some((existingDepPack: Package) => existingDepPack.name === dependency)) {
                const depPackageDependencyPath = path.join(rootPath, packageDependenciesDirectory, dependency);
                const depPackage = createPackage(depPackageDependencyPath);

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
    const depPackagePath = path.join(projectPackage.absoluletPath, packageDependenciesDirectory);
    if (fs.existsSync(depPackagePath)) {
        const depPackagesDirectories = getDirectories(depPackagePath);
        depPackagesDirectories.forEach(depPackageDir => {
            const fullPath = path.join(depPackagePath, depPackageDir);
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
    const defaultPackage = new Package(packageDependenciesContractsDirectory);
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
