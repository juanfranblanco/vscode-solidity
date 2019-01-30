import * as assert from 'assert';
import * as fs from 'fs';
import * as mythx from '../../../src/analysis/mythx/mythx';


describe('mythx.ts', () => {
  describe('truffle2MythXJSON', () => {
    it('should turn truffle contract json to mythx compatible object', done => {
      fs.readFile( `${__dirname}/fixtures/simple_dao/build/contracts/SimpleDAO.json`, 'utf8', (err, data) => {
        if (err) {
          return done(err);
        }

        const truffleJSON = JSON.parse(data);
        const mythXJSON = mythx.truffle2MythXJSON(truffleJSON, 'test-truffle-analyze');

        assert.deepEqual(mythXJSON,  {
          bytecode: truffleJSON.bytecode,
          contractName: truffleJSON.contractName,
          deployedBytecode: truffleJSON.deployedBytecode,
          deployedSourceMap: truffleJSON.deployedSourceMap,
          sourceList: [ truffleJSON.sourcePath ],
          sourceMap: truffleJSON.sourceMap,
          sources: {
            'simple_dao.sol': {
              ast: truffleJSON.ast,
              source: truffleJSON.source,
            },
          },
          toolId: 'test-truffle-analyze',
          version: truffleJSON.compiler.version,
        });
        done();
      });
    });

    it('should remap MythX Output object to array grouped by sourceLocation', () => {
      const mythXOutput = {
        'sourceFormat': 'text',
        'sourceList': [
            '/tmp/contracts/sol1.sol',
        ],
        'sourceType': 'solidity-file',
          'issues': [
            {
              'description': {
                'head': 'A floating pragma is set.',
                'tail': 'It is recommended to make a conscious choice on what version of Solidity is used for compilation. Currently any version equal or grater than "0.5.0" is allowed.'
              },
              'extra': {},
              'locations': [ { 'sourceMap': '0:23:0' } ],
              'severity': 'Low',
              'swcID': 'SWC-103',
              'swcTitle': 'Floating Pragma',
            },
            {
              'description': {
                'head': 'Dangerous use of uninitialized storage variables.',
                'tail': 'Uninitialized storage variables of user-defined type can point to unexpected storage locations. Initialize variable "upgraded" or set the storage attribute "memory".'
              },
              'extra': {},
                  'locations': [
                      { 'sourceMap': '400:19:0' },
                  ],
                  'severity': 'Low',
                  'swcID': 'SWC-109',
                  'swcTitle': 'Uninitialized Storage Pointer',
              },
          ],
          'meta': {
            'error': [],
            'selected_compiler': '0.5.0',
            'warning': [],
          },
      };

      const remapedOutput = mythx.remapMythXOutput(mythXOutput);
      assert.deepEqual(remapedOutput, [{
          issues: [{
              description: {
                head: 'A floating pragma is set.',
                tail: 'It is recommended to make a conscious choice on what version of Solidity is used for compilation. Currently any version equal or grater than "0.5.0" is allowed.',
              },
              extra: {},
              severity: 'Low',
              sourceMap: '0:23:0',
              swcID: 'SWC-103',
              swcTitle: 'Floating Pragma',
          }, {
              description: {
                head: 'Dangerous use of uninitialized storage variables.',
                tail: 'Uninitialized storage variables of user-defined type can point to unexpected storage locations. Initialize variable "upgraded" or set the storage attribute "memory".',
              },
              extra: {},
              severity: 'Low',
              sourceMap: '400:19:0',
              swcID: 'SWC-109',
              swcTitle: 'Uninitialized Storage Pointer',
          }],
          source: '/tmp/contracts/sol1.sol',
          sourceFormat: 'text',
          sourceType: 'solidity-file',
        }],
      );
  });
  });
});
