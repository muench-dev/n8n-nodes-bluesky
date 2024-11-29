import { AppBskyFeedPost, AtpAgent, RichText } from '@atproto/api';
import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { getLanguageOptions } from './languages';

export const postOperationProperties: INodeProperties[] = [
	{
		displayName: 'Post Text',
		name: 'postText',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
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
				operation: ['post'],
			},
		},
	},
];

export async function postDescription(agent: AtpAgent, postText: string, langs: string[]): Promise<INodeExecutionData[]> {
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
