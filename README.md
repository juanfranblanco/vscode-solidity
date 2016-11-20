# Solidity support for Visual Studio code
Solidity is the language used in Ethereum to create smart contracts, this extension provides: 

* Syntax highlighting
* Snippets
* Compilation of the current contract (Press F1 Compile Current Solidity Contract), or F5 
* Compilation of all the contracts (Press F1 Compile all Solidity Contracts), or Ctrl+F5 / Cmd+F5
* Compilation supporting EIP82 (dappfile and dependency packages)

To compile using a different version of Solidity, for example latest or 'v0.4.3+commit.2353da71', use the user settings as follow:

```
"solidity.compileUsingRemoteVersion" : "latest"
```

Work in progress, any feedback appreciated.

For ideas, issues, additions, modifications please raise an issue or a pull request at https://github.com/juanfranblanco/vscode-solidity/

# Credits

Many thanks to:

ChrisEth the Solidity Compiler https://github.com/chriseth/browser-solidity and the Ethereum team.

Nexus team for the creation of the dappfile to structure contracts in projects https://github.com/nexusdev/dapple.

David Krmpotic and Ralph Pichler for the original Sublime extension
https://github.com/davidhq/SublimeEthereum
