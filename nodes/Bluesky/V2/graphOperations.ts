import { AtpAgent } from '@atproto/api';
import { INodeExecutionData, INodeProperties } from 'n8n-workflow';

export const graphProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['graph'],
			},
		},
		options: [
			{
				name: 'Mute Thread',
				value: 'muteThread',
				description: 'Mute a conversation thread',
				action: 'Mute a thread',
			},
		],
		default: 'muteThread',
	},
	{
		displayName: 'Thread URI',
		name: 'uri',
		type: 'string',
		default: '',
		required: true,
		description: 'AT URI of the root post to mute',
		displayOptions: {
			show: {
				resource: ['graph'],
				operation: ['muteThread'],
			},
		},
	},
];

export async function muteThreadOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	await agent.app.bsky.graph.muteThread({ root: uri });

	return [{ json: { uri, muted: true } }];
}
