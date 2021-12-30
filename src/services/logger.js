const chalk = require('chalk');

const ALLOWED_OPTION_KEYS = [
  'color',
  'prefix',
  'std',
  'lineColor',
];
const DEFAULT_OPTION_VALUES = Object.fromEntries(
  ALLOWED_OPTION_KEYS.map((key) => [key, undefined]),
);

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
      ...DEFAULT_OPTION_VALUES,
      ...options,
    };

    let actualPrefix = '';
    if ([undefined, null, ''].indexOf(options.prefix) === -1) actualPrefix = `${options.prefix} `;
    if (actualPrefix && options.color) {
      actualPrefix = Logger._setBoldColor(options.color, actualPrefix);
    }

    let actualMessage = Logger._stringifyIfObject(message);
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

  static _stringifyIfObject(message) {
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

  static _isObjectKeysMatchAlwaysTheGivenKeys(object) {
    if (typeof object !== 'object') {
      return false;
    }

    return Object.keys(object).every((key) => ALLOWED_OPTION_KEYS.includes(key));
  }

  // This is a hack to keep the current signature of Logger methods.
  // Last `message` is considered an option object if its keys are in `ALLOWED_OPTION_KEYS`.
  static _extractGivenOptionsFromMessages(messages) {
    let options = {};
    const potentialGivenOptions = messages[messages.length - 1];

    const isOptions = (object) => Logger._isObjectKeysMatchAlwaysTheGivenKeys(object);
    if (isOptions(potentialGivenOptions)) {
      options = { ...options, ...potentialGivenOptions };
      return { messages: messages.slice(0, -1), options };
    }
    return { messages, options };
  }

  /**
   *  Allows to log one ore more messages, with option object as last optional parameter.
   *  @example logger.log('message')
   *  @example logger.log('message', { color: 'blue', colorLine: 'green' })
   *  @example logger.log('message 1', 'message 2')
   *  @example logger.log('message 1', 'message 2',  { color: 'blue', colorLine: 'green' })
   */
  log(...messagesAndOptions) { this._logLines(messagesAndOptions); }

  error(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'red', prefix: '×', std: 'err' }); }

  info(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'blue', prefix: '>' }); }

  success(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'green', prefix: '√' }); }

  warn(...messagesAndOptions) { this._logLines(messagesAndOptions, { color: 'yellow', prefix: 'Δ' }); }
}

module.exports = Logger;
