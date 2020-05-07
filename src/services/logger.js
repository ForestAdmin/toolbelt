const chalk = require('chalk');

class Logger {
  constructor(silent) {
    this.silent = silent;
    this.spinner = null;
  }

  pauseSpinner() {
    if (this.spinner) {
      this.spinner.pause();
    }
  }

  continueSpinner() {
    if (this.spinner) {
      this.spinner.continue();
    }
  }

  log(message, std) {
    if (!this.silent) {
      if (std === 'err') {
        process.stderr.write(message);
      } else {
        process.stdout.write(message);
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

module.exports = new Logger();
