import * as Debug from 'debug';
import * as requireFromString from 'require-from-string';
import * as fs from 'fs';
// import * as ora from 'ora';
import * as originalRequire from 'original-require';
import * as request from 'request-promise';
import * as semver from 'semver';
import * as solcWrap from 'solc/wrapper';
import LoadingStrategy from './LoadingStrategy';

const debug = Debug('compile:compilerSupplier');


export default class VersionRange extends LoadingStrategy {
  public compilerFromString(code) {
    const soljson = requireFromString(code);
    const wrapped = solcWrap(soljson);
    this.removeListener();
    return wrapped;
  }

  public findNewestValidVersion(version, allVersions) {
    if (!semver.validRange(version)) {
      return null;
    }
    const satisfyingVersions = Object.keys(allVersions.releases)
      .map(solcVersion => {
        if (semver.satisfies(solcVersion, version)) {
          return solcVersion;
        }
      })
      .filter(solcVersion => solcVersion);
    if (satisfyingVersions.length > 0) {
      return satisfyingVersions.reduce((newestVersion, v) => {
        return semver.gtr(v, newestVersion) ? v : newestVersion;
      }, '0.0.0');
    } else {
      return null;
    }
  }

  public getCachedSolcByFileName(fileName) {
    const filePath = this.resolveCache(fileName);
    const soljson = originalRequire(filePath);
    debug('soljson %o', soljson);
    const wrapped = solcWrap(soljson);
    this.removeListener();
    return wrapped;
  }

  // Range can also be a single version specification like "0.5.0"
  public getCachedSolcByVersionRange(version) {
    const cachedCompilerFileNames = fs.readdirSync(this.cachePath);
    const validVersions = cachedCompilerFileNames.filter(fileName => {
      const match = fileName.match(/v\d+\.\d+\.\d+.*/);
      if (match) {
        return semver.satisfies(match[0], version);
      }
    });

    const multipleValidVersions = validVersions.length > 1;
    const compilerFileName = multipleValidVersions
      ? this.getMostRecentVersionOfCompiler(validVersions)
      : validVersions[0];
    return this.getCachedSolcByFileName(compilerFileName);
  }

  public getCachedSolcFileName(commit) {
    const cachedCompilerFileNames = fs.readdirSync(this.cachePath);
    return cachedCompilerFileNames.find(fileName => {
      return fileName.includes(commit);
    });
  }

  public getCommitFromVersion(versionString) {
    return 'commit.' + versionString.match(/commit\.(.*?)\./)[1];
  }

  public getMostRecentVersionOfCompiler(versions) {
    return versions.reduce((mostRecentVersionFileName, fileName) => {
      const match = fileName.match(/v\d+\.\d+\.\d+.*/);
      const mostRecentVersionMatch = mostRecentVersionFileName.match(
        /v\d+\.\d+\.\d+.*/,
      );
      return semver.gtr(match[0], mostRecentVersionMatch[0])
        ? fileName
        : mostRecentVersionFileName;
    }, '-v0.0.0+commit');
  }

  public getSatisfyingVersionFromCache(versionRange) {
    if (this.versionIsCached(versionRange)) {
      return this.getCachedSolcByVersionRange(versionRange);
    }
    throw this.errors('noVersion', versionRange);
  }

  public async getSolcByCommit(commit) {
    const solcFileName = this.getCachedSolcFileName(commit);
    if (solcFileName) {
      return this.getCachedSolcByFileName(solcFileName);
    }

    const allVersions = await this.getSolcVersions();
    const fileName = this.getSolcVersionFileName(commit, allVersions);

    if (!fileName) {
      throw new Error('No matching version found');
    }

    return this.getSolcByUrlAndCache(fileName);
  }

  public async getSolcByUrlAndCache(fileName) {
    const url = this.config.compilerUrlRoot + fileName;
    // const spinner = ora({
    //   color: 'red',
    //   text: 'Downloading compiler',
    // }).start();
    process.stdout.write('Downloading compiler...');
    try {
      const response = await request.get(url);
      process.stdout.write('\n');
      // spinner.stop();
      this.addFileToCache(response, fileName);
      return this.compilerFromString(response);
    } catch (error) {
      // spinner.stop();
      process.stdout.write('\n');
      throw this.errors('noRequest', url, error);
    }
  }

  public async getSolcFromCacheOrUrl(version) {
    let allVersions;
    try {
      allVersions = await this.getSolcVersions();
    } catch (error) {
      throw this.errors('noRequest', version, error);
    }

    const fileName = this.getSolcVersionFileName(version, allVersions);
    if (!fileName) {
      throw this.errors('noVersion', version);
    }

    if (this.fileIsCached(fileName)) {
      return this.getCachedSolcByFileName(fileName);
    }

    return this.getSolcByUrlAndCache(fileName);
  }

  public getSolcVersions() {
    // const spinner = ora({
    //   color: 'yellow',
    //   text: 'Fetching solc version list from solc-bin',
    // }).start();

    process.stdout.write('Fetching solc version list from solc-bin...')
    return request(this.config.versionsUrl)
      .then(list => {
        process.stdout.write('\n');
        // spinner.stop();
        return JSON.parse(list);
      })
      .catch(err => {
        process.stdout.write('\n');
        // spinner.stop();
        throw this.errors('noRequest', this.config.versionsUrl, err);
      });
  }

  public getSolcVersionFileName(version, allVersions) {
    if (allVersions.releases[version]) {
      return allVersions.releases[version];
    }

    const isPrerelease =
      version.includes('nightly') || version.includes('commit');

    if (isPrerelease) {
      for (const build of allVersions.builds) {
        const exists =
          build['prerelease'] === version ||
          build['build'] === version ||
          build['longVersion'] === version;

        if (exists) {
          return build['path'];
        }
      }
    }

    const versionToUse = this.findNewestValidVersion(version, allVersions);

    if (versionToUse) {
      return allVersions.releases[versionToUse];
    }

    return null;
  }

  public async load(versionRange) {
    const rangeIsSingleVersion = semver.valid(versionRange);
    if (rangeIsSingleVersion && this.versionIsCached(versionRange)) {
      return this.getCachedSolcByVersionRange(versionRange);
    }

    try {
      return await this.getSolcFromCacheOrUrl(versionRange);
    } catch (error) {
      if (error.message.includes('Failed to complete request')) {
        return this.getSatisfyingVersionFromCache(versionRange);
      }
      throw new Error(error);
    }
  }

  public normalizeSolcVersion(input) {
    const version = String(input);
    return version.split(':')[1].trim();
  }

  public versionIsCached(version) {
    const cachedCompilerFileNames = fs.readdirSync(this.cachePath);
    const cachedVersions = cachedCompilerFileNames.map(fileName => {
      const match = fileName.match(/v\d+\.\d+\.\d+.*/);
      if (match) {
        return match[0];
      }
    });
    return cachedVersions.find(cachedVersion =>
      semver.satisfies(cachedVersion, version),
    );
  }
}
