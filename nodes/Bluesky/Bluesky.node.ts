import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { BlueskyV1 } from './V1/BlueskyV1.node';
import { BlueskyV2 } from './V2/BlueskyV2.node';

export class Bluesky extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Bluesky',
			name: 'bluesky',
			icon: 'file:bluesky.svg',
			group: ['transform'],
			subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
			description: 'Interact with the Bluesky social platform',
			defaultVersion: 2.1,
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new BlueskyV1(baseDescription),
			2: new BlueskyV2(baseDescription),
			2.1: new BlueskyV2(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
