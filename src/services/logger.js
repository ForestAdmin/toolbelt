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

  log(message, std) {
    if (!this.silent) {
      if (std === 'err') {
        this.stderr.write(message);
      } else {
        this.stdout.write(message);
      }
    }
  }

  logLine(color, message, std) {
    this.log(`${chalk[color]('>')} ${message} \n`, std);
  }

  logLines(color, messages, std = 'out') {
    messages.forEach((message) => this.logLine(color, message, std));
  }

  success(...messages) { this.logLines('green', messages); }

  info(...messages) { this.logLines('blue', messages); }

  warn(...messages) { this.logLines('yellow', messages); }

  error(...messages) { this.logLines('red', messages, 'err'); }
}

module.exports = Logger;
