import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import {
	AppBskyActorGetProfile,
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
				name: 'Mute User',
				value: 'mute',
				description: 'Muting a user hides their posts from your feeds',
				action: 'Mute a user',
			},
			/*
			Find an easy way to resolve the uri to provide a better user experience
			{
				name: 'Un-Block User',
				value: 'unblock',
				description: 'Unblocking a user restores interaction and shows the user in the client experience',
				action: 'Unblock a user',
			},*/
			{
				name: 'Un-Mute User',
				value: 'unmute',
				description: 'Muting a user hides their posts from your feeds',
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
		displayName: 'Uri',
		name: 'uri',
		type: 'string',
		description: 'The URI of the user',
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
	const returnData: INodeExecutionData[] = [];
	const muteResponse: AppBskyGraphMuteActor.Response = await agent.mute(did);

	returnData.push({
		json: muteResponse as Object,
	} as INodeExecutionData);

	return returnData;
}

export async function unmuteOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const unmuteResponse: AppBskyGraphUnmuteActor.Response = await agent.unmute(did);

	returnData.push({
		json: unmuteResponse as Object,
	} as INodeExecutionData);

	return returnData;
}

export async function getProfileOperation(
	agent: AtpAgent,
	actor: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const profileResponse: AppBskyActorGetProfile.Response = await agent.getProfile({
		actor: actor,
	});

	returnData.push({
		json: profileResponse.data,
	} as INodeExecutionData);

	return returnData;
}

export async function blockOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	const { uri } = await agent.app.bsky.graph.block.create(
		{ repo: agent.did }, // owner DID
		{
			subject: did, // DID of the user to block
			createdAt: new Date().toISOString(),
		},
	);

	returnData.push({
		json: {
			uri,
		},
	} as INodeExecutionData);

	return returnData;
}

export async function unblockOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const { rkey } = new AtUri(uri);

	await agent.app.bsky.graph.block.delete({
		repo: agent.did,
		rkey,
	});

	returnData.push({
		json: {
			uri,
		},
	} as INodeExecutionData);

	return returnData;
}
