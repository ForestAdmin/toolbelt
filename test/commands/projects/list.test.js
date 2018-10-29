const {expect, test} = require('@oclif/test')

describe('projects:list', () => {
  test
  .stdout()
  .command(['projects:list'])
  .it('should returns the projects\' list.', ctx => {
    expect(ctx.stdout).to.contain('PROJECTS');
    expect(ctx.stdout).to.contain('ID');
    expect(ctx.stdout).to.contain('NAME');
    expect(ctx.stdout).to.contain('82');
    expect(ctx.stdout).to.contain('Forest');
  })
})
