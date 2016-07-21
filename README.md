# Solidity support for Visual Studio code
Solidity is the language used in Ethereum to create smart contracts, this extension provides: 

* Syntax highlighting
* Snippets
* Compilation of the current contract (Press F1 Compile Current Solidity Contract). 
* Compilation of all the contracts (Press F1 Compile all Solidity Contracts)
* Compilation supporting EIP82 (dappfile and dependency packages) 

Work in progress, any feedback appreciated.

For ideas, issues, additions, modifications please raise an issue or a pull request at https://github.com/juanfranblanco/vscode-solidity/

Road map:

* Support for compilation together with dependency resolution as per EIP82 https://github.com/ethereum/EIPs/issues/82 (Work in progress)
    
    For more information: https://github.com/juanfranblanco/vscode-solidity/issues/4
     
* Deployment using the configured enviroment settings as per EIP82
   
    For more information: https://github.com/juanfranblanco/vscode-solidity/issues/5 

* Unit testing support

    For more information: https://github.com/juanfranblanco/vscode-solidity/issues/6
    
* As you type Error highlighting
    
    For more information: https://github.com/juanfranblanco/vscode-solidity/issues/7
    
* Autocomplete of functions / events from the imported contracts (package dependencies, local contracts)

# Running and debugging
The VS Code documentation explains how to [Run and Debug Extensions](https://code.visualstudio.com/docs/extensions/debugging-extensions)

## Compiling
This extension is written in TypeScript hence needs to be compiled into JavaScript. In the root folder of the extention run

`npm run compile`

## Debugging
If you are editing this extension in VS Code, you can use the debug view and select `Launch Extension`.

## Running
If you fork this VS Code extension, you can override the extension installed from the extension marketplace by running

```code --extensionDevelopmentPath={repo folder}/vscode-solidity```

where `{folder of repo}` is the folder you have checked out the extension to

# Credits
Many thanks to:

Nexus team for the creation of Dapple https://github.com/nexusdev/dapple

ChrisEth for his Solidity Compiler https://github.com/chriseth/browser-solidity

David Krmpotic and Ralph Pichler for the original Sublime extension
https://github.com/davidhq/SublimeEthereum
