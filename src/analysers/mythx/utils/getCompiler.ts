// TODO:
// FILE ATM IS NOT BEING USED, BUT WILL SERVE AS PLACE TO HANDLE DIFFERENT COMPILERS LOGIC IN FUTURE
import * as vscode from 'vscode';
const { extensions } = vscode;

export async function getCompiler(): Promise<string> {
    const selection = await vscode.window.showQuickPick(['solc', 'truffle'], {
      placeHolder: 'Select compiler version:',
      canPickMany: false,
    });

    if (selection === 'solc') {
      extensions.getExtension('JuanBlanco.solidity').activate().then(
        (done) => {
          vscode.commands.executeCommand('solidity.compile.active');
          return selection;
        },
        (err) => console.error(err),
      );
    } else {
      throw new Error(`MythX-vscode: Unfortunately we still do not support ${selection} compilation!`);
    }



    return '';
}

// dev helper function to dump all the command identifiers to the console
// helps if you cannot find the command id on github.
const findCommand = function() {
  vscode.commands.getCommands(true).then(
      function(cmds) {
          console.log('fulfilled');
          console.log(cmds);
      },
      function() {
          console.log('failed');
          console.log(arguments);
      },
  );
};
