// TODO: Update placeholder URLs and scopes once the correct information is found.

import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class BlueskyOAuth2Api implements ICredentialType {
	name = 'blueskyOAuth2Api';
	extends = ['oAuth2Api'];
	displayName = 'Bluesky OAuth2 API';
	documentationUrl = 'https://docs.bsky.app/docs/advanced-guides/oauth-client';
	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'string',
			default: 'https://bsky.social/oauth/authorize', // Placeholder
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'string',
			default: 'https://bsky.social/oauth/token', // Placeholder
			required: true,
		},
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
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default: 'read write profile feed', // Common scopes
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
