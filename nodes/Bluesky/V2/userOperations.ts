import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { AppBskyActorGetProfile, AppBskyGraphMuteActor, AppBskyGraphUnmuteActor, AtpAgent } from '@atproto/api';

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
			{
				name: 'Un-Mute User',
				value: 'unmute',
				description: 'Muting a user hides their posts from your feeds',
				action: 'Un mute a user',
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
				operation: ['mute', 'unmute'],
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
];

export async function muteOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const muteResponse: AppBskyGraphMuteActor.Response = await agent.mute(did);

	returnData.push({
		json: (muteResponse as Object),
	} as INodeExecutionData);

	return returnData;
}


export async function unmuteOperation(agent: AtpAgent, did: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const unmuteResponse: AppBskyGraphUnmuteActor.Response = await agent.unmute(did);

	returnData.push({
		json: (unmuteResponse as Object),
	} as INodeExecutionData);

	return returnData;
}

export async function getProfileOperation(agent: AtpAgent, actor: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const profileResponse: AppBskyActorGetProfile.Response = await agent.getProfile({
		actor: actor,
	});

	returnData.push({
		json: profileResponse.data,
	} as INodeExecutionData);

	return returnData;
}

