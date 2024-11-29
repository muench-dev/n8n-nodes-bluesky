import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { AtpAgent, CredentialSession } from '@atproto/api';
import { getAuthorFeedDescription } from './getAuthorFeedDescription';

import { operationProperties } from './operationDescription';
import { postDescription, postOperationProperties } from './postDescription';
import { getProfileDescription, getProfileOperationProperties } from './getProfileDescription';


export class Bluesky implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bluesky',
		name: 'bluesky',
		icon: 'file:bluesky.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] }}',
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
			...operationProperties,
			...getProfileOperationProperties,
			...postOperationProperties,
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
				const feedData = await getAuthorFeedDescription(agent, credentials.identifier);
				returnData.push(...feedData);
			} else if (operation === 'getProfile') {
				const actor = this.getNodeParameter('actor', i) as string;
				const profileData = await getProfileDescription(agent, actor);
				returnData.push(...profileData);
			} else if (operation === 'post') {
				const postText = this.getNodeParameter('postText', i) as string;
				const langs = this.getNodeParameter('langs', i) as string[];
				const postData = await postDescription(agent, postText, langs);
				returnData.push(...postData);
			}
		}

		return [returnData];
	}
}
