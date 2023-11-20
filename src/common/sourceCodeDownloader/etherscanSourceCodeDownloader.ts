import axios from 'axios';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as workspaceUtil from '../../client/workspaceUtil';
import { SourceDocumentCollection } from '../model/sourceDocumentCollection';
import { SettingsService } from '../../client/settingsService';

export class EtherscanDomainChainMapper {
   // public static apiKey = 'YourApiKey';
    public static getMappings(): any {
        return  {'ethereum' : 'api.etherscan.io',
                 'optimism' : 'api-optimistic.etherscan.io',
                 'binance': 'api.bscscan.com',
                 'polygon': 'api.polygonscan.com'        };
    }

    public static getApiKeyMappings(): any {
        return  {'ethereum' : 'explorer_etherscan_apikey',
                 'optimism' : 'explorer_etherscan_optimism_apikey',
                 'binance': 'explorer_bscscan_apikey',
                 'polygon': 'explorer_polygonscan_apikey'        };
    }

    public static getDomain(chain: string ) {
        
        return this.getMappings()[chain];
    }

    public static getChains(): string[] {
        return Object.keys(this.getMappings());
    }
}


export class EtherscanContractDownloader {


    public static isValiAddressMessage(address: string): string | vscode.InputBoxValidationMessage | Thenable<string | vscode.InputBoxValidationMessage> {
        const invalidAddress = <vscode.InputBoxValidationMessage>{ message: 'Invalid address', severity: vscode.InputBoxValidationSeverity.Error};
        if (address === null || address === undefined) {return invalidAddress; }
        address = address.toLowerCase();
        if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
            return invalidAddress;
        } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
            // If it's all small caps or all all caps, return true
            return null;
        }
        return invalidAddress;
    }

    public static hexLenth(hex: string): number {
        if (hex.startsWith('0x')) { return hex.length - 2; }
        return hex.length;
    }

    public static ensureHexPrefix(hex: string): string {
        if (hex.startsWith('0x')) { return hex; }
        return hex;
    }

    public static isValiAddress(address: string): boolean {
        if (address === null || address === undefined) {return false; }
        address = address.toLowerCase();
        if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
            return false;
        } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
            return true;
        }
        return false;
    }

    public static async downloadContractWithPrompts() {

        if (vscode.window.activeTextEditor) {
        try {
            const chains = EtherscanDomainChainMapper.getChains();
            const selectedChain: string = await vscode.window.showQuickPick(chains);
            const inputBox: vscode.InputBoxOptions = {};
            inputBox.title = 'Please enter the contract address:';
            inputBox.prompt = 'Please enter the contract address';
            inputBox.ignoreFocusOut = true;
            inputBox.validateInput = this.isValiAddressMessage;

            let selectedAddress: string = await vscode.window.showInputBox(inputBox);
            if (selectedAddress !== undefined) { // cancelled
                if (!this.isValiAddress(selectedAddress)) { throw 'Invalid address'; }
                selectedAddress = this.ensureHexPrefix(selectedAddress);
                const pathProject = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
                const downloadedFiles = await EtherscanContractDownloader.downloadContract(selectedChain, selectedAddress, pathProject);
                vscode.window.showInformationMessage('Contract downloaded:' + downloadedFiles[0]);
                const openPath = vscode.Uri.file(downloadedFiles[0]);
                vscode.workspace.openTextDocument(openPath).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
            } catch (e) {
                vscode.window.showErrorMessage('Error downloading contract: ' + e);
            }
        } else {
            throw 'Please open a file to identify the worspace';
        }
    }


    public static async downloadContract(chain: string, address: string,
                                         projectPath: string, subfolder = 'chainContracts'): Promise<string[]> {
          const apiKey = SettingsService.getExplorerEtherscanBasedApiKey(chain);
          const info = await EtherscanContractInfoService.getContractInfo(chain, address, apiKey);
          const downloadedFiles: string[] = [];
           if (info.result.length > 0) {
              // one contract..
              const contractInfo = info.result[0];
              if(contractInfo.SourceCode === '') {throw 'Contract has not been verified or found'; }
              const subfolderFullPath = path.join(projectPath, contractInfo.ContractName);
              fse.ensureDirSync(subfolderFullPath);
              const abiFileName = contractInfo.ContractName + '.abi';
              fs.writeFileSync(path.join(subfolderFullPath, abiFileName), contractInfo.ABI);
              const sourceCodeCollection: string[] = [];
              if (contractInfo.SourceCode.startsWith('{')) {
                    let sourceInfoString = contractInfo.SourceCode.trim();
                    if (sourceInfoString.startsWith('{{')) {
                        sourceInfoString = sourceInfoString.substring(1, sourceInfoString.length - 1);
                    }
                    const sourceInfo = JSON.parse(sourceInfoString);
                    const fileNames = Object.keys(sourceInfo.sources);
                    fileNames.forEach(fileName => {
                        const fullPathContractFile = path.join(subfolderFullPath, fileName);
                        fse.ensureDirSync(path.dirname(fullPathContractFile));
                        sourceCodeCollection.push(sourceInfo.sources[fileName].content);
                        fs.writeFileSync(fullPathContractFile, sourceInfo.sources[fileName].content);
                        downloadedFiles.push(fullPathContractFile);
                    });
                    const libraryImports = SourceDocumentCollection.getAllLibraryImports(sourceCodeCollection);
                    const remappingContents = libraryImports.map( x => `${x}=${x}`).join('\n');
                    fs.writeFileSync(path.join(subfolderFullPath, 'remappings.txt'), remappingContents);
               } else {
                const solidityFileName = contractInfo.ContractName + '.sol';
                const fullPathContractFile = path.join(subfolderFullPath, solidityFileName);
                fs.writeFileSync(fullPathContractFile, contractInfo.SourceCode);
                downloadedFiles.push(fullPathContractFile);
              }
              return downloadedFiles;
           }
     }
}


export class EtherscanContractInfoService {
    public static async getContractInfo(chain: string, address: string, apiKey = 'YourApiKeyToken'): Promise<EtherscanContractInfoResponse> {
      const domain = EtherscanDomainChainMapper.getDomain(chain);
       const url = `https://${domain}/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
       const response = await axios.get(url);
       return response.data as EtherscanContractInfoResponse;
    }
}


export interface EtherscanContractInfoResponse {
    status:  string;
    message: string;
    result:  EtherscanContractInfo[];
}

export interface EtherscanContractInfo {
    SourceCode:           string;
    ABI:                  string;
    ContractName:         string;
    CompilerVersion:      string;
    OptimizationUsed:     string;
    Runs:                 string;
    ConstructorArguments: string;
    EVMVersion:           string;
    Library:              string;
    LicenseType:          string;
    Proxy:                string;
    Implementation:       string;
    SwarmSource:          string;
}
