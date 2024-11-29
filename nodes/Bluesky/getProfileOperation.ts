import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { AppBskyActorGetProfile, AtpAgent } from '@atproto/api';

export const getProfileOperationProperties: INodeProperties[] = [
	{
		displayName: 'Actor',
		name: 'actor',
		type: 'string',
		default: '',
		required: true,
		description: 'Handle or DID of account to fetch profile of',
		displayOptions: {
			show: {
				operation: ['getProfile'],
			},
		},
	},
];

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
