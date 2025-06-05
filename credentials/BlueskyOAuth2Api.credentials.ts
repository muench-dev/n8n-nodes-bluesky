// TODO: Update placeholder URLs and scopes once the correct information is found.

import { IAuthOAuth2, ICredentialType, NodePropertyTypes } from 'n8n-workflow';

export class BlueskyOAuth2Api implements ICredentialType {
	name = 'blueskyOAuth2Api';
	displayName = 'Bluesky OAuth2 API';
	documentationUrl = 'https://github.com/MarynaCherniavska/n8n-nodes-bluesky/blob/main/README.md'; // TODO: update with actual documentation URL
	properties = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden' as NodePropertyTypes,
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'string' as NodePropertyTypes,
			default: 'https://bsky.social/oauth/authorize', // Placeholder
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'string' as NodePropertyTypes,
			default: 'https://bsky.social/oauth/token', // Placeholder
			required: true,
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string' as NodePropertyTypes,
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string' as NodePropertyTypes,
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string' as NodePropertyTypes,
			default: 'read write profile feed', // Common scopes
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden' as NodePropertyTypes,
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden' as NodePropertyTypes,
			default: 'body',
		},
	];
	authenticate = {
		type: 'oauth2',
		oAuth2Options: {
			includeCredentialsOnRefresh: true,
			authCodeGrantType: 'authorizationCode',
			pkce: true, // Enable PKCE
		},
	} as IAuthOAuth2;
}
