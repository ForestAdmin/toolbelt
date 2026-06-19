import type { LayoutScope } from '../../../src/services/layout/types';

import Context from '@forestadmin/context';
import nock from 'nock';

import { LayoutApiError } from '../../../src/services/layout/errors';
import LayoutManager from '../../../src/services/layout/layout-manager';

const SERVER = 'http://localhost:3001';

const scope: LayoutScope = {
  environmentId: 10,
  environmentName: 'Production',
  projectId: 2,
  projectName: 'BaaSDemo',
  serverUrl: SERVER,
  teamId: 5,
  teamName: 'Ops',
};

describe('layoutManager', () => {
  // eslint-disable-next-line jest/no-hooks -- HTTP fixtures need per-test setup/teardown
  beforeEach(() => {
    Context.init(plan =>
      plan
        .addValue('env', { FOREST_SERVER_URL: SERVER })
        .addValue('authenticator', { getAuthToken: () => 'token' }),
    );
    nock.disableNetConnect();
  });

  // eslint-disable-next-line jest/no-hooks -- HTTP fixtures need per-test setup/teardown
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe('getRendering', () => {
    it('gETs the rendering by name with the scope headers', async () => {
      expect.assertions(1);
      const body = { data: { id: '42', type: 'renderings' } };
      nock(SERVER)
        .matchHeader('forest-project-id', '2')
        .matchHeader('forest-environment-id', '10')
        .matchHeader('forest-team-id', '5')
        .get('/api/renderings/BaaSDemo/Production/Ops')
        .reply(200, body);

      await expect(new LayoutManager().getRendering(scope)).resolves.toStrictEqual(body);
    });
  });

  describe('getLayoutDomain', () => {
    it('gETs a non-layout domain by name and returns its body', async () => {
      expect.assertions(1);
      nock(SERVER)
        .get('/api/folders/BaaSDemo/Production/Ops')
        .reply(200, [{ id: 1 }]);

      await expect(new LayoutManager().getLayoutDomain('folders', scope)).resolves.toStrictEqual([
        { id: 1 },
      ]);
    });
  });

  describe('patchDomain', () => {
    it('sends no request when there is nothing to patch', async () => {
      expect.assertions(1);
      // No nock interceptor + disableNetConnect: any HTTP call would throw.
      await expect(new LayoutManager().patchDomain('layout', [], scope)).resolves.toBeUndefined();
    });

    it('strips planner metadata, sending only op/path/value', async () => {
      expect.assertions(1);
      let sent: unknown;
      nock(SERVER)
        .patch('/api/layout', body => {
          sent = body;
          return true;
        })
        .reply(204);

      await new LayoutManager().patchDomain(
        'layout',
        [
          {
            op: 'replace',
            path: '/collections/x/displayName',
            value: 'A',
            domain: 'layout',
            label: 'l',
            yamlPath: 'y',
          },
          {
            op: 'remove',
            path: '/collections/x/segments/s',
            domain: 'layout',
            label: 'l',
            yamlPath: 'y',
          },
        ] as never,
        scope,
      );

      expect(sent).toStrictEqual([
        { op: 'replace', path: '/collections/x/displayName', value: 'A' },
        { op: 'remove', path: '/collections/x/segments/s' },
      ]);
    });

    it('normalizes a non-2xx response into a LayoutApiError', async () => {
      expect.assertions(2);
      nock(SERVER)
        .patch('/api/layout')
        .reply(403, { errors: [{ detail: 'forbidden' }] });

      const error = await new LayoutManager()
        .patchDomain('layout', [{ op: 'replace', path: '/x', value: 1 } as never], scope)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(LayoutApiError);
      expect((error as LayoutApiError).status).toBe(403);
    });
  });

  describe('uploadWorkflowBpmn', () => {
    it('asks for a presigned request, uploads to S3 and returns the version id', async () => {
      expect.assertions(1);
      nock(SERVER)
        .post('/api/workflows/wf1/generate-presigned-request')
        .query(true)
        .reply(200, { url: 'http://s3.local/bucket', fields: { key: 'k' } });
      nock('http://s3.local').post('/bucket').reply(204, '', { 'x-amz-version-id': 'v9' });

      await expect(
        new LayoutManager().uploadWorkflowBpmn(scope, 'wf1', 'coll', 7, '<bpmn/>'),
      ).resolves.toBe('v9');
    });

    it('throws when S3 does not return a version id', async () => {
      expect.assertions(1);
      nock(SERVER)
        .post('/api/workflows/wf1/generate-presigned-request')
        .query(true)
        .reply(200, { url: 'http://s3.local/bucket', fields: {} });
      nock('http://s3.local').post('/bucket').reply(204);

      await expect(
        new LayoutManager().uploadWorkflowBpmn(scope, 'wf1', 'coll', 7, '<bpmn/>'),
      ).rejects.toThrow('version id');
    });
  });
});
