const {expect, test} = require('@oclif/test')

describe('projects:get', () => {
  test
  .stdout()
  .command(['projects:get'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['projects:get', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
