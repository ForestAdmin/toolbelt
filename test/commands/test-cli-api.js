module.exports = {
  assertApi: (api) => {
    api.forEach((nock) => {
      nock.done();
    });
  },
};
