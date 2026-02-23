import { INodeProperties } from 'n8n-workflow';

export const credentialTypeProperty: INodeProperties = {
	displayName: 'Credential Type',
	name: 'credentialType',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Bluesky appPassword',
			value: 'appPassword',
		},
		{
			name: 'Bluesky OAuth2 API',
			value: 'oAuth2',
		},
	],
	default: 'appPassword',
}
