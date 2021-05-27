const { getInstance } = require('@forestadmin/context');

/**
 * @param {import('../../src/context/application-context')} applicationContext
 */
function mockDependencies() {
  try {
    getInstance()
      .replace('realOpen', jest.fn());
  } catch (error) {
    // no-op
  }
}

module.exports = { mockDependencies };
