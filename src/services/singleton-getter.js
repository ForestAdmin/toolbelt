const singletonGetter = () => {
  const instances = {};

  // NOTICE: be careful here: constructorParameters will only be used on the init.
  return (InputClass, constructorParameters) => {
    if (!instances[InputClass]) {
      instances[InputClass] = new InputClass(constructorParameters);
    }

    return instances[InputClass];
  };
};

module.exports = singletonGetter();
