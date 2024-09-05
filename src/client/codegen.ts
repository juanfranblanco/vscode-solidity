'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as codegen from 'nethereum-codegen';
import { initialiseProject } from '../common/projectService';
import * as workspaceUtil from './workspaceUtil';
import { SettingsService } from './settingsService';
import { OutputChannelService} from './outputChannelService';


export function autoCodeGenerateAfterCompilation(compiledFiles: Array<string>, args: any, diagnostics: vscode.DiagnosticCollection) {
    if (compiledFiles !== undefined && compiledFiles.length > 0) {
        const settings = getCodeGenerationSettings();
        if (settings !== undefined) {
            if (settings.autoCodeGen === true) {
                let lang = 0;
                if (settings.lang !== undefined) {
                    lang = settings.lang;
                }
                compiledFiles.forEach(file => {
                    codeGenerateCQS(file, lang, args, diagnostics);
                });
            }
        }
    }
}

export function getProjectExtensionFromLang(lang: number) {
    switch (lang) {
        case 0:
            return '.csproj';
        case 1:
            return '.vbproj';
        case 3:
            return '.fsproj';
    }
}

export function generateNethereumCodeSettingsFile() {
    const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
    const settingsFile = path.join(root, 'nethereum-gen.settings');
    if (!fs.existsSync(settingsFile)) {

        const prettyRootName = prettifyRootNameAsNamespace(path.basename(root));
        const baseNamespace = prettyRootName + '.Contracts';
        const jsonSettings = {
            'projectName': prettyRootName,
            // tslint:disable-next-line:object-literal-sort-keys
            'namespace': baseNamespace,
            'lang': 0,
            'autoCodeGen': true,
            'projectPath': '../',
        };
        fs.writeFileSync(settingsFile, JSON.stringify(jsonSettings, null, 4));
    }
}


export function codeGenerateAllFilesFromNethereumGenAbisFile(args: any, diagnostics: vscode.DiagnosticCollection) {
    try {
        const settingsPath = args.fsPath;
        const fileName = path.basename(settingsPath);

        const isValid = fileName.match(/^(.*\.)?nethereum-gen\.multisettings$/);
        if (isValid) {
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
                const files = codegen.generateFilesFromConfigSetsArray(settings, root);
                const outputChannel = OutputChannelService.getInstance().getNethereumCodeGenerationOutputChannel();
                outputChannel.clear();
                outputChannel.appendLine('Code generation completed');
                files.forEach(file => {
                    outputChannel.appendLine(file);
                });
            } else {
                throw 'nethereum-gen.multisettings not found';
            }
        }
    } catch (e) {
        const outputChannel = OutputChannelService.getInstance().getNethereumCodeGenerationOutputChannel();
        outputChannel.clear();
        outputChannel.appendLine('Error generating code:');
        outputChannel.appendLine('Please provide a valid file named: nethereum-gen.multisettings at the project root, with paths containing properly formatted xxx.abi or yyy.json files from the compilation output of the extension (bin folder) or other tools like fondry (out folder)');
        outputChannel.appendLine(e.message);
        outputChannel.show();
    }
}

export function codeGenerateNethereumCQSCsharp(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 0;
    const editor = vscode.window.activeTextEditor;
    const fileName = editor.document.fileName;
    codeGenerateCQS(fileName, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSVbNet(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 1;
    const editor = vscode.window.activeTextEditor;
    const fileName = editor.document.fileName;
    codeGenerateCQS(fileName, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharp(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 3;
    const editor = vscode.window.activeTextEditor;
    const fileName = editor.document.fileName;
    codeGenerateCQS(fileName, lang, args, diagnostics);
}

export function codeGenerateNethereumCQSVbAll(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 1;
    codeGenerateAllFiles(lang, args, diagnostics);
}

export function codeGenerateNethereumCQSFSharpAll(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 3;
    codeGenerateAllFiles(lang, args, diagnostics);
}

export function codeGenerateNethereumCQSCSharpAll(args: any, diagnostics: vscode.DiagnosticCollection) {
    const lang = 0;
    codeGenerateAllFiles(lang, args, diagnostics);
}

function getBuildPath() {
    const packageDefaultDependenciesDirectory = SettingsService.getPackageDefaultDependenciesDirectories();
    const packageDefaultDependenciesContractsDirectory = SettingsService.getPackageDefaultDependenciesContractsDirectory();
    const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
    const remappings = workspaceUtil.getSolidityRemappings();
    const project = initialiseProject(rootPath, packageDefaultDependenciesDirectory, packageDefaultDependenciesContractsDirectory, remappings);
    return path.join(rootPath, project.projectPackage.build_dir);
}

function codeGenerateAllFiles(lang: number, args: any, diagnostics: vscode.DiagnosticCollection) {
    const buildPath = getBuildPath();
    const outputPath = '**/*.json';
    const files = vscode.workspace.findFiles(outputPath, null, 1000);
    files.then(documents => {
        documents.forEach(document => {
            if (document.fsPath.startsWith(buildPath)) {
                codeGenerateCQS(document.fsPath, lang, args, diagnostics);
            }
        });
    });
}

export function codeGenerateAllFilesFromAbiInCurrentFolder(lang: number, args: any, diagnostics: vscode.DiagnosticCollection) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return; // We need something open
    }
    const buildPath = path.dirname(editor.document.uri.fsPath);
    const outputPath = '**/*.abi';
    const files = vscode.workspace.findFiles(outputPath, null, 1000);
    files.then(documents => {
        documents.forEach(document => {
            if (document.fsPath.startsWith(buildPath)) {
                codeGenerateCQS(document.fsPath, lang, args, diagnostics);
            }
        });
    });
}


function getCodeGenerationSettings() {
    const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
    const settingsFile = path.join(root, 'nethereum-gen.settings');
    if (fs.existsSync(settingsFile)) {
        const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        return settings;
    }
    return undefined;
}

function getCodeGenerationAbiFilesFromSettings(abisPath: string) {
    if(path.basename(abisPath) === 'nethereum-gen.abis') {
        if (fs.existsSync(abisPath)) {
            const settings = JSON.parse(fs.readFileSync(abisPath, 'utf8'));
            return settings;
        }
    }
    return undefined;
}

export function codeGenerateCQS(fileName: string, lang: number, args: any, diagnostics: vscode.DiagnosticCollection) {
    try {
        const extension = getProjectExtensionFromLang(lang);
        const root = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
        const settings = getCodeGenerationSettings();
        const prettyRootName = prettifyRootNameAsNamespace(path.basename(root));
        let baseNamespace = prettyRootName + '.Contracts';
        let projectName = baseNamespace;
        let projectPath = path.join(root);
        let useFolderAsNamespace = false;
        let ignorePrefixFolder = '';

        if (settings !== undefined) {
            if (settings.projectName !== undefined) {
                projectName = settings.projectName;
                baseNamespace = settings.namespace;
            }

            if (settings.projectPath !== undefined) {
                projectPath = path.join(projectPath, settings.projectPath);
            }

            if (settings.useFolderAsNamespace !== undefined) {
                useFolderAsNamespace = settings.useFolderAsNamespace;
            }

            if (settings.ignorePrefixFolder !== undefined) {
                ignorePrefixFolder = settings.ignorePrefixFolder;
            }
        }
        const outputPathInfo = path.parse(fileName);
        const contractName = outputPathInfo.name;
        let compilationOutput;
        let abi = undefined;
        let bytecode = '0x';
        if (outputPathInfo.ext === '.abi') {
            abi = fs.readFileSync(fileName, 'utf8');
            compilationOutput = { 'abi': abi, 'bytecode': '0x' };
            const binFile = fileName.substr(0, fileName.lastIndexOf('.')) + '.bin';
            if (fs.existsSync(binFile)) {
                bytecode = fs.readFileSync(binFile, 'utf8');
            }
        } else {
            compilationOutput = JSON.parse(fs.readFileSync(fileName, 'utf8'));
            abi = JSON.stringify(compilationOutput.abi);
            bytecode = compilationOutput.bytecode.object;
            if(bytecode === undefined) {
                bytecode = compilationOutput.bytecode;
            }
        }
        if (abi !== undefined) {

            const projectFullPath = path.join(projectPath, projectName + extension);

            if (!fs.existsSync(projectFullPath)) {
                codegen.generateNetStandardClassLibrary(projectName, projectPath, lang);
            }

            if (useFolderAsNamespace) {
                const pathFullIgnore = path.join(getBuildPath(), ignorePrefixFolder);
                const dirPath = path.dirname(fileName);
                let testPath = '';
                if (dirPath.startsWith(pathFullIgnore)) {
                    testPath = path.relative(pathFullIgnore, path.dirname(fileName));
                    // make upper case the first char in a folder
                    testPath = prettifyRootNameAsNamespaceWithSplitString(testPath, path.sep, path.sep);
                }
                projectPath = path.join(projectPath, testPath);
                const trailingNameSpace = prettifyRootNameAsNamespaceWithSplitString(testPath, path.sep, '.').trim();
                if (trailingNameSpace !== '') {
                    baseNamespace = baseNamespace + '.' + trailingNameSpace;
                }

            }

            codegen.generateAllClasses(abi,
                bytecode,
                contractName,
                baseNamespace,
                projectPath,
                lang);
        }
    } catch (e) {
        const outputChannel = OutputChannelService.getInstance().getNethereumCodeGenerationOutputChannel();
        outputChannel.clear();
        outputChannel.appendLine('Error generating code:');
        outputChannel.appendLine(e.message);
        outputChannel.show();
    }
}

// remove - and make upper case
function prettifyRootNameAsNamespace(value: string) {
   return prettifyRootNameAsNamespaceWithSplitString(value, '-', '');
}

function prettifyRootNameAsNamespaceWithSplitString(value: string, splitChar: string, joinChar: string) {
    return value.split(splitChar).map(function capitalize(part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(joinChar);
}

