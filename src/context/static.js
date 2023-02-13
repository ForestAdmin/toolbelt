const path = require('path');

const Context = require('@forestadmin/context');

const staticPlan = plan => plan.addModule('path', path);

let staticContext;

const init = () => {
  if (!staticContext) {
    staticContext = Context.execute(staticPlan);
  }
  return staticContext;
};

module.exports = {
  init,
};
