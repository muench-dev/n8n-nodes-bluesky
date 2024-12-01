import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class BlueskyApi implements ICredentialType {
	displayName = 'Bluesky API';
	name = 'blueskyApi';
	documentationUrl = 'https://atproto.com/docs';

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
}
