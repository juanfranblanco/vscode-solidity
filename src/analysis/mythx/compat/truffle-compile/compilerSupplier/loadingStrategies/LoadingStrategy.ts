import * as findCacheDir from 'find-cache-dir';
import * as fs from 'fs';


export default class LoadingStrategy {
  public config: any;
  public cachePath: any;

  constructor(options = {}) {
    const defaultConfig = {
      versionsUrl: 'https://solc-bin.ethereum.org/bin/list.json',
      compilerUrlRoot: 'https://solc-bin.ethereum.org/bin/',
      dockerTagsUrl:
        'https://registry.hub.docker.com/v2/repositories/ethereum/solc/tags/',
    };
    this.config = Object.assign({}, defaultConfig, options);
    this.cachePath = findCacheDir({
      name: 'truffle',
      cwd: __dirname,
      create: true,
    });
  }

  public addFileToCache(code, fileName) {
    const filePath = this.resolveCache(fileName);
    fs.writeFileSync(filePath, code);
  }

  public errors(kind, input = '', error = '') {
    const info = 'Run `truffle compile --list` to see available versions.';

    const kinds = {
      noPath: 'Could not find compiler at: ' + input,
      noVersion:
        `Could not find a compiler version matching ${input}. ` +
        `Please ensure you are specifying a valid version, constraint or ` +
        `build in the truffle config. ${info}`,
      noRequest:
        'Failed to complete request to: ' +
        input +
        '. Are you connected to the internet?\n\n' +
        error,
      noDocker:
        'You are trying to run dockerized solc, but docker is not installed.',
      noImage:
        'Please pull ' +
        input +
        ' from docker before trying to compile with it.',
      noNative: 'Could not execute local solc binary: ' + error,
      noString:
        '`compilers.solc.version` option must be a string specifying:\n' +
        '   - a path to a locally installed solcjs\n' +
        "   - a solc version or range (ex: '0.4.22' or '^0.5.0')\n" +
        "   - a docker image name (ex: 'stable')\n" +
        "   - 'native' to use natively installed solc\n" +
        'Received: ' +
        input +
        ' instead.',
    };

    return new Error(kinds[kind]);
  }

  public fileIsCached(fileName) {
    const file = this.resolveCache(fileName);
    return fs.existsSync(file);
  }

  public load(_userSpecification) {
    throw new Error(
      'Abstract method LoadingStrategy.load is not implemented for this strategy.',
    );
  }

  /**
   * Cleans up error listeners set (by solc?) when requiring it. (This code inherited from
   * previous implementation, note to self - ask Tim about this)
   */
  public removeListener() {
    const listeners = process.listeners('uncaughtException');
    const execeptionHandler = listeners[listeners.length - 1];

    if (execeptionHandler) {
      process.removeListener('uncaughtException', execeptionHandler);
    }
  }

  public resolveCache(fileName) {
    const thunk = findCacheDir({
      name: 'truffle',
      cwd: __dirname,
      thunk: true,
    });
    return thunk(fileName);
  }
}

