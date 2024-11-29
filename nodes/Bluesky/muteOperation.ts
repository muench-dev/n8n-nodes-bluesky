import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { AppBskyActorGetProfile, AtpAgent } from '@atproto/api';

export const muteOperationProperties: INodeProperties[] = [
	{
		displayName: 'Did',
		name: 'did',
		type: 'string',
		default: '',
		required: true,
		description: 'The DID of the user to mute',
		hint: 'The getProfile operation can be used to get the DID of a user',
		displayOptions: {
			show: {
				operation: ['mute'],
			},
		},
	},
];

export async function muteOperation(agent: AtpAgent, actor: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const profileResponse: AppBskyActorGetProfile.Response = await agent.getProfile({
		actor: actor,
	});

	returnData.push({
		json: profileResponse.data,
	} as INodeExecutionData);

	return returnData;
}
