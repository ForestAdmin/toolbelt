/**
 * @param {import('../../src/context/application-context')} applicationContext
 */
function mockDependencies(applicationContext) {
  applicationContext.replaceInstance('realOpen', jest.fn());
}

module.exports = { mockDependencies };
