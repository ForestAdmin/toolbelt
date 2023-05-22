export function validatePort(port: string): string | true {
  if (!/^\d+$/.test(port)) {
    return 'The port must be a number.';
  }

  const parsedPort = parseInt(port, 10);
  if (parsedPort > 0 && parsedPort < 65536) {
    return true;
  }
  return 'This is not a valid port.';
}

export function validateAppHostname(hostname: string): string | true {
  if (!/^https?:\/\/.*/i.test(hostname)) {
    return 'Application hostname must be a valid url.';
  }
  if (!/^http((s:\/\/.*)|(s?:\/\/(localhost|127\.0\.0\.1).*))/i.test(hostname)) {
    return 'HTTPS protocol is mandatory, except for localhost and 127.0.0.1.';
  }
  return true;
}

export function validateDbName(dbName: string): string | true {
  if (dbName) {
    return true;
  }
  return 'Please specify the database name.';
}
