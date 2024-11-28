import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { Agent } from '@atproto/api';
import { NodeOAuthClient, OAuthClient } from '@atproto/oauth-client-node';

export class Bluesky implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bluesky',
		name: 'bluesky',
		icon: 'file:bluesky.svg',
		group: ['transform'],
		version: 1,
		description: 'Interact with the Bluesky social platform',
		defaults: {
			name: 'Bluesky',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'blueskyOAuthApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Post Update',
						value: 'postUpdate',
					},
				],
				default: 'postUpdate',
			},
			{
				displayName: 'Status Text',
				name: 'statusText',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['postUpdate'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Load credentials
		const credentials = await this.getCredentials('blueskyOAuthApi') as {
			clientId: string;
			clientSecret: string;
			redirectUri: string;
			sessionId: string; // Replace or adapt based on how you store/restoration session
		};

		const operation = this.getNodeParameter('operation', 0) as string;

		// Instantiate OAuthClient
		const oauthClient = new NodeOAuthClient({
			clientMetadata: {
				client_id: credentials.clientId,
			}
			clientSecret: credentials.clientSecret,
			redirectUri: credentials.redirectUri,
		});

		// Restore OAuth session
		const oauthSession = await oauthClient.restore(credentials.sessionId);

		// Instantiate the API Agent
		const agent = new Agent(oauthSession);

		for (let i = 0; i < items.length; i++) {
			if (operation === 'postUpdate') {
				const statusText = this.getNodeParameter('statusText', i) as string;

				// Post an update using the Agent
				const record = {
					text: statusText,
				};

				const result = await agent.post(record);

				returnData.push({ json: result });
			}
		}

		return [returnData];
	}
}
