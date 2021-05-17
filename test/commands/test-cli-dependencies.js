/**
 * @param {import('../../src/context/application-context')} applicationContext
 */
function mockDependencies(applicationContext) {
  applicationContext.replace('realOpen', jest.fn());
}

module.exports = { mockDependencies };
