function mockDependencies(context) {
  try {
    context
      .replace('realOpen', jest.fn());
  } catch (error) {
    // no-op
  }
}

module.exports = { mockDependencies };
