# Solidity support for Visual Studio code
Solidity is the language used in Ethereum to create smart contracts, this extension provides: 

* Syntax highlighting
* Snippets
* Compilation of the current contract (Press F1 Solidity : Compile Current Solidity Contract), or F5 
* Compilation of all the contracts (Press F1 Solidity : Compile all Solidity Contracts), or Ctrl+F5 / Cmd+F5
* Compilation supporting EIP82 (dappfile and dependency packages)
* Support for different solidity versions
* Experimental code generation using https://github.com/Nethereum/abi-code-gen, it includes currently the default template for Nethereum service, dtos generation. 
  (Open 'contractName.json' after compilation from the bin folder. Press F1 and press Solidity: Code generate from compilation output..)
  Please contribute more templates.


To compile using a different version of Solidity, for example latest or 'v0.4.3+commit.2353da71', this will download this version everytime you compile:

```
"solidity.compileUsingRemoteVersion" : "latest"
```

If you have downloaded a local version you can configure it as follows:

```
"solidity.compileUsingLocalVersion" : "C:\\Users\\JuanFran\\Downloads\\soljson-v0.4.15%2Bcommit.bbb8e64f.js"
```

You can find all the different versions in the solc-bin repository https://github.com/ethereum/solc-bin/tree/gh-pages/bin

Work in progress, any feedback appreciated.

For ideas, issues, additions, modifications please raise an issue or a pull request at https://github.com/juanfranblanco/vscode-solidity/
and send a message on gitter at https://gitter.im/vscode-solidity/Lobby to get an instant notification.

# Credits

Many thanks to:

ChrisEth the Solidity Compiler https://github.com/chriseth/browser-solidity and the Ethereum team.

Nexus team for the creation of the dappfile to structure contracts in projects https://github.com/nexusdev/dapple.

Raghav Dua for the creation of solium the solidity linter and Sol Parse (and everyone that contributed to those projects)

Beau Gunderson for contributing the initial integration of solium  https://github.com/juanfranblanco/vscode-solidity/issues/24 

Nick Addison, Elazar Gershuni, Joe Whittles for their contributions.

David Krmpotic and Ralph Pichler for the original Sublime extension
https://github.com/davidhq/SublimeEthereum
