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
			{
				name: 'Like a Post',
				value: 'like',
				action: 'Like a post',
			},
			{
				name: 'Unline a Post',
				value: 'deleteLike',
				action: 'Unlike a post',
			},
			{
				name: 'Repost a Post',
				value: 'repost',
				action: 'Unlike a post',
			}
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
	{
		displayName: 'Uri',
		name: 'uri',
		type: 'string',
		description: 'The URI of the post',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['like', 'deleteLike', 'repost'],
			},
		},
	},
	{
		displayName: 'Cid',
		name: 'cid',
		type: 'string',
		description: 'The CID of the post',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['like', 'repost'],
			},
		},
	}
];

export async function postOperation(agent: AtpAgent, postText: string, langs: string[]): Promise<INodeExecutionData[]> {
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

export async function likeOperation(agent: AtpAgent, uri: string, cid: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// https://docs.bsky.app/docs/tutorials/like-repost#liking-a-post
	const likeResponse:{ uri: string; cid: string } = await agent.like(uri, cid);

	returnData.push({
		json: {
			uri: likeResponse.uri,
			cid: likeResponse.cid,
		},
	})

	return returnData;
}

export async function deleteLikeOperation(agent: AtpAgent, uri: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// no response from deleteLike
	// https://docs.bsky.app/docs/tutorials/like-repost#unliking-a-post
	await agent.deleteLike(uri);

	returnData.push({
		json: {
			uri: uri,
		},
	});

	return returnData;
}

export async function repostOperation(agent: AtpAgent, uri: string, cid: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// https://docs.bsky.app/docs/tutorials/like-repost#quote-reposting
	const repostResult:{ uri: string; cid: string } = await agent.repost(uri, cid);

	returnData.push({
		json: {
			uri: repostResult.uri,
			cid: repostResult.cid,
		},
	});

	return returnData;
}
