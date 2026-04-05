import { INodeProperties } from 'n8n-workflow';

export const resourcesProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Analytics',
			value: 'analytics',
		},
		{
			name: 'Feed',
			value: 'feed',
		},
		{
			name: 'Graph',
			value: 'graph',
		},
		{
			name: 'List',
			value: 'list',
		},
		{
			name: 'Post',
			value: 'post',
		},
		{
			name: 'Search',
			value: 'search',
		},
		{
			name: 'User',
			value: 'user',
		},
	],
	default: 'post',
};
