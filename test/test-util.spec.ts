import { versionJSON2String } from '../src/analysis/mythril/util';
import { expect } from 'chai' ;
import 'mocha';

describe ( 'versionJSON2String', () => {
    it('should stringify JSON version object', () => {
	const mythrilVersionJSON = {
	    "api": "v1.2.2",
	    "maru": "v0.2.0",
	    "mythril": "v0.19.7"
	};
	const result = versionJSON2String(mythrilVersionJSON);
	expect(result).to.equal('api: v1.2.2, maru: v0.2.0, mythril: v0.19.7');
    })
});
