import {
	ApplicationError,
	INodeType,
	INodeTypeBaseDescription,
	IVersionedNodeType,
} from 'n8n-workflow';
import { LoggerProxy as Logger, VersionedNodeType } from 'n8n-workflow';

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

	override getNodeType(version?: number): INodeType {
		if (version === undefined) {
			return super.getNodeType();
		}

		const requestedNode = this.nodeVersions[version];
		if (requestedNode) {
			return requestedNode;
		}

		const fallbackVersion = this.getLatestVersion();
		Logger.warn('Requested Bluesky node version is not available, falling back to latest version', {
			nodeName: this.description.name,
			requestedVersion: version,
			fallbackVersion,
		});

		const fallbackNode = this.nodeVersions[fallbackVersion];
		if (!fallbackNode) {
			throw new ApplicationError('Bluesky node has no available versions to fall back to.');
		}

		// Cache the fallback under the requested version so subsequent lookups reuse it without logging
		this.nodeVersions[version] = fallbackNode;

		return fallbackNode;
	}
}
