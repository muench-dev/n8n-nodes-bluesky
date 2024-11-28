import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BlueskyOAuthApi implements ICredentialType {
	name = 'blueskyOAuthApi';
	displayName = 'Bluesky OAuth API';
	documentationUrl = 'https://atproto.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'string',
			default: 'https://bsky.social/xrpc/com.atproto.server.createSession',
		},
		{
			displayName: 'Authorize URL',
			name: 'authorizeUrl',
			type: 'string',
			default: 'https://bsky.social/xrpc/com.atproto.server.createSession',
		},
		{
			displayName: 'Redirect URL',
			name: 'redirectUri',
			type: 'string',
			default: '',
			required: true,
		},
	];
}
