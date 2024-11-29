import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { AtpAgent, CredentialSession } from '@atproto/api';

import { resourcesProperty } from './resources';

// Operations
import { postOperations, postProperties } from './postOperations';
import { userOperations, muteOperation, userProperties, unmuteOperation } from './userOperations';
import { feedOperations, feedProperties  } from './feedOperations';


export class Bluesky implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bluesky',
		name: 'bluesky',
		icon: 'file:bluesky.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Bluesky social platform',
		defaults: {
			name: 'Bluesky',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'blueskyApi',
				required: true,
			},
		],
		properties: [
			resourcesProperty,
			...userProperties,
			...postProperties,
			...feedProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Load credentials
		const credentials = await this.getCredentials('blueskyApi') as {
			identifier: string;
			appPassword: string;
			serviceUrl: string;
		};

		const operation = this.getNodeParameter('operation', 0) as string;
		const serviceUrl = new URL(credentials.serviceUrl.replace(/\/+$/, '')); // Ensure no trailing slash

		const session = new CredentialSession(serviceUrl);
		const agent = new AtpAgent(session);
		await agent.login({
			identifier: credentials.identifier,
			password: credentials.appPassword,
		});

		for (let i = 0; i < items.length; i++) {
			if (operation === 'getAuthorFeed') {
				const feedData = await feedOperations(agent, credentials.identifier);
				returnData.push(...feedData);
			} else if (operation === 'getProfile') {
				const actor = this.getNodeParameter('actor', i) as string;
				const profileData = await userOperations(agent, actor);
				returnData.push(...profileData);
			} else if (operation === 'post') {
				const postText = this.getNodeParameter('postText', i) as string;
				const langs = this.getNodeParameter('langs', i) as string[];
				const postData = await postOperations(agent, postText, langs);
				returnData.push(...postData);
			} else if (operation === 'mute') {
				const did = this.getNodeParameter('did', i) as string;
				const muteData = await muteOperation(agent, did);
				returnData.push(...muteData);
			} else if (operation === 'unmute') {
				const did = this.getNodeParameter('did', i) as string;
				const unmuteData = await unmuteOperation(agent, did);
				returnData.push(...unmuteData);
			}
		}

		return [returnData];
	}
}
