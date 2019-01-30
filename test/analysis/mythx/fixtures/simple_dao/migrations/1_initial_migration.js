/* eslint no-undef: 0 */  // --> OFF
var Migrations = artifacts.require('./Migrations.sol');

module.exports = function(deployer) {
    deployer.deploy(Migrations);
};
