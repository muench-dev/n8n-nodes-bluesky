import { AtpAgent } from '@atproto/api';
import { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

export const searchProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['search'],
			},
		},
		options: [
			{
				name: 'Search Posts',
				value: 'searchPosts',
				description: 'Search for posts by keywords',
				action: 'Search posts',
			},
			{
				name: 'Search Users',
				value: 'searchUsers',
				description: 'Search for users by keywords',
				action: 'Search users',
			},
		],
		default: 'searchUsers',
	},
	{
		displayName: 'Search Query',
		name: 'q',
		type: 'string',
		default: '',
		required: true,
		description: 'Search query string',
		displayOptions: {
			show: {
				resource: ['search'],
				operation: ['searchPosts', 'searchUsers'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['search'],
				operation: ['searchPosts', 'searchUsers'],
			},
		},
	},
	{
		displayName: 'Author Handle',
		name: 'author',
		type: 'string',
		default: '',
		description: 'Only return posts by this author handle or DID',
		displayOptions: {
			show: {
				resource: ['search'],
				operation: ['searchPosts'],
			},
		},
	},
];

export async function searchUsersOperation(
	agent: AtpAgent,
	q: string,
	limit = 25,
): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.actor.searchActors({ q, limit });

	return (response.data.actors ?? []).map((actor) => ({
		json: actor as unknown as IDataObject,
	}));
}

export async function searchPostsOperation(
	agent: AtpAgent,
	q: string,
	limit = 25,
	author?: string,
): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.feed.searchPosts({
		q,
		limit,
		...(author ? { author } : {}),
	});

	return (response.data.posts ?? []).map((post) => ({
		json: post as unknown as IDataObject,
	}));
}
