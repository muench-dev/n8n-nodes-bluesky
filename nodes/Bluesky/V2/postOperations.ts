import { AppBskyFeedPost, AtpAgent, RichText } from '@atproto/api';
import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { getLanguageOptions } from './languages';

export const postProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['post'],
			},
		},
		options: [
			{
				name: 'Create a Post',
				value: 'post',
				description: 'Create a new post',
				action: 'Post a status update to bluesky',
			},
		],
		default: 'post',
	},
	{
		displayName: 'Post Text',
		name: 'postText',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post'],
			},
		},
	},
	{
		displayName: 'Language Names or IDs',
		name: 'langs',
		type: 'multiOptions',
		description: 'Choose from the list of supported languages. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		options: getLanguageOptions(),
		default: ['en'],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post'],
			},
		},
	},
];

export async function postOperations(agent: AtpAgent, postText: string, langs: string[]): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	let rt = new RichText({
		text: postText,
	});

	await rt.detectFacets(agent);

	let postData = {
		text: rt.text,
		langs: langs,
		facets: rt.facets,
	} as AppBskyFeedPost.Record & Omit<AppBskyFeedPost.Record, 'createdAt'>;

	const postResponse: { uri: string; cid: string } = await agent.post(postData);

	returnData.push({
		json: {
			uri: postResponse.uri,
			cid: postResponse.cid,
		},
	});
	return returnData;
}
