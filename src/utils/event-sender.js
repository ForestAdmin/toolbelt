class EventSender {
  constructor({ assertPresent, env, superagent }) {
    assertPresent({ env, superagent });
    this.env = env;
    this.superagent = superagent;

    this.applicationName = null;
    this.command = null;
    this.meta = null;
    this.sessionToken = null;
  }

  async notifyError(code = 'unknown_error', message = null, context = undefined) {
    if (!this.applicationName || !this.command) {
      return;
    }

    const attributes = {
      code,
      message,
      project_name: this.applicationName,
      command: this.command,
      context,
    };

    if (this.command !== 'schema:update') {
      attributes.project_id = this.meta.projectId || null;
      attributes.db_dialect = this.meta.dbDialect;
      attributes.agent = this.meta.agent;
      attributes.is_local = this.meta.isLocal;
    }

    try {
      if (this.sessionToken) {
        await this.superagent
          .post(`${this.env.FOREST_SERVER_URL}/api/lumber/error`, {
            data: {
              type: 'events',
              attributes,
            },
          })
          .set('Authorization', `Bearer ${this.sessionToken}`);
      } else {
        await this.superagent.post(`${this.env.FOREST_SERVER_URL}/api/lumber/error`, {
          data: {
            type: 'events',
            attributes,
          },
        });
      }
    } catch (e) {
      // NOTICE: We want silent error because this is just for reporting error
      //         and not not blocking if that does not work.
    }
  }

  async notifySuccess() {
    if (
      !this.applicationName ||
      !this.command ||
      !this.sessionToken ||
      !Object.keys(this.meta).length
    ) {
      return;
    }

    try {
      await this.superagent
        .post(`${this.env.FOREST_SERVER_URL}/api/lumber/success`, {
          data: {
            type: 'events',
            attributes: {
              command: this.command,
              project_id: this.meta.projectId,
              project_name: this.applicationName,
              db_dialect: this.meta.dbDialect,
              agent: this.meta.agent,
              is_local: this.meta.isLocal,
            },
          },
        })
        .set('Authorization', `Bearer ${this.sessionToken}`);
    } catch (e) {
      // NOTICE: We want silent error because this is just for reporting error
      //         and not not blocking if that does not work.
    }
  }
}

module.exports = EventSender;
