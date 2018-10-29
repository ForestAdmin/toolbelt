const {expect, test} = require('@oclif/test')

describe('environments:get', () => {
  test
  .stderr()
  .command(['environments:get', '4382', '-p', '82'])
  .it('should returns a Not Found error.', ctx => {
    expect(ctx.stderr).to.contain('Cannot find the environment 4382 on the project 82');
  });

  test
  .stderr()
  .command(['environments:get', '10272', '-p', '9823'])
  .it('should returns a Not Found error.', ctx => {
    expect(ctx.stderr).to.contain('Cannot find the environment 10272 on the project 9823');
  });
})
