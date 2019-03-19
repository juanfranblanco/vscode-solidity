import * as assert from 'assert';
import * as fs from 'fs';
import * as OS from 'os';
import * as path from 'path';
import * as Profiler from './profiler';
import * as expect from 'truffle-expect';
import * as find_contracts from 'truffle-contract-sources';
import * as Config from 'truffle-config';
import * as Debug from 'debug';
import CompileError from './compileerror';
import CompilerSupplier from './compilerSupplier';

const debug = Debug('compile'); // eslint-disable-line no-unused-vars


let nodeDirectory: string;
let contractsDirectory: string;

function getFileContent(filepath: string) {
  const stats: any = fs.statSync(filepath);
  if (stats.isFile()) {
    return fs.readFileSync(filepath).toString();
  } else {
    throw new Error (`File ${filepath} not found`);
  }
}

function isExplicitlyRelative(import_path) {
  return import_path.indexOf('.') === 0;
}

function convertToAbsolutePath(p, base, nodeBase) {
  // If it's an absolute paths, leave it alone.
  if (path.isAbsolute(p)) {
    return p;
  }

  // If it's not explicitly relative, must be relative to node_modules
  if (!isExplicitlyRelative(p)) {
    return path.resolve(path.join(nodeBase, p));
  }

  // Path must be explicitly relative, therefore make it absolute.
  return path.resolve(path.join(base, p));
}

const getSourceFileName = sourcePath => {
  let shortName = path.basename(sourcePath);
  if (shortName.endsWith('.sol')) {
    shortName = shortName.slice(0, -4);
  }
  return shortName;
};

function sourcePath2BuildPath(sourcePath, buildDir) {
  const shortName = getSourceFileName(sourcePath);
  return path.join(buildDir, shortName + '.json');
}

/* returns true if directory/file out of date
*/
function staleBuildContract (sourcePath, buildPath) {
    let sourcePathStat, buildPathStat;
    try {
        sourcePathStat = fs.statSync(sourcePath);
    } catch (err) {
        return true;
    }
    try {
        buildPathStat = fs.statSync(buildPath);
    } catch (err) {
        return true;
    }

    const sourceMtime = sourcePathStat.mtime;
    const buildMtime = buildPathStat.mtime;
    return sourceMtime > buildMtime;
}


// Recent versions of truffle seem to add __ to the end of the bytecode
const cleanBytecode = bytecode => {
  let cleanedBytecode = bytecode.replace(/_.+$/, '');
  cleanedBytecode = `0x${cleanedBytecode}`;
  return cleanedBytecode;
};


const normalizeJsonOutput = jsonObject => {
  const { contracts, sources, compiler, updatedAt } = jsonObject;
  const result = {
    compiler,
    sources: {},
    updatedAt,
  };

  for (const [ sourcePath, solData ] of Object.entries(contracts)) {
      if (!result.sources[sourcePath]) {
          result.sources[sourcePath] = {
              // sourcePath,
              contracts: [],
          };
      }
      for (const [ contractName, contractData ] of Object.entries(solData)) {
          const o = {
              bytecode: cleanBytecode(contractData.evm.bytecode.object),
              contractName,
              deployedBytecode: cleanBytecode(contractData.evm.deployedBytecode.object),
              deployedSourceMap: contractData.evm.deployedBytecode.sourceMap,
              sourceMap: contractData.evm.bytecode.sourceMap,
          };

          result.sources[sourcePath].contracts.push(o);
      }
  }

  for (const entry of Object.entries(sources)) {
    const sourcePath: any = entry[0];
    const solData: any = entry[1];

    if (!result.sources[sourcePath]) {
      continue;
    }
    result.sources[sourcePath].ast = solData.ast;
    result.sources[sourcePath].legacyAST = solData.legacyAST;
    result.sources[sourcePath].id = solData.id;
    const absPathName = convertToAbsolutePath(sourcePath, contractsDirectory, nodeDirectory);
    result.sources[sourcePath].source = getFileContent(absPathName);
  }

  return result;
};

// Most basic of the compile commands. Takes a sources, where
// the keys are file or module paths and the values are the bodies of
// the contracts. Does not evaulate dependencies that aren't already given.
//
// Default options:
// {
//   strict: false,
//   quiet: false,
//   logger: console
// }
const compile = (sourcePath, sourceText, options, callback, isStale) => {
  nodeDirectory = path.join(options.working_directory, 'node_modules');
  contractsDirectory = options.contracts_directory;
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  if (options.logger === undefined) options.logger = console;

  const hasTargets =
    options.compilationTargets && options.compilationTargets.length;

  expect.options(options, ["contracts_directory", "compilers"]);

  expect.options(options.compilers, ["solc"]);

  options.compilers.solc.settings.evmVersion =
    options.compilers.solc.settings.evmVersion ||
    options.compilers.solc.evmVersion ||
    {};
  options.compilers.solc.settings.optimizer =
    options.compilers.solc.settings.optimizer ||
    options.compilers.solc.optimizer ||
    {};

  // Ensure sources have operating system independent paths
  // i.e., convert backslashes to forward slashes; things like C: are left intact.
  const operatingSystemIndependentSources = {};
  const operatingSystemIndependentTargets = {};
  const originalPathMappings = {};

  const defaultSelectors = {
    "": ["legacyAST", "ast"],
    "*": [
      "abi",
      "evm.bytecode.object",
      "evm.bytecode.sourceMap",
      "evm.deployedBytecode.object",
      "evm.deployedBytecode.sourceMap",
      "userdoc",
      "devdoc"
    ]
  };

  // Specify compilation targets
  // Each target uses defaultSelectors, defaulting to single target `*` if targets are unspecified
  const outputSelection = {};
  const targets = operatingSystemIndependentTargets;
  const targetPaths = Object.keys(targets);

  targetPaths.length
    ? targetPaths.forEach(key => (outputSelection[key] = defaultSelectors))
    : (outputSelection["*"] = defaultSelectors);

  const solcStandardInput = {
    language: "Solidity",
    sources: {},
    settings: {
      evmVersion: options.compilers.solc.settings.evmVersion,
      optimizer: options.compilers.solc.settings.optimizer,
      outputSelection
    }
  };

  // Load solc module only when compilation is actually required.
  const supplier = new CompilerSupplier(options.compilers.solc);

  supplier
    .load()
    .then((solc: any) => {

      const solcVersion = solc.version();
      solcStandardInput.sources = {
        [sourcePath]: {
          content: sourceText,
        },
      };

      function findImports(pathName) {
        try {
          const absPathName = convertToAbsolutePath(pathName, contractsDirectory, nodeDirectory);
          if (fs.existsSync(absPathName)) {
            return { contents: getFileContent(absPathName) };
          } else {
            // We can't find the file, so fudge it with the empty contents, which is
            // better than throwing an error.
            return { contents: '' };
          }
        } catch (e) {
          return { error: e.message };
        }
      }

      const result = solc.compile(JSON.stringify(solcStandardInput), findImports);

      const standardOutput = JSON.parse(result);

      let errors = standardOutput.errors || [];
      let warnings = [];

      if (options.strict !== true) {
        warnings = errors.filter(function(error) {
          return error.severity === "warning";
        });

        errors = errors.filter(function(error) {
          return error.severity !== "warning";
        });

        if (options.quiet !== true && warnings.length > 0) {
          options.logger.log(
            OS.EOL + "Compilation warnings encountered:" + OS.EOL
          );
          options.logger.log(
            warnings
              .map(function(warning) {
                return warning.formattedMessage;
              })
              .join(),
          );
        }
      }

      if (errors.length > 0) {
        options.logger.log("");
        return callback(
          new CompileError(
            standardOutput.errors
              .map(function(error) {
                return error.formattedMessage;
              })
              .join()
          )
        );
      }

      standardOutput.compiler =  {
        name: "solc",
        version: solcVersion
      };
      standardOutput.source = sourceText;
      standardOutput.updatedAt = new Date();

      const normalizedOutput = normalizeJsonOutput(standardOutput)

      // FIXME: the below return path is hoaky, because it is in the format that
      // the multiPromisify'd caller in workflow-compile expects.
      const shortName = getSourceFileName(sourcePath);

      callback(null, {[shortName]: normalizedOutput}, isStale);
    })
    .catch(e => {
      throw e;
    });
};

// contracts_directory: String. Directory where .sol files can be found.
// quiet: Boolean. Suppress output. Defaults to false.
// strict: Boolean. Return compiler warnings as errors. Defaults to false.
const all = function(options, callback) {
  find_contracts(options.contracts_directory, function(err, files) {
    if (err) {
      return callback(err);
    }

    options.paths = files;
    with_dependencies(options, callback, true);
  });
};

// contracts_directory: String. Directory where .sol files can be found.
// build_directory: String. Optional. Directory where .sol.js files can be found. Only required if `all` is false.
// all: Boolean. Compile all sources found. Defaults to true. If false, will compare sources against built files
//      in the build directory to see what needs to be compiled.
// quiet: Boolean. Suppress output. Defaults to false.
// strict: Boolean. Return compiler warnings as errors. Defaults to false.
const necessary = function(options, callback) {
  options.logger = options.logger || console;

  Profiler.updated(options, function(err, updated) {
    if (err) {
      return callback(err);
    }

    if (updated.length === 0 && options.quiet !== true) {
      return callback(null, [], {});
    }

    options.paths = updated;
    with_dependencies(options, callback, false);
  });
};

const with_dependencies = (options, callback, compileAll) => {
  options.logger = options.logger || console;
  options.contracts_directory = options.contracts_directory || process.cwd();

  expect.options(options, [
    "paths",
    "working_directory",
    "contracts_directory",
    // "resolver"
  ]);

  const config = Config.default().merge(options);

  Profiler.required_sources(
    config.with({
      paths: options.paths,
      base_path: options.contracts_directory,
      // resolver: options.resolver
    }),
    (err, allSources, required) => {
      if (err) {
        return callback(err);
      }

      // Filter out of the list of files to be compiled those for which we have a JSON that
      // is newer than the last modified time of the source file.
      const filteredRequired = [];
      for (const sourcePath of options.paths) {
        const targetJsonPath = sourcePath2BuildPath(sourcePath, options.build_mythx_contracts);
        if (compileAll || staleBuildContract(sourcePath, targetJsonPath)) {
          // Set for compilation
          filteredRequired.push(sourcePath);
        } else {
          // Pick up from existing JSON
          const buildJson = fs.readFileSync(targetJsonPath, 'utf8');
          const buildObj = JSON.parse(buildJson);
          const shortName = getSourceFileName(sourcePath);
          callback(null, {[shortName]: buildObj}, false);
          return;
        }
      }
      const hasTargets = filteredRequired.length;

      hasTargets
        ? display(filteredRequired, options)
        : display(allSources, options);

      for (const sourcePath of filteredRequired) {
        if (!sourcePath.endsWith('/Migrations.sol')) {
          compile(sourcePath, allSources[sourcePath], options, callback, true);
        }
      }
    });
};

const display = (paths, options) => {
  if (options.quiet !== true) {
    if (!Array.isArray(paths)) {
      paths = Object.keys(paths);
    }

    const blacklistRegex = /^truffle\/|\/Migrations.sol$/;

    paths.sort().forEach(contract => {
      if (path.isAbsolute(contract)) {
        contract =
          "." + path.sep + path.relative(options.working_directory, contract);
      }
      if (contract.match(blacklistRegex)) {
        return;
      }
      options.logger.log("Compiling " + contract + "...");
    });
  }
};


export default {
  CompilerSupplier,
  all,
  compile,
  display,
  necessary,
  with_dependencies,
};
