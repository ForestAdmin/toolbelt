const { execute, makeDotWrite } = require('@forestadmin/context');
const defaultPlan = require('../../src/context/default-plan');

describe('show context graph', () => {
  it('show default graph', () => {
    expect.assertions(0);
    execute([
      defaultPlan,
      (plan) => plan.addMetadataHook(makeDotWrite(__dirname, '.generated', 'default-plan-graph.dot')),
    ]);
  });
});
