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

    // FIXME: Silent was not used before as no "silent" value was in context.
    this.silent = !!this.env.SILENT && this.env.SILENT !== '0';
  }

  _logLine(message, options) {
    if (this.silent) return;

    options = {
      color: null,
      prefix: null,
      std: null,
      lineColor: null,
      ...options,
    };

    let actualPrefix = '';
    if ([undefined, null, ''].indexOf(options.prefix) === -1) actualPrefix = `${options.prefix} `;
    if (actualPrefix && options.color) {
      actualPrefix = Logger._setBoldColor(options.color, actualPrefix);
    }

    let actualMessage = message;
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
      messagesWithPotentialGivenOptions,
    );
    messages.forEach((message) => this._logLine(message, { ...baseOptions, ...options }));
  }

  static _setColor(color, message) {
    return chalk[color](message);
  }

  static _setBoldColor(color, message) {
    return chalk.bold[color](message);
  }

  // this method is a hack to keep the signature of all existing public methods.
  static _extractGivenOptionsFromMessages(messages) {
    let options = {};
    const potentialGivenOption = messages[messages.length - 1];

    if (typeof potentialGivenOption === 'object') {
      options = { ...options, ...potentialGivenOption };
      return { messages: messages.slice(0, -1), options };
    }
    return { messages, options };
  }

  error(...messages) { this._logLines(messages, { color: 'red', prefix: '×', std: 'err' }); }

  info(...messages) { this._logLines(messages, { color: 'blue', prefix: '>' }); }

  log(...messages) { this._logLines(messages); }

  success(...messages) { this._logLines(messages, { color: 'green', prefix: '√' }); }

  warn(...messages) { this._logLines(messages, { color: 'yellow', prefix: 'Δ' }); }
}

module.exports = Logger;
