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
 

## Credits
Many thanks to:

Nexus team for the creation of Dapple https://github.com/nexusdev/dapple

ChrisEth for his Solidity Compiler https://github.com/chriseth/browser-solidity

David Krmpotic and Ralph Pichler for the original Sublime extension
https://github.com/davidhq/SublimeEthereum
