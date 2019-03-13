import * as assert from 'assert';
import * as fs from 'fs';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import * as trufstuf from '../../../src/analysis/mythx/trufstuf';


describe ('analysis.mythx.trufstuf', () => {
  describe('isTruffleRoot', () => {
    let fsExistsSync: any, fsStatSync: any;

    afterEach(() => {
      fsExistsSync.restore();
      fsStatSync.restore();
    });

    it('should return true for truffle directory', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(true);
      fsStatSync = sinon.stub(fs, 'statSync').returns({
        isDirectory: () => true,
      });

      const res = trufstuf.isTruffleRoot('test');
      assert.ok(fsExistsSync.called);
      assert.ok(fsStatSync.called);
      assert.ok(res);
    });

    it('should return false when directiry does not exist', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(false);
      fsStatSync = sinon.stub(fs, 'statSync').returns({
        isDirectory: () => true,
      });

      const res = trufstuf.isTruffleRoot('test');
      assert.ok(fsExistsSync.called);
      assert.ok(!fsStatSync.called);
      assert.ok(!res);
    });

    it('should return false when fs stat fails', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(true);
      fsStatSync = sinon.stub(fs, 'statSync').returns(null);

      const res = trufstuf.isTruffleRoot('test');
      assert.ok(fsExistsSync.called);
      assert.ok(fsStatSync.called);
      assert.ok(!res);
    });

    it('should return false when path is not directory', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(true);
      fsStatSync = sinon.stub(fs, 'statSync').returns({
        isDirectory: () => false,
      });

      const res = trufstuf.isTruffleRoot('test');
      assert.ok(fsExistsSync.called);
      assert.ok(fsStatSync.called);
      assert.ok(!res);
    });
  });

  describe('getRootDir', () => {
    let fsExistsSync: any, fsStatSync: any;

    afterEach(() => {
      fsExistsSync.restore();
      fsStatSync.restore();
    });

    it('should return root path of truffle project', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(true);
      fsStatSync = sinon.stub(fs, 'statSync').returns({
        isDirectory: () => true,
      });
      const res = trufstuf.getRootDir('/path/to/truffle-project/contracts/contract.sol');
      assert.equal(res, '/path/to/truffle-project');
    });

    it('should return directory when it is not truffle project', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(false);
      fsStatSync = sinon.stub(fs, 'statSync').returns({
        isDirectory: () => true,
      });
      const res = trufstuf.getRootDir('/path/to/truffle-project/contracts/contract.sol');
      assert.equal(res, '/path/to/truffle-project/contracts');
    });

    it('should return directory when it does not have contracts folder', () => {
      fsExistsSync = sinon.stub(fs, 'existsSync').returns(false);
      fsStatSync = sinon.stub(fs, 'statSync').returns({
        isDirectory: () => true,
      });
      const res = trufstuf.getRootDir('/path/to/truffle-project/contract.sol');
      assert.equal(res, '/path/to/truffle-project');
    });
  });

  describe('isTruffleRootAsync', () => {
    let fsStat: any;
    afterEach(() => {
      fsStat.restore();
    });

    it('should resolve true for truffle directory', async () => {
      fsStat = sinon.stub(fs, 'stat').yields(null, {
        isDirectory: () => true,
      });

      const trufModule = proxyquire('../../../src/analysis/mythx/trufstuf', {
        fs: { stat: fsStat },
      });

      const res = await trufModule.isTruffleRootAsync('test');
      assert.ok(fsStat.called);
      assert.ok(res);
    });

    it('should resolve false when fs stat fails', async () => {
      fsStat = sinon.stub(fs, 'stat').yields(new Error('error'));

      const trufModule = proxyquire('../../../src/analysis/mythx/trufstuf', {
        fs: { stat: fsStat },
      });

      const res = await trufModule.isTruffleRootAsync('test');
      assert.ok(fsStat.called);
      assert.ok(!res);
    });

    it('should resolve false when path is not directory', async () => {
      fsStat = sinon.stub(fs, 'stat').yields(null, {
        isDirectory: () => false,
      });

      const trufModule = proxyquire('../../../src/analysis/mythx/trufstuf', {
        fs: { stat: fsStat },
      });

      const res = await trufModule.isTruffleRootAsync('test');
      assert.ok(fsStat.called);
      assert.ok(!res);
    });
  });

  describe('getRootDirAsync', () => {
    let fsStat: any;
    afterEach(() => {
      fsStat.restore();
    });

    it('should resolve root path of truffle project', async () => {
      fsStat = sinon.stub(fs, 'stat').yields(null, {
        isDirectory: () => true,
      });
      const trufModule = proxyquire('../../../src/analysis/mythx/trufstuf', {
        fs: { stat: fsStat },
      });

      const res = await trufModule.getRootDirAsync('/path/to/truffle-project/contracts/contract.sol');
      assert.equal(res, '/path/to/truffle-project');
    });

    it('should resolve directory when it is not truffle project', async () => {
      fsStat = sinon.stub(fs, 'stat').yields(new Error('Error'));
      const trufModule = proxyquire('../../../src/analysis/mythx/trufstuf', {
        fs: { stat: fsStat },
      });

      const res = await trufModule.getRootDirAsync('/path/to/truffle-project/contracts/contract.sol');
      assert.equal(res, '/path/to/truffle-project/contracts');
    });

    it('should resolve directory when it does not have contracts folder', async () => {
      const res = await trufstuf.getRootDirAsync('/path/to/truffle-project/contract.sol');
      assert.equal(res, '/path/to/truffle-project');
    });
  });

  describe('getTruffleBuildJsonFilesAsync', () => {
    let readdir: any, stat: any;
    afterEach(() => {
      readdir.restore();
      stat.reset();
    });

    it('should return paths to contract build json files', async () => {
      readdir = sinon.stub(fs, 'readdir').yields(null, [
        'Migrations.json', 'Contract.sol', 'Contract2.sol',
      ]);

      stat = sinon.stub();

      stat.yields(null, { mtime: 1000000 });
      // stat.onCall(2).yields('error');

        const trufModule = proxyquire('../../../src/analysis/mythx/trufstuf', {
          fs: {
            readFile: (filePath, encoding, cb) => cb(null, '{"content": "content"}'),
            readdir,
            stat,
          },
        });

        const res = await trufModule.getTruffleBuildJsonFilesAsync('/folder/build/contracts');
        assert.deepEqual(res, [
          '/folder/build/contracts/Contract.sol',
          '/folder/build/contracts/Contract2.sol',
        ]);
    });
  });

  describe('getBuildContractsDir', () => {
    it('should return build contracts dir of the project path', () => {
      const res = trufstuf.getBuildContractsDir('/my-project');
      assert.equal(res, '/my-project/build/contracts');
    });
  });

  describe('getContractsDir', () => {
    it('should return contracts dir of the project path', () => {
      const res = trufstuf.getContractsDir('/my-project');
      assert.equal(res, '/my-project/contracts');
    });
  });

  describe('getMythReportsDir', () => {
    it('should return path to mythx reports', () => {
      const res = trufstuf.getMythReportsDir('/my-project/build/contracts');
      assert.equal(res, '/my-project/build/mythx');
    });
  });
});
