import * as Debug from 'debug';
import CompileError from './compileerror';


const debug = Debug("compile:parser"); // eslint-disable-line no-unused-vars
// Warning issued by a pre-release compiler version, ignored by this component.
const preReleaseCompilerWarning =
  "This is a pre-release compiler version, please do not use it in production.";

export const parseImports = (body, solc) => {
  // WARNING: Kind of a hack (an expedient one).

  // So we don't have to maintain a separate parser, we'll get all the imports
  // in a file by sending the file to solc and evaluating the error messages
  // to see what import statements couldn't be resolved. To prevent full-on
  // compilation when a file has no import statements, we inject an import
  // statement right on the end; just to ensure it will error and we can parse
  // the imports speedily without doing extra work.

  // If we're using docker/native, we'll still want to use solcjs to do this part.
  if (solc.importsParser) {
    solc = solc.importsParser;
  }

  // Helper to detect import errors with an easy regex.
  const importErrorKey = "TRUFFLE_IMPORT";

  // Inject failing import.
  const failingImportFileName = "__Truffle__NotFound.sol";

  body = body + "\n\nimport '" + failingImportFileName + "';\n";

  const solcStandardInput = {
    language: "Solidity",
    sources: {
      "ParsedContract.sol": {
        content: body
      }
    },
    settings: {
      outputSelection: {
        "ParsedContract.sol": {
          "*": [] // We don't need any output.
        }
      }
    }
  };

  let output = solc.compile(JSON.stringify(solcStandardInput), function() {
    // The existence of this function ensures we get a parsable error message.
    // Without this, we'll get an error message we *can* detect, but the key will make it easier.
    // Note: This is not a normal callback. See docs here: https://github.com/ethereum/solc-js#from-version-021
    return { error: importErrorKey };
  });

  output = JSON.parse(output);

  // Filter out the "pre-release compiler" warning, if present.
  const errors = output.errors.filter(function(solidity_error) {
    return solidity_error.message.indexOf(preReleaseCompilerWarning) < 0;
  });

  const nonImportErrors = errors.filter(function(solidity_error) {
    // If the import error key is not found, we must not have an import error.
    // This means we have a *different* parsing error which we should show to the user.
    // Note: solc can return multiple parsing errors at once.
    // We ignore the "pre-release compiler" warning message.
    return solidity_error.formattedMessage.indexOf(importErrorKey) < 0;
  });

  // Should we try to throw more than one? (aside; we didn't before)
  if (nonImportErrors.length > 0) {
    throw new CompileError(nonImportErrors[0].formattedMessage);
  }

  // Now, all errors must be import errors.
  // Filter out our forced import, then get the import paths of the rest.
  const imports = errors
    .filter(function(solidity_error) {
      return solidity_error.message.indexOf(failingImportFileName) < 0;
    })
    .map(function(solidity_error) {
      const matches = solidity_error.formattedMessage.match(
        /import[^'"]+("|')([^'"]+)("|')/
      );

      // Return the item between the quotes.
      return matches[2];
    });

  return imports;
};
