import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as mythx from '../../../src/analysis/mythx/mythx';
import * as srcmap from '../../../src/analysis/mythx/srcmap';

// const rewire = require('rewire');
// const rewired = rewire('../lib/issues2eslint');

const simpleDaoJsonPath = `${__dirname}/fixtures/simple_dao/build/contracts/SimpleDAO.json`;

describe('mythx.ts', () => {
  describe('truffle2MythXJSON', () => {
    it('should turn truffle contract json to mythx compatible object', done => {
      fs.readFile(simpleDaoJsonPath, 'utf8', (err, data) => {
        if (err) {
          return done(err);
        }

        const truffleJSON = JSON.parse(data);
        const mythXJSON = mythx.truffle2MythXJSON(truffleJSON);

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

  describe('MythXIssues class', () => {
    let truffleJSON;
    const sourceName = 'simple_dao.sol';

    beforeEach(done => {
        fs.readFile(simpleDaoJsonPath, 'utf8', (err, data) => {
            if (err) {
              return done(err);
            }
            truffleJSON = JSON.parse(data);
            done();
        });
    });

    it('should decode a source code location correctly', (done) => {
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        assert.deepEqual(issuesObject.textSrcEntry2lineColumn('30:2:0', issuesObject.lineBreakPositions[sourceName]),
            [ { line: 2, column: 27, beginLinePos: 3 }, { line: 2, column: 29, beginLinePos: 3 } ]);

        done();
    });

    it('should decode a bytecode offset correctly', (done) => {
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        assert.deepEqual(issuesObject.byteOffset2lineColumn('100', issuesObject.lineBreakPositions[sourceName]),
                         [ { line: 8, column: 0, beginLinePos: 195 }, { line: 25, column: 1, beginLinePos: 602 } ]);
        done();
    });

    it('should decode a bytecode offset to empty result', (done) => {
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        assert.deepEqual(issuesObject.byteOffset2lineColumn('50', issuesObject.lineBreakPositions[sourceName]),
                         [ { 'line': -1, 'column': 0 }, { } ]);
        done();
    });

    it('should convert MythX issue to Eslint style with sourceFormat: evm-byzantium-bytecode', () => {
        const mythXOutput = {
            'issues': [{
                'description': {
                    'head': 'Head message',
                    'tail': 'Tail message',
                },
                'locations': [{
                    'sourceMap': '444:1:0',
                }],
                'severity': 'High',
                'swcID': 'SWC-000',
                'swcTitle': 'Test Title',
            }],
            'meta': {
                'error': [],
                'selected_compiler': '0.5.0',
                'warning': [],
            },
            'sourceFormat': 'evm-byzantium-bytecode',
            'sourceList': [
                `/tmp/contracts/${sourceName}`,
            ],
            'sourceType': 'raw-bytecode',
        };

        const remappedMythXOutput = mythx.remapMythXOutput(mythXOutput);
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const res = issuesObject.issue2EsLint(remappedMythXOutput[0].issues[0], false, 'evm-byzantium-bytecode', sourceName);

        assert.deepEqual({
            column: 4,
            endCol: 27,
            endLine: 12,
            fatal: false,
            head: 'Head message',
            line: 12,
            markedText: '',
            message: 'Head message Tail message',
            mythXseverity: 'High',
            ruleId: 'SWC-000',
            severity: 2,
            sourceMap: '444:1:0',
            swcID: 'SWC-000',
            swcTitle: 'Test Title',
            tail: 'Tail message',
        },
        res);
    });

    it('should convert MythX issue to Eslint style with sourceFormat: text', () => {
        const mythXOutput = {
            'issues': [{
                'description': {
                    'head': 'Head message',
                    'tail': 'Tail message',
                },
                'locations': [{
                    'sourceMap': '310:23:0',
                }],
                'severity': 'High',
                'swcID': 'SWC-000',
                'swcTitle': 'Test Title',
            }],
            'meta': {
                'error': [],
                'selected_compiler': '0.5.0',
                'warning': [],
            },
            'sourceFormat': 'text',
            'sourceList': [
                `/tmp/contracts/${sourceName}`,
            ],
            'sourceType': 'solidity-file',
        };

        const remappedMythXOutput = mythx.remapMythXOutput(mythXOutput);
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const res = issuesObject.issue2EsLint(remappedMythXOutput[0].issues[0], false, 'text', sourceName);

        assert.deepEqual({
            column: 4,
            endCol: 27,
            endLine: 12,
            fatal: false,
            head: 'Head message',
            line: 12,
            markedText: '    credit[to] += msg.value;\n    ^^^^^^^^^^^^^^^^^^^^^^^',
            message: 'Head message Tail message',
            mythXseverity: 'High',
            ruleId: 'SWC-000',
            severity: 2,
            sourceMap: '310:23:0',
            swcID: 'SWC-000',
            swcTitle: 'Test Title',
            tail: 'Tail message',
        }, res);
    });

    it('should call isIgnorable correctly', () => {
        const spyIsVariableDeclaration = sinon.spy(srcmap, 'isVariableDeclaration');
        const spyIsDynamicArray = sinon.spy(srcmap, 'isDynamicArray');
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const res = issuesObject.isIgnorable('444:5:0', {}, sourceName);
        assert.ok(spyIsVariableDeclaration.called);
        assert.ok(spyIsDynamicArray.called);
        assert.ok(spyIsDynamicArray.returned(false));
        assert.equal(res, false);

        spyIsVariableDeclaration.restore();
        spyIsDynamicArray.restore();
    });

    it('should call isIgnorable correctly when issue is ignored', () => {
        const spyIsVariableDeclaration = sinon.spy(srcmap, 'isVariableDeclaration');
        const spyIsDynamicArray = sinon.stub(srcmap, 'isDynamicArray');
        spyIsDynamicArray.returns(true);
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const res = issuesObject.isIgnorable('444:5:0', {}, sourceName);
        assert.ok(spyIsVariableDeclaration.called);
        assert.ok(spyIsDynamicArray.called);
        assert.ok(res);
        spyIsVariableDeclaration.restore();
        spyIsDynamicArray.restore();
    });

    it('should call isIgnorable correctly when issue is ignored in debug mode', () => {
        const spyIsVariableDeclaration = sinon.spy(srcmap, 'isVariableDeclaration');
        const spyIsDynamicArray = sinon.stub(srcmap, 'isDynamicArray');
        const loggerStub = sinon.stub();
        spyIsDynamicArray.returns(true);
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const res = issuesObject.isIgnorable('444:5:0',  { debug: true, logger: { log: loggerStub } }, sourceName);
        assert.ok(spyIsVariableDeclaration.called);
        assert.ok(spyIsDynamicArray.called);
        assert.ok(loggerStub.called);
        assert.ok(res);
        spyIsVariableDeclaration.restore();
        spyIsDynamicArray.restore();
    });

    it('should convert mythX report to Eslint issues', () => {
        const mythXOutput = {
            'issues': [{
                'description': {
                    'head': 'Head message',
                    'tail': 'Tail message',
                },
                'locations': [{
                    'sourceMap': '310:23:0',
                }],
                'severity': 'High',
                'swcID': 'SWC-000',
                'swcTitle': 'Test Title',
            }],
            'meta': {
                'error': [],
                'selected_compiler': '0.5.0',
                'warning': [],
            },
            'sourceFormat': 'text',
            'sourceList': [
                `/tmp/contracts/${sourceName}`,
            ],
            'sourceType': 'solidity-file',
        };

        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const remappedMythXOutput = mythx.remapMythXOutput(mythXOutput);
        const result = remappedMythXOutput.map(output => issuesObject.convertMythXReport2EsIssue(output, true));

        assert.deepEqual(result, [{
            errorCount: 1,
            filePath: '/tmp/contracts/simple_dao.sol',
            fixableErrorCount: 0,
            fixableWarningCount: 0,
            messages: [{
                column: 4,
                endCol: 27,
                endLine: 12,
                fatal: false,
                head: 'Head message',
                line: 12,
                markedText: '    credit[to] += msg.value;\n    ^^^^^^^^^^^^^^^^^^^^^^^',
                message: 'Head message',
                mythXseverity: 'High',
                ruleId: 'SWC-000',
                severity: 2,
                sourceMap: '310:23:0',
                swcID: 'SWC-000',
                swcTitle: 'Test Title',
                tail: 'Tail message',
            }],
            warningCount: 0,
        }]);
    });

    it('It normalize and store mythX API output', () => {
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const mythXOutput = [{
            'issues': [{
                'description': {
                    'head': 'Head message',
                    'tail': 'Tail message',
                },
                'locations': [{
                    'sourceMap': '310:23:0',
                }],
                'severity': 'High',
                'swcID': 'SWC-000',
                'swcTitle': 'Test Title',
            }],
            'meta': {
                'error': [],
                'selected_compiler': '0.5.0',
                'warning': [],
            },
            'sourceFormat': 'text',
            'sourceList': [
                `/tmp/contracts/${sourceName}`,
            ],
            'sourceType': 'solidity-file',
        }];

        issuesObject.setIssues(mythXOutput);
        assert.deepEqual(issuesObject.issues, [{
            'issues': [{
                'description': {
                    'head': 'Head message',
                    'tail': 'Tail message',
                },
                'extra': undefined,
                'severity': 'High',
                'sourceMap': '310:23:0',
                'swcID': 'SWC-000',
                'swcTitle': 'Test Title',
            }],
            'source': '/tmp/contracts/simple_dao.sol',
            'sourceFormat': 'text',
            'sourceType': 'solidity-file',
        }]);
    });

    it('It converts mythX issues to ESLint issues output format', () => {
        const issuesObject = new mythx.MythXIssues(truffleJSON);
        const mythXOutput = [{
            'issues': [{
                'description': {
                    'head': 'Head message',
                    'tail': 'Tail message',
                },
                'locations': [{
                    'sourceMap': '310:23:0',
                }],
                'severity': 'High',
                'swcID': 'SWC-000',
                'swcTitle': 'Test Title',
            }],
            'meta': {
                'error': [],
                'selected_compiler': '0.5.0',
                'warning': [],
            },
            'sourceFormat': 'text',
            'sourceList': [
                `/tmp/contracts/${sourceName}`,
            ],
            'sourceType': 'solidity-file',
        }];
        issuesObject.setIssues(mythXOutput);
        const result = issuesObject.getEslintIssues(true);
        assert.deepEqual(result, [{
            errorCount: 1,
            filePath: '/tmp/contracts/simple_dao.sol',
            fixableErrorCount: 0,
            fixableWarningCount: 0,
            messages: [{
                column: 4,
                endCol: 27,
                endLine: 12,
                fatal: false,
                head: 'Head message',
                line: 12,
                markedText: '    credit[to] += msg.value;\n    ^^^^^^^^^^^^^^^^^^^^^^^',
                message: 'Head message',
                mythXseverity: 'High',
                ruleId: 'SWC-000',
                severity: 2,
                sourceMap: '310:23:0',
                swcID: 'SWC-000',
                swcTitle: 'Test Title',
                tail: 'Tail message',
            }],
            warningCount: 0,
        }]);
    });
  });
});
