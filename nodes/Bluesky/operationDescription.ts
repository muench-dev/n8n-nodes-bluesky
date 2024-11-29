import { INodeProperties } from 'n8n-workflow';


export const operationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Get Author Feed',
				value: 'getAuthorFeed',
				description: 'Retrieve user feed',
				action: 'Retrieve user feed',
			},
			{
				name: 'Get Profile',
				value: 'getProfile',
				description: 'Get detailed profile view of an actor',
				action: 'Get detailed profile view of an actor',
			},
			{
				name: 'Create a Post',
				value: 'post',
				description: 'Create a new post',
				action: 'Post a status update to bluesky',
			},
		],
		default: 'post',
	}
]
