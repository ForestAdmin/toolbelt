/**
 * Single source of truth for the diff engine:
 *  - the rule tree describing how each patchable property of the canonical
 *    documents maps to a JSON Patch path;
 *  - a mirror of the server's whitelisted patch patterns (matchesWhitelist),
 *    used to pre-validate every generated op before sending.
 *
 * Mirrored from forestadmin-server make-layout-patch-patterns.ts (+ folder and
 * workflow patterns).
 */
import type { LayoutDomain } from './types';

export type ScalarRule = {
  kind: 'scalar';
  premiumPack?: string;
  prop: string;
};

export type OpaqueRule = {
  kind: 'opaque';
  premiumPack?: string;
  prop: string;
};

export type KeyedArrayRule = {
  addable?: boolean;
  /** Fill write-required fields the rendering read omits (only when absent), so an `add` passes the server validator. */
  addDefaults?: (value: Record<string, unknown>) => Record<string, unknown>;
  // eslint-disable-next-line no-use-before-define -- Rule is a recursive union over the *Rule types
  children: Rule[];
  /** When add/remove of items is detected, replace the whole array instead. */
  fallbackReplaceWhole?: boolean;
  kind: 'keyedArray';
  premiumPack?: string;
  prop: string;
  removable?: boolean;
  /** Path segment template under the parent, e.g. 'layout/segments'. */
  segment: string;
  /**
   * Name of a boolean flag marking a server-managed singleton (e.g. the main
   * folder's `isMain`): the local and remote items carrying it are matched to each
   * other regardless of `id`/`name`, so the singleton is never recreated/removed
   * across environments (its `id` is per-environment).
   */
  singletonFlag?: string;
  /** Keys stripped from the value sent in an `add` op. */
  stripOnAdd?: string[];
};

/** A nested object (e.g. viewEdit): children apply under a fixed path segment. */
export type ObjectRule = {
  // eslint-disable-next-line no-use-before-define -- Rule is a recursive union over the *Rule types
  children: Rule[];
  kind: 'object';
  prop: string;
  segment: string;
};

export type Rule = KeyedArrayRule | ObjectRule | OpaqueRule | ScalarRule;

const scalar = (prop: string, extra: Partial<ScalarRule> = {}): ScalarRule => ({
  kind: 'scalar',
  prop,
  ...extra,
});
const opaque = (prop: string, extra: Partial<OpaqueRule> = {}): OpaqueRule => ({
  kind: 'opaque',
  prop,
  ...extra,
});

/** Return an addDefaults fn that fills the given keys only when absent. */
const withDefaults =
  (defaults: Record<string, unknown>) =>
  (value: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...value };
    Object.entries(defaults).forEach(([key, fallback]) => {
      if (out[key] === undefined) out[key] = fallback;
    });

    return out;
  };

/**
 * Segment write-shape: the rendering read omits `defaultSortingFieldName` and
 * `columns` (both required by the server's segment validator), and manual
 * segments require `filter`/`query` keys to be present (null allowed) while
 * smart segments forbid them.
 */
function segmentAddDefaults(value: Record<string, unknown>): Record<string, unknown> {
  const out = withDefaults({
    columns: [],
    defaultSortingFieldName: null,
    defaultSortingFieldOrder: null,
    hasColumnsConfiguration: false,
    icon: null,
    isVisible: true,
    position: 0,
    type: 'manual',
  })(value);

  if (out.type !== 'smart') {
    if (out.filter === undefined) out.filter = null;
    if (out.query === undefined) out.query = null;
  }

  return out;
}

/** Chart properties (viewEdit and dashboards) — editable scalars; clear one by setting it to `null`. */
const CHART_PROPS: Rule[] = [
  'name',
  'type',
  'aggregator',
  'aggregateFieldName',
  'filter',
  'query',
  'apiVersion',
  'sourceCollectionId',
  'groupByFieldName',
  'timeRange',
  'limit',
  'labelFieldName',
  'relationshipFieldName',
  'numeratorChartId',
  'denominatorChartId',
  'objective',
  'displaySettings',
  'description',
  'subTitle',
].map(prop => scalar(prop));

const SEGMENT_RULE: KeyedArrayRule = {
  addable: true,
  children: [
    scalar('name'),
    scalar('position'),
    scalar('isVisible'),
    opaque('filter'),
    {
      children: [scalar('position'), scalar('isVisible')],
      fallbackReplaceWhole: true,
      kind: 'keyedArray',
      prop: 'columns',
      segment: 'columns',
    },
  ],
  addDefaults: segmentAddDefaults,
  kind: 'keyedArray',
  premiumPack: 'scopes',
  prop: 'segments',
  removable: true,
  segment: 'segments',
};

/** Children of a collection's `layout` object (canonical: collection.layout.*). */
const COLLECTION_LAYOUT_RULE: ObjectRule = {
  children: [
    {
      children: [scalar('position'), scalar('isVisible')],
      kind: 'keyedArray',
      prop: 'columns',
      segment: 'columns',
    },
    {
      children: [
        scalar('displayName'),
        scalar('description'),
        scalar('isReadOnly'),
        scalar('isFilterDisplayed'),
        scalar('isDissociateDisplayed'),
        opaque('widgetEdit'),
        opaque('widgetDisplay'),
        opaque('mappingValues'),
        opaque('conditionalFormatting'),
      ],
      kind: 'keyedArray',
      prop: 'fields',
      segment: 'fields',
    },
    SEGMENT_RULE,
    {
      children: [
        scalar('position'),
        scalar('isVisible'),
        scalar('displayName'),
        opaque('confirmation'),
        opaque('segments'),
        scalar('buttonType'),
      ],
      kind: 'keyedArray',
      prop: 'actions',
      segment: 'actions',
    },
    {
      children: [
        opaque('summaryView'),
        {
          addable: true,
          children: CHART_PROPS,
          kind: 'keyedArray',
          prop: 'charts',
          removable: true,
          segment: 'charts',
          stripOnAdd: [],
        },
      ],
      kind: 'object',
      prop: 'viewEdit',
      segment: 'viewEdit',
    },
  ],
  kind: 'object',
  prop: 'layout',
  segment: 'layout',
};

const COLLECTION_RULES: Rule[] = [
  scalar('displayName'),
  scalar('displayNamePlural'),
  scalar('icon'),
  scalar('restrictedToSegments'),
  scalar('defaultSortingOrder'),
  scalar('defaultSortingFieldName'),
  scalar('displayFieldName'),
  COLLECTION_LAYOUT_RULE,
];

/**
 * Workspaces (and their components) — addressed by id (the route's
 * `:collectionId` param receives the workspace/component id). Component `type` is
 * add-only (set on creation); `name`, `displaySettings`, `visibility` and
 * `options` are editable, matching the server whitelist. `options` is deep and
 * polymorphic (filter, visibleColumns, collectionId…), so it is kept opaque and
 * replaced as a whole when it changes.
 */
const WORKSPACE_RULE: KeyedArrayRule = {
  addable: true,
  addDefaults: withDefaults({ collectionId: null, components: [], icon: '🗂️', position: 0 }),
  children: [
    scalar('name'),
    scalar('icon'),
    scalar('position'),
    {
      addable: true,
      children: [
        scalar('name'),
        opaque('displaySettings'),
        opaque('visibility'),
        opaque('options'),
      ],
      kind: 'keyedArray',
      prop: 'components',
      removable: true,
      segment: 'components',
    },
  ],
  kind: 'keyedArray',
  prop: 'workspaces',
  removable: true,
  segment: 'workspaces',
};

/**
 * Inboxes — premium-gated. `type`, `dispatchRule`, `sortingFields`,
 * `collectionId` and `segmentId` are add-only (set on creation, not
 * replaceable); the rest are editable scalars.
 */
const INBOX_RULE: KeyedArrayRule = {
  addable: true,
  addDefaults: withDefaults({ canUsersReassign: false, position: 0 }),
  children: [
    scalar('name'),
    scalar('icon'),
    scalar('position'),
    scalar('folder'),
    scalar('tasksLimit'),
    scalar('canUsersReassign'),
    opaque('unassignAfter'),
  ],
  kind: 'keyedArray',
  premiumPack: 'inbox',
  prop: 'inboxes',
  removable: true,
  segment: 'inboxes',
};

export type DomainRules = {
  /** Rules of the document root. */
  root: Rule[];
};

export const DOMAIN_RULES: Record<LayoutDomain, DomainRules> = {
  folders: {
    root: [
      {
        addable: true,
        children: [
          scalar('name'),
          scalar('icon'),
          {
            addable: true,
            children: [
              scalar('position'),
              scalar('isVisible'),
              {
                addable: true,
                children: [scalar('position'), scalar('isVisible')],
                kind: 'keyedArray',
                prop: 'subChildren',
                removable: true,
                segment: 'subChildren',
              },
            ],
            kind: 'keyedArray',
            prop: 'children',
            removable: true,
            segment: 'children',
          },
        ],
        kind: 'keyedArray',
        prop: '',
        removable: true,
        segment: 'folders',
        singletonFlag: 'isMain',
      },
    ],
  },
  layout: {
    root: [
      {
        children: COLLECTION_RULES,
        kind: 'keyedArray',
        prop: 'collections',
        segment: 'collections',
      },
      {
        addable: true,
        children: [
          scalar('name'),
          scalar('icon'),
          scalar('position'),
          {
            addable: true,
            children: CHART_PROPS,
            kind: 'keyedArray',
            prop: 'charts',
            removable: true,
            segment: 'charts',
            stripOnAdd: [],
          },
        ],
        addDefaults: withDefaults({ charts: [], icon: null, position: 0 }),
        kind: 'keyedArray',
        premiumPack: 'multipleDashboards',
        prop: 'dashboards',
        removable: true,
        segment: 'dashboards',
      },
      WORKSPACE_RULE,
      INBOX_RULE,
      opaque('sections'),
    ],
  },
  workflows: {
    root: [
      {
        addable: true,
        // `collectionId` is required on add but is not a replaceable path, so it is
        // carried in the add value (passed through) rather than declared as a child.
        addDefaults: withDefaults({ isVisible: true, position: 0, segmentIds: [] }),
        children: [
          scalar('name'),
          scalar('position'),
          scalar('isVisible'),
          opaque('segmentIds'),
          scalar('bpmnAwsS3Identifier'),
        ],
        kind: 'keyedArray',
        prop: '',
        removable: true,
        segment: 'workflows',
        // `steps` is authoring input compiled to BPMN out-of-band, never sent in the shell patch.
        stripOnAdd: ['steps'],
      },
    ],
  },
};

/* --------------------------- whitelist mirror ---------------------------- */

// Same id classes as the server's patch-handler.
const ID = String.raw`[^/\s:]+`;
const NUM_OR_UUID = String.raw`([0-9]+|[0-9a-fA-F-]{36})`;

type WhitelistEntry = { ops: Array<'add' | 'remove' | 'replace' | 'test'>; pattern: RegExp };

function entry(ops: WhitelistEntry['ops'], path: string): WhitelistEntry {
  return { ops, pattern: new RegExp(`^${path}$`) };
}

const COLLECTION_SCALARS = [
  'displayName',
  'displayNamePlural',
  'icon',
  'restrictedToSegments',
  'defaultSortingOrder',
  'defaultSortingFieldName',
  'displayFieldName',
].join('|');

const FIELD_PROPS = [
  'displayName',
  'description',
  'isReadOnly',
  'isFilterDisplayed',
  'isDissociateDisplayed',
  'widgetEdit',
  'widgetDisplay',
  'mappingValues',
  'conditionalFormatting',
].join('|');

const ACTION_PROPS = [
  'position',
  'isVisible',
  'displayName',
  'confirmation',
  'segments',
  'buttonType',
].join('|');

const CHART_PROP_NAMES = [
  'name',
  'type',
  'aggregator',
  'aggregateFieldName',
  'filter',
  'query',
  'apiVersion',
  'sourceCollectionId',
  'groupByFieldName',
  'timeRange',
  'limit',
  'labelFieldName',
  'relationshipFieldName',
  'numeratorChartId',
  'denominatorChartId',
  'objective',
  'displaySettings',
  'description',
  'subTitle',
].join('|');

const WHITELIST: Record<LayoutDomain, WhitelistEntry[]> = {
  folders: [
    entry(['add'], `/folders/-`),
    entry(['remove'], `/folders/${NUM_OR_UUID}`),
    entry(['replace'], `/folders/${NUM_OR_UUID}/(name|icon)`),
    entry(['add'], `/folders/${NUM_OR_UUID}/children/-`),
    entry(['remove'], `/folders/${NUM_OR_UUID}/children/${ID}`),
    entry(['replace'], `/folders/${NUM_OR_UUID}/children/${ID}/(position|isVisible)`),
    entry(['add'], `/folders/${NUM_OR_UUID}/children/${ID}/subChildren/-`),
    entry(['remove'], `/folders/${NUM_OR_UUID}/children/${ID}/subChildren/${ID}`),
    entry(
      ['replace'],
      `/folders/${NUM_OR_UUID}/children/${ID}/subChildren/${ID}/(position|isVisible)`,
    ),
  ],
  layout: [
    entry(['replace'], `/collections/${ID}/(${COLLECTION_SCALARS})`),
    entry(['replace'], `/collections/${ID}/layout/columns/${ID}/(position|isVisible)`),
    entry(['replace'], `/collections/${ID}/layout/fields/${ID}/(${FIELD_PROPS})`),
    entry(['add'], `/collections/${ID}/layout/segments/-`),
    entry(['remove'], `/collections/${ID}/layout/segments/${ID}`),
    entry(
      ['replace'],
      `/collections/${ID}/layout/segments/${ID}/(name|position|isVisible|filter|columns)`,
    ),
    entry(
      ['replace'],
      `/collections/${ID}/layout/segments/${ID}/columns/${ID}/(position|isVisible)`,
    ),
    entry(['replace'], `/collections/${ID}/layout/actions/${ID}/(${ACTION_PROPS})`),
    entry(['replace'], `/collections/${ID}/layout/viewEdit/summaryView`),
    entry(['add'], `/collections/${ID}/layout/viewEdit/charts/-`),
    entry(['remove', 'replace'], `/collections/${ID}/layout/viewEdit/charts/${NUM_OR_UUID}`),
    entry(
      ['remove', 'replace'],
      `/collections/${ID}/layout/viewEdit/charts/${NUM_OR_UUID}/(${CHART_PROP_NAMES})`,
    ),
    entry(
      ['replace'],
      `/collections/${ID}/layout/viewEdit/rows/${ID}/(position|isVisible|explorerConfiguration)`,
    ),
    entry(['replace'], `/collections/${ID}/layout/viewCreate/rows/${ID}/(position|isVisible)`),
    entry(['add'], `/collections/${ID}/layout/viewLists/-`),
    entry(['remove'], `/collections/${ID}/layout/viewLists/${ID}`),
    entry(
      ['replace'],
      `/collections/${ID}/layout/viewLists/${ID}/(name|position|recordsPerPage|allowJavascript)`,
    ),
    entry(['replace'], `/collections/${ID}/layout/scope`),
    entry(['add'], `/dashboards/-`),
    entry(['remove'], `/dashboards/${NUM_OR_UUID}`),
    entry(['replace'], `/dashboards/${NUM_OR_UUID}/(name|icon|position)`),
    entry(['add'], `/dashboards/${NUM_OR_UUID}/charts/-`),
    entry(['remove', 'replace'], `/dashboards/${NUM_OR_UUID}/charts/${NUM_OR_UUID}`),
    entry(
      ['remove', 'replace'],
      `/dashboards/${NUM_OR_UUID}/charts/${NUM_OR_UUID}/(${CHART_PROP_NAMES})`,
    ),
    entry(['add'], `/workspaces/-`),
    entry(['remove'], `/workspaces/${ID}`),
    entry(['replace'], `/workspaces/${ID}/(name|icon|position)`),
    entry(['add'], `/workspaces/${ID}/components/-`),
    entry(['remove'], `/workspaces/${ID}/components/${NUM_OR_UUID}`),
    entry(
      ['replace'],
      `/workspaces/${ID}/components/${NUM_OR_UUID}/(name|displaySettings|visibility|options)`,
    ),
    entry(['add'], `/inboxes/-`),
    entry(['remove'], `/inboxes/${NUM_OR_UUID}`),
    entry(['replace'], `/inboxes/${NUM_OR_UUID}/${ID}`),
    entry(['replace'], `/sections`),
  ],
  workflows: [
    entry(['add'], `/workflows/-`),
    entry(['remove'], `/workflows/${NUM_OR_UUID}`),
    entry(
      ['replace'],
      `/workflows/${NUM_OR_UUID}/(name|position|isVisible|segmentIds|bpmnAwsS3Identifier)`,
    ),
  ],
};

/** True when an op matches the mirrored server whitelist for this domain. */
export function matchesWhitelist(domain: LayoutDomain, op: { op: string; path: string }): boolean {
  return WHITELIST[domain].some(
    candidate =>
      candidate.ops.includes(op.op as WhitelistEntry['ops'][number]) &&
      candidate.pattern.test(op.path),
  );
}
