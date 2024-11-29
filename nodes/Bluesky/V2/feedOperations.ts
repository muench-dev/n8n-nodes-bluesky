import { AppBskyFeedGetAuthorFeed, AppBskyFeedGetTimeline, AtpAgent } from '@atproto/api';
import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';

export const feedProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['feed'],
			},
		},
		options: [
			{
				name: 'Get Author Feed',
				value: 'getAuthorFeed',
				description: 'Author feeds return posts by a single user',
				action: 'Retrieve feed with posts by a single user',
			},
			{
				name: 'Timeline',
				value: 'getTimeline',
				description: 'The default chronological feed of posts from users the authenticated user follows',
				action: 'Retrieve user timeline',
			}
		],
		default: 'getAuthorFeed',
	},
	{
		displayName: 'Actor',
		name: 'actor',
		type: 'string',
		default: '',
		required: true,
		description: 'The DID of the author whose posts you\'d like to fetch',
		hint: 'The user getProfile operation can be used to get the DID of a user',
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['getAuthorFeed'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 50,
		required: true,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['feed'],
				operation: ['getAuthorFeed', 'getTimeline'],
			},
		},
	}
];

export async function getAuthorFeed(agent: AtpAgent, actor: string, limit: number): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const authorFeedResponse: AppBskyFeedGetAuthorFeed.Response = await agent.getAuthorFeed({
		actor: actor,
		limit: limit,
	});

	authorFeedResponse.data.feed.forEach((feedPost: FeedViewPost) => {
		returnData.push({
			json: {
				post: feedPost.post,
				reply: feedPost.reply,
				reason: feedPost.reason,
				feedContext: feedPost.feedContext,
			},
		});
	});
	return returnData;
}

export async function getTimeline(agent: AtpAgent, limit: number): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const timelineResponse: AppBskyFeedGetTimeline.Response = await agent.getTimeline({
		limit: limit,
	});

	timelineResponse.data.feed.forEach((feedPost: FeedViewPost) => {
		returnData.push({
			json: {
				post: feedPost.post,
				reply: feedPost.reply,
				reason: feedPost.reason,
				feedContext: feedPost.feedContext,
			},
		});
	});
	return returnData;
}

