const superagent = require('superagent');

class EventSender {
  constructor({ assertPresent, env }) {
    assertPresent({ env });
    this.env = env;

    this.applicationName = null;
    this.command = null;
  }

  async notifyError(code = 'unknown_error', message = null, context = undefined) {
    if (!this.applicationName || !this.command) { return; }

    try {
      await superagent.post(`${this.env.FOREST_URL}/api/lumber/error`, {
        data: {
          type: 'events',
          attributes: {
            code,
            message,
            project_name: this.applicationName,
            command: this.command,
            context,
          },
        },
      });
    } catch (e) {
      // NOTICE: We want silent error because this is just for reporting error
      //         and not not blocking if that does not work.
    }
  }

  async notifySuccess() {
    if (!this.applicationName || !this.command) { return; }

    try {
      await superagent.post(`${this.env.FOREST_URL}/api/lumber/success`, {
        data: {
          type: 'events',
          attributes: {
            command: this.command,
            project_name: this.applicationName,
          },
        },
      });
    } catch (e) {
      // NOTICE: We want silent error because this is just for reporting error
      //         and not not blocking if that does not work.
    }
  }
}

module.exports = EventSender;
