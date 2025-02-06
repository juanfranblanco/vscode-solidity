When deploying the standalone server, or running it. The server.ts 
```const standAloneServerSide = true; ``` needs to set to true. Otherwise false.

This enables to load the default settings of the package.json, so if a user doesnt use the ones provided by their enviroment (ie nvim) it continues to work.

There is a pre-standalone-build that does this, and post-standalone-build that reverts it to normal.

These are run when publishing to NPM, but not when using vsce.


