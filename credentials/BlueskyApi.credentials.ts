import { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
import { Icon } from 'n8n-workflow/dist/Interfaces';

export class BlueskyApi implements ICredentialType {
	displayName = 'Bluesky API';
	name = 'blueskyApi';
	documentationUrl = 'https://atproto.com/docs';
	icon = 'node:@muench-dev/n8n-nodes-bluesky.bluesky' as Icon;

	properties: INodeProperties[] = [
		{
			displayName: 'Identifier (Handle)',
			name: 'identifier',
			description: 'The handle of the user account',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'App Password',
			name: 'appPassword',
			description: 'The password for the app',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Service URL',
			name: 'serviceUrl',
			description: 'The URL of the atp service',
			type: 'string',
			default: 'https://bsky.social',
			required: true,
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serviceUrl}}',
			url: '/xrpc/com.atproto.server.createSession',
			method: 'POST',
			json: true,
			body: {
				identifier: '={{$credentials.identifier}}',
				password: '={{$credentials.appPassword}}',
			},
		},
	};
}
