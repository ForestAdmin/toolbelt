const {expect, test} = require('@oclif/test')

describe('environments:create', () => {
  test
  .stdout()
  .command(['environments:create'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['environments:create', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
