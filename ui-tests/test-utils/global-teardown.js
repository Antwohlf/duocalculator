const { stopServer } = require('./server');

module.exports = async () => {
  await stopServer();
};
