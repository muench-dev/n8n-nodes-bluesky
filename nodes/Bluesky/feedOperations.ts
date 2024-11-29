import { AppBskyFeedGetAuthorFeed, AtpAgent } from '@atproto/api';
import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';

export const feedProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Get Author Feed',
				value: 'getAuthorFeed',
				description: 'Retrieve user feed',
				action: 'Retrieve user feed',
			},
		],
		displayOptions: {
			show: {
				resource: ['feed'],
			},
		},
		default: 'getAuthorFeed',
	}
];

export async function feedOperations(agent: AtpAgent, identifier: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const authorFeedResponse: AppBskyFeedGetAuthorFeed.Response = await agent.getAuthorFeed({
		actor: identifier,
		limit: 10,
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
