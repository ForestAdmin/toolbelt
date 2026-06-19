import type { LayoutScope } from '../../../src/services/layout/types';

import {
  LayoutFileError,
  parseLayoutFile,
  serializeLayoutFile,
} from '../../../src/services/layout/layout-file';

const scope: LayoutScope = {
  environmentId: 10,
  environmentName: 'Development',
  projectId: 7,
  projectName: 'Acme',
  serverUrl: 'https://api.forestadmin.com',
  teamId: 20,
  teamName: 'Operations',
};

const now = () => new Date('2026-06-16T10:00:00.000Z');

describe('layout file (de)serialization', () => {
  it('round-trips the documents and scope header', () => {
    expect.assertions(2);
    const layout = {
      collections: [{ displayName: 'Clients', id: 'customers' }],
      dashboards: [],
      sections: [],
    };

    const content = serializeLayoutFile(scope, { layout }, now);
    const { docs, scope: parsed } = parseLayoutFile(content);

    expect(docs.layout).toStrictEqual(layout);
    expect(parsed).toStrictEqual({
      environmentId: 10,
      environmentName: 'Development',
      projectId: 7,
      projectName: 'Acme',
      serverUrl: 'https://api.forestadmin.com',
      teamId: 20,
      teamName: 'Operations',
    });
  });

  it('writes pretty-printed JSON with a trailing newline', () => {
    expect.assertions(2);
    const content = serializeLayoutFile(scope, { layout: {} }, now);
    expect(content.endsWith('\n')).toBe(true);
    expect(JSON.parse(content).forest.version).toBe(1);
  });

  it('throws a LayoutFileError when the forest header is missing', () => {
    expect.assertions(1);
    expect(() => parseLayoutFile('{ "layout": { "collections": [] } }')).toThrow(LayoutFileError);
  });

  it('throws a LayoutFileError on invalid JSON', () => {
    expect.assertions(1);
    expect(() => parseLayoutFile('{ unbalanced')).toThrow(LayoutFileError);
  });
});
