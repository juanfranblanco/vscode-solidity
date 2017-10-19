# Solidity support for Visual Studio code
Solidity is the language used in Ethereum to create smart contracts, this extension provides: 

* Syntax highlighting
* Snippets
* Compilation of the current contract (Press F1 Solidity : Compile Current Solidity Contract), or F5 
* Compilation of all the contracts (Press F1 Solidity : Compile all Solidity Contracts), or Ctrl+F5 / Cmd+F5
* Code completion for all contracts / libraries in the current file and all referenced imports
* Default project structure (solidity files needs to be in the 'src' directory, and libraries in the 'lib' directory). Libraries will follow the same structure.
* Compilation supporting EIP82 (dappfile and dependency packages)
* Support for different solidity versions (Remote and local)
* Code generation using https://github.com/Nethereum/abi-code-gen, it includes currently the default template for Nethereum service, dtos generation. 
  (Open 'contractName.json' after compilation from the bin folder. Press F1 and press Solidity: Code generate from compilation output..)
  Please contribute more templates.
* Linting using Solhint or Solium

# Instructions

## Using a different version of the solidity compiler

Sometimes you may want to use a different compiler than the one provided. All the different versions of the solidity compiler can be found in this repository: You can find all the different versions in the solc-bin repository https://github.com/ethereum/solc-bin/tree/gh-pages/bin

Currently we support three ways supported to use a different version of the solidity compiler.

### Remote download

To compile using a remote version, you need to change the following user setting, with the version required, for example 'latest' or 'v0.4.3+commit.2353da71'

```
"solidity.compileUsingRemoteVersion" : "latest"
```
### Using Local file

If you don't have an internet connection, you can download the compiler and change your user settings to use this.
The local file will be use instead of remote.

```
"solidity.compileUsingLocalVersion" : "C:\\Users\\JuanFran\\Downloads\\soljson-v0.4.15%2Bcommit.bbb8e64f.js"
```

### Npm / node installation
If you need to use an specific version for a project, you can also install solc locally in your solidity project folder.

```
npm install solc 
```

## Default project structure

A default project  / library dependency structure is supported as follows:
![Screenshot](screenshots/simpleProjectStructure.PNG)

Libraries will have the same name as their folder they are included.
Solidity files will be in the 'src' folder.
Libraries will be included in the 'lib' folder.

Currently there is no name conflicting resolution, so the first library found matching a name, will be the first one used.

## Code completion

Just press Ctlr + Space or Command + Space to autocomplete statements, currently supported all the storage variables, functions and events (with snippets) included in the current document and every document in the import chain. Also supported all the global variables, global functions, types and units.

![Screenshot](screenshots/autocompletedemo.gif)

## Auto compilation and error highlighting

Auto compilation of files and error highlighting can be enabled or disabled using user settings. Also a default delay is implemented for all the validations (compilation and linting) as solidity compilation can be slow when you have many dependencies.

```
"solidity.enabledAsYouTypeCompilationErrorCheck": true,
"solidity.validationDelay": 1500
```

## Linting

### Solhint

To lint Solidity code it is used Solhint linter https://github.com/tokenhouse/solhint, you can configure it using the following user settings:

```json
"solidity.linter": "solhint",
"solidity.linterDefaultRules": {
  "avoid-sha3": "warn"
}
```

This extension supports `.solhint.json` configuration file. It must be placed to project root 
directory. After any changes in `.solhint.json` it will be synchronized with current IDE 
configuration. 

Solhint linter is used by default.

### Solium

Linting support is provided thanks to Solium https://github.com/duaraghav8/Solium, you can configure it using the following user settings:

```json
"solidity.linter": "solium",
"solidity.linterDefaultRules": {
    "array-declarations": true,
    "blank-lines": false,
    "camelcase": true,
    "deprecated-suicide": true,
    "double-quotes": true,
    "imports-on-top": true,
    "indentation": false,
    "lbrace": true,
    "mixedcase": true,
    "no-empty-blocks": true,
    "no-unused-vars": true,
    "no-with": true,
    "operator-whitespace": true,
    "pragma-on-top": true,
    "uppercase": true,
    "variable-declarations": true,
    "whitespace": true
},
```

soliumrc.json support will be included in the near future, for specific project linting requirements.

## Contributing / Issues / Requests

For ideas, issues, additions, modifications please raise an issue or a pull request at https://github.com/juanfranblanco/vscode-solidity/
and send a message on gitter at https://gitter.im/vscode-solidity/Lobby or https://gitter.im/Nethereum/Nethereum to get an instant notification.

# Credits

Many thanks to:

Christian Reitwiessner and the Ethereum team for Solidity https://github.com/ethereum/solidity  

Raghav Dua and everyone that contributed to Solium, the solidity linter, and the solidity parser.  

Nexus team for the original creation of the dappfile to structure contracts in projects https://github.com/nexusdev/dapple.

Nick Addison, Elazar Gershuni, Joe Whittles for their contributions.

Sebastian Bürgel for keeping reminding me of the offline installation suppport

David Krmpotic and Ralph Pichler for the original Sublime extension
https://github.com/davidhq/SublimeEthereum

Everyone for their support and feedback!