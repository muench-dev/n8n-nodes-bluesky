import { INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';
import {
	AppBskyActorGetProfile,
	AppBskyGraphGetFollowers,
	AppBskyGraphGetFollows,
	AppBskyGraphMuteActor,
	AppBskyGraphUnmuteActor,
	AtpAgent,
	AtUri,
} from '@atproto/api';

export const userProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['user'],
			},
		},
		options: [
			{
				name: 'Block User',
				value: 'block',
				description:
					'Blocking a user prevents interaction and hides the user from the client experience',
				action: 'Block a user',
			},
			{
				name: 'Get Profile',
				value: 'getProfile',
				description: 'Get detailed profile view of an actor',
				action: 'Get detailed profile view of an actor',
			},
			{
				name: 'List All Followers',
				value: 'listAllFollowers',
				description: 'Get all followers of a user with automatic pagination',
				action: 'List all followers',
			},
			{
				name: 'List All Follows',
				value: 'listAllFollows',
				description: 'Get all accounts a user is following with automatic pagination',
				action: 'List all follows',
			},
			{
				name: 'Mute User',
				value: 'mute',
				description: 'Muting a user hides their posts from your feeds',
				action: 'Mute a user',
			},
			{
				name: 'Un-Block User',
				value: 'unblock',
				description:
					'Unblocking a user restores interaction and shows the user in the client experience',
				action: 'Unblock a user',
			},
			{
				name: 'Un-Mute User',
				value: 'unmute',
				description: 'Remove mute status from a user',
				action: 'Unmute a user',
			},
		],
		default: 'getProfile',
	},
	{
		displayName: 'Did',
		name: 'did',
		type: 'string',
		default: '',
		required: true,
		description: 'The DID of the user',
		hint: 'The getProfile operation can be used to get the DID of a user',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['mute', 'unmute', 'block'],
			},
		},
	},
	{
		displayName: 'Actor',
		name: 'actor',
		type: 'string',
		default: '',
		required: true,
		description: 'Handle or DID of account to fetch profile of',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['getProfile'],
			},
		},
	},
	{
		displayName: 'Handle',
		name: 'handle',
		type: 'string',
		default: '',
		required: true,
		description: 'Handle or DID of the actor to list',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['listAllFollowers', 'listAllFollows'],
			},
		},
	},
	{
		displayName: 'Max Results',
		name: 'maxResults',
		type: 'number',
		default: 1000,
		typeOptions: {
			minValue: 1,
		},
		description: 'Maximum number of results to fetch',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['listAllFollowers', 'listAllFollows'],
			},
		},
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		default: 100,
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		description: 'Number of results to fetch per API request',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['listAllFollowers', 'listAllFollows'],
			},
		},
	},
	{
		displayName: 'Uri',
		name: 'uri',
		type: 'string',
		description: 'The URI of the user block record',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['unblock'],
			},
		},
	},
];

export async function muteOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const muteResponse: AppBskyGraphMuteActor.Response = await agent.mute(did);

	return [
		{
			json: {
				did,
				success: muteResponse.success !== undefined ? muteResponse.success : true,
			} as IDataObject,
		},
	];
}

export async function unmuteOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const unmuteResponse: AppBskyGraphUnmuteActor.Response = await agent.unmute(did);

	return [
		{
			json: {
				did,
				success: unmuteResponse.success !== undefined ? unmuteResponse.success : true,
			} as IDataObject,
		},
	];
}

export async function getProfileOperation(
	agent: AtpAgent,
	actor: string,
): Promise<INodeExecutionData[]> {
	const profileResponse: AppBskyActorGetProfile.Response = await agent.getProfile({
		actor,
	});

	return [
		{
			json: profileResponse.data as unknown as IDataObject,
		},
	];
}

export async function blockOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const { uri } = await agent.app.bsky.graph.block.create(
		{ repo: agent.session!.did },
		{
			subject: did,
			createdAt: new Date().toISOString(),
		},
	);

	return [
		{
			json: {
				uri,
			},
		},
	];
}

export async function unblockOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	const { rkey } = new AtUri(uri);

	await agent.app.bsky.graph.block.delete({
		repo: agent.session!.did,
		rkey,
	});

	return [
		{
			json: {
				uri,
			},
		},
	];
}

export async function listAllFollowersOperation(
	agent: AtpAgent,
	handle: string,
	maxResults = 1000,
	pageSize = 100,
): Promise<INodeExecutionData[]> {
	let total = 0;
	let cursor: string | undefined;
	const results: IDataObject[] = [];

	while (total < maxResults) {
		const response: AppBskyGraphGetFollowers.Response = await agent.app.bsky.graph.getFollowers({
			actor: handle,
			limit: Math.min(pageSize, maxResults - total),
			...(cursor ? { cursor } : {}),
		});

		const followers = (response.data.followers ?? []) as unknown as IDataObject[];
		results.push(...followers);
		total += followers.length;

		if (!response.data.cursor || followers.length === 0) {
			break;
		}

		cursor = response.data.cursor;
	}

	return results.slice(0, maxResults).map((follower) => ({ json: follower }));
}

export async function listAllFollowsOperation(
	agent: AtpAgent,
	handle: string,
	maxResults = 1000,
	pageSize = 100,
): Promise<INodeExecutionData[]> {
	let total = 0;
	let cursor: string | undefined;
	const results: IDataObject[] = [];

	while (total < maxResults) {
		const response: AppBskyGraphGetFollows.Response = await agent.app.bsky.graph.getFollows({
			actor: handle,
			limit: Math.min(pageSize, maxResults - total),
			...(cursor ? { cursor } : {}),
		});

		const follows = (response.data.follows ?? []) as unknown as IDataObject[];
		results.push(...follows);
		total += follows.length;

		if (!response.data.cursor || follows.length === 0) {
			break;
		}

		cursor = response.data.cursor;
	}

	return results.slice(0, maxResults).map((follow) => ({ json: follow }));
}
