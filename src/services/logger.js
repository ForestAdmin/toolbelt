const chalk = require('chalk');

class Logger {
  constructor({
    assertPresent,
    env,
    stderr,
    stdout,
  }) {
    assertPresent({ env, stderr, stdout });
    this.env = env;
    this.stderr = stderr;
    this.stdout = stdout;

    this.allowedOptionKeys = [
      'color',
      'prefix',
      'std',
      'lineColor',
    ];

    // FIXME: Silent was not used before as no "silent" value was in context.
    this.silent = !!this.env.SILENT && this.env.SILENT !== '0';
  }

  _logLine(message, options) {
    if (this.silent) return;

    options = {
      ...Object.fromEntries(this.allowedOptionKeys.map((key) => [key, undefined])),
      ...options,
    };

    let actualPrefix = '';
    if ([undefined, null, ''].indexOf(options.prefix) === -1) actualPrefix = `${options.prefix} `;
    if (actualPrefix && options.color) {
      actualPrefix = Logger._setBoldColor(options.color, actualPrefix);
    }

    let actualMessage = Logger._castMessage(message);
    if (options.lineColor) {
      actualMessage = `${Logger._setColor(options.lineColor, actualMessage)}`;
    }

    actualMessage = `${actualPrefix}${actualMessage}\n`;

    if (options.std === 'err') {
      this.stderr.write(actualMessage);
    } else {
      this.stdout.write(actualMessage);
    }
  }

  _logLines(messagesWithPotentialGivenOptions, baseOptions) {
    const { options, messages } = Logger._extractGivenOptionsFromMessages(
      messagesWithPotentialGivenOptions, this.allowedOptionKeys,
    );
    messages.forEach((message) => this._logLine(message, { ...baseOptions, ...options }));
  }

  static _castMessage(message) {
    if (typeof message === 'object') {
      return JSON.stringify(message);
    }

    return message;
  }

  static _setColor(color, message) {
    return chalk[color](message);
  }

  static _setBoldColor(color, message) {
    return chalk.bold[color](message);
  }

  static _isObjectKeysMatchAlwaysTheGivenKeys(object, keys) {
    if (typeof object !== 'object') {
      return false;
    }

    return Object.keys(object).every((key) => keys.includes(key));
  }

  // this method is a hack to keep the signature of all existing public methods.
  static _extractGivenOptionsFromMessages(messages, allowedOptions) {
    let options = {};
    const potentialGivenOptions = messages[messages.length - 1];

    const isOptions = (object) => Logger._isObjectKeysMatchAlwaysTheGivenKeys(
      object, allowedOptions,
    );
    if (isOptions(potentialGivenOptions)) {
      options = { ...options, ...potentialGivenOptions };
      return { messages: messages.slice(0, -1), options };
    }
    return { messages, options };
  }

  /**
   *  examples:
   *  loggerInstance.success('message to display')
   *  loggerInstance.success('message to display', { color: 'blue', colorLine: 'green' })
   *  loggerInstance.success('message 1', 'message 2')
   *  loggerInstance.success('message 1', 'message 2',  { color: 'blue', colorLine: 'green' })
   */

  error(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'red', prefix: '×', std: 'err' }); }

  info(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'blue', prefix: '>' }); }

  log(...messagesAndOptions) { this._logLines(messagesAndOptions); }

  success(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'green', prefix: '√' }); }

  warn(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'yellow', prefix: 'Δ' }); }
}

module.exports = Logger;
