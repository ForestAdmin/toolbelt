import type { LayoutScope } from '../../../src/services/layout/types';

import {
  LayoutFileError,
  parseLayoutFile,
  serializeLayoutFile,
} from '../../../src/services/layout/yaml-file';

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

  it('writes the guidance header as a leading comment', () => {
    expect.assertions(1);
    const content = serializeLayoutFile(scope, { layout: {} }, now);
    expect(content.startsWith('# forest-layout.yml')).toBe(true);
  });

  it('throws a LayoutFileError when the forest header is missing', () => {
    expect.assertions(1);
    expect(() => parseLayoutFile('layout:\n  collections: []\n')).toThrow(LayoutFileError);
  });

  it('throws a LayoutFileError on invalid YAML', () => {
    expect.assertions(1);
    expect(() => parseLayoutFile(':\n  - [unbalanced')).toThrow(LayoutFileError);
  });
});
