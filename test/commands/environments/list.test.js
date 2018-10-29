const {expect, test} = require('@oclif/test')

describe('environments:list', () => {
  test
  .stdout()
  .command(['environments:list', '-p', '82'])
  .it('should returns the environments\' list of the Forest project', ctx => {
    expect(ctx.stdout).to.contain('ENVIRONMENTS');
    expect(ctx.stdout).to.contain('ID');
    expect(ctx.stdout).to.contain('NAME');
    expect(ctx.stdout).to.contain('URL');
    expect(ctx.stdout).to.contain('TYPE');
    expect(ctx.stdout).to.contain('Production');
    expect(ctx.stdout).to.contain('production');
    expect(ctx.stdout).to.contain('http://localhost:3001');
    expect(ctx.stdout).to.contain('Development');
    expect(ctx.stdout).to.contain('development');
  })

  test
  .stdout()
  .command(['environments:list'])
  .exit(2)
  .it('should fails because of the missing required option -p', ctx => {
  })
})
