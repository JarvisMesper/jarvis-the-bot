'use strict';
var fs = require('fs');
fs.createReadStream('.sample-env')
  .pipe(fs.createWriteStream('.env'));

console.log('Now edit the .env file with the credentials. See ya later !');