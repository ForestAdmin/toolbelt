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
      ...options,
    };

    let actualPrefix = '';
    if ([undefined, null, ''].indexOf(options.prefix) === -1) actualPrefix = `${options.prefix} `;
    if (actualPrefix && options.color) actualPrefix = chalk.bold[options.color](actualPrefix);

    const actualMessage = `${actualPrefix}${message} \n`;

    if (options.std === 'err') {
      this.stderr.write(actualMessage);
    } else {
      this.stdout.write(actualMessage);
    }
  }

  _logLines(messages, options) {
    messages.forEach((message) => this._logLine(message, options));
  }

  error(...messages) { this._logLines(messages, { color: 'red', prefix: '×', std: 'err' }); }

  info(...messages) { this._logLines(messages, { color: 'blue', prefix: '>' }); }

  log(...messages) { this._logLines(messages); }

  success(...messages) { this._logLines(messages, { color: 'green', prefix: '√' }); }

  warn(...messages) { this._logLines(messages, { color: 'yellow', prefix: 'Δ' }); }
}

module.exports = Logger;
