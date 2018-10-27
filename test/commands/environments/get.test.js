const {expect, test} = require('@oclif/test')

describe('environments:get', () => {
  test
  .stdout()
  .command(['environments:get'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['environments:get', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
