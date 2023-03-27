const Context = require('@forestadmin/context');
const EnvironmentManager = require('../../src/services/environment-manager');
const defaultPlan = require('../../src/context/plan');

describe('services > EnvironmentManager', () => {
  const buildManager = () => {
    // we must init the context for enable the dependency injection
    Context.init(defaultPlan);

    return new EnvironmentManager({});
  };
  describe('handleEnvironmentError', () => {
    describe('when the error is unknown', () => {
      it('should return the receives error', () => {
        expect.assertions(1);
        const error = new Error('error');
        const result = buildManager().handleEnvironmentError(error);
        expect(result).toBe('error');
      });
    });

    describe('when the error is a 403 Forbidden', () => {
      it('should return a forbidden error', () => {
        expect.assertions(1);
        const error = new Error('Forbidden');
        const result = buildManager().handleEnvironmentError(error);
        expect(result).toBe(
          'You do not have the permission to perform this action on the given environments.',
        );
      });
    });
  });
});
