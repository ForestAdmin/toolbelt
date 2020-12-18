/**
 * @param {*} Class
 * @returns {string}
 */
function getInstanceName(Class) {
  const className = Class.name;
  return className.charAt(0).toLowerCase() + className.slice(1);
}

/**
 * @template TContext
 */
class ApplicationContext {
  constructor() {
    /** @type {TContext} */
    // @ts-ignore
    this.context = {};
  }

  /**
   * @param {(ApplicationContext) => void} servicesBuilder
   */
  init(servicesBuilder) {
    if (!servicesBuilder) throw new Error('missing services builder');

    servicesBuilder(this);
  }

  /**
   * @returns {TContext}
   */
  inject() {
    return this.context;
  }

  /**
   * @param {*} Class
   * @param {boolean} [overrides]
   * @returns {this}
   */
  addClass(Class, overrides) {
    if (overrides) throw new Error('overrides are forbidden in application-context. Use test-application-context.js');

    const instanceName = getInstanceName(Class);
    if (this.context[instanceName]) throw new Error(`existing class instance ${instanceName} in context`);
    this.context[instanceName] = new Class(this.context);

    return this;
  }

  /**
   * @param {string} name
   * @param {*} instance
   * @returns {this}
   */
  addInstance(name, instance) {
    if (this.context[name]) throw new Error(`existing instance { key: '${name}'} in context`);
    this.context[name] = instance;
    return this;
  }

  /**
   * This function is meant to be used only in tests, when some
   * dependencies need to be mocked but not all
   * @param {string} name
   * @param {*} newInstance
   * @returns {this}
   */
  replaceInstance(name, newInstance) {
    if (!this.context[name]) throw new Error(`the instance { key: '${name}'} cannot be replaced because it is not defined`);
    this.context[name] = newInstance;
    return this;
  }

  /**
   * @param {string} name
   * @param {(param: any) => void} work
   * @returns {this}
   */
  with(name, work) {
    work(this.context[name]);
    return this;
  }

  /**
   * No differences with addInstance for the moment, but we want to distinguish calls for clarity.
   * @param {string} name
   * @param {*} value
   * @returns {this}
   */
  addValue(name, value) {
    return this.addInstance(name, value);
  }

  /**
   * No differences with addInstance for the moment, but we want to distinguish calls for clarity.
   * @param {string} name
   * @param {Function} value
   * @returns {this}
   */
  addFunction(name, value) {
    return this.addInstance(name, value);
  }

  reset() {
    // @ts-ignore
    this.context = {};
  }
}

module.exports = ApplicationContext;
