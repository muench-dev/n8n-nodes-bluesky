import { AppBskyFeedGetAuthorFeed, AtpAgent } from '@atproto/api';
import { INodeExecutionData } from 'n8n-workflow';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';

export async function getAuthorFeedOperation(agent: AtpAgent, identifier: string): Promise<INodeExecutionData[]> {
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
