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
  if (hostname) {
    return true;
  }
  return 'Please specify the application hostname.';
}

export function validateDbName(dbName: string): string | true {
  if (dbName) {
    return true;
  }
  return 'Please specify the database name.';
}

const MAX_DATABASE_ID = 2147483647;

export function validateOrganizationId(id: string): string | true {
  if (/^[1-9]\d*$/.test(id) && Number(id) <= MAX_DATABASE_ID) {
    return true;
  }
  return 'The organization must be a positive integer id, like 42.';
}
