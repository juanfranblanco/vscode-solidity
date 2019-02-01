import * as assert from 'assert';
import * as mockRequire from 'mock-require';
import { versionJSON2String, getFormatter } from '../../../src/analysis/mythx/util';


describe ('analysis.mythx.util', () => {
  describe('versionJSON2String', () => {
    it('should stringify JSON version object', () => {
      const mythxVersionJSON = {
        api: 'v1.2.2',
        maru: 'v0.2.0',
        mythx: 'v0.19.7',
      };

      const result = versionJSON2String(mythxVersionJSON);
      assert.equal(result, 'api: v1.2.2, maru: v0.2.0, mythx: v0.19.7');
    });
  });

  describe('getFormatter', () => {
    afterEach(() => {
      mockRequire.stopAll();
    });

    it('should import formatter module', () => {
      mockRequire('eslint/lib/formatters/stylish', () => 'mock module');
      const res = getFormatter('stylish');
      assert.equal(res(), 'mock module');
    });

    it('should import formatter module', () => {
      assert.throws(() => getFormatter('fail'));
    });
  });
});
