const {expect, test} = require('@oclif/test')

describe('environments:delete', () => {
  test
  .stdout()
  .command(['environments:delete'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['environments:delete', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
