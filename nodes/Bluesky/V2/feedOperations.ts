import {
	AppBskyFeedDefs,
	AppBskyFeedGetAuthorFeed,
	AppBskyFeedGetTimeline,
	AtpAgent,
	ComAtprotoLabelDefs,
	AppBskyActorDefs,
} from '@atproto/api';
import { INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';

export interface OutputPost {
	uri: string;
	cid: string;
	author: {
		did: string;
		handle: string;
		displayName?: string;
		avatar?: string;
		viewer?: AppBskyActorDefs.ViewerState;
		labels?: ComAtprotoLabelDefs.Label[];
	};
	record: {
		text?: string;
		createdAt: string;
		[key: string]: any;
	};
	embed?: AppBskyFeedDefs.PostView['embed'];
	replyCount?: number;
	repostCount?: number;
	likeCount?: number;
	indexedAt: string;
	viewer?: AppBskyFeedDefs.ViewerState;
	labels?: ComAtprotoLabelDefs.Label[];
	replyParent?: {
		uri: string;
		cid: string;
		authorDid?: string;
	} | null;
	repostedBy?: {
		did: string;
		handle: string;
		displayName?: string;
		avatar?: string;
		viewer?: AppBskyActorDefs.ViewerState;
		labels?: ComAtprotoLabelDefs.Label[];
	};
	feedContext?: string | { text: string; facets?: any[] };
	[key: string]: any;
}

export function mapFeedViewPostToOutputPost(
	feedViewPost: AppBskyFeedDefs.FeedViewPost,
): OutputPost {
	const post = feedViewPost.post;

	const outputPost: OutputPost = {
		uri: post.uri,
		cid: post.cid,
		author: {
			did: post.author.did,
			handle: post.author.handle,
			displayName: post.author.displayName,
			avatar: post.author.avatar,
			viewer: post.author.viewer,
			labels: post.author.labels,
		},
		record: {
			text: (post.record as any)?.text,
			createdAt: (post.record as any)?.createdAt,
			...(post.record as any),
		},
		embed: post.embed,
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		likeCount: post.likeCount,
		indexedAt: post.indexedAt,
		viewer: post.viewer,
		labels: post.labels,
		replyParent: null,
	};

	if (feedViewPost.reply) {
		const parent = feedViewPost.reply.parent;
		if (AppBskyFeedDefs.isPostView(parent)) {
			outputPost.replyParent = {
				uri: parent.uri,
				cid: parent.cid,
				authorDid: parent.author.did,
			};
		} else if (AppBskyFeedDefs.isNotFoundPost(parent)) {
			outputPost.replyParent = { uri: parent.uri, cid: 'not_found_cid', authorDid: 'not_found_author' };
		} else if (AppBskyFeedDefs.isBlockedPost(parent)) {
			outputPost.replyParent = { uri: parent.uri, cid: 'blocked_cid', authorDid: 'blocked_author' };
		}
	}

	if (feedViewPost.reason && AppBskyFeedDefs.isReasonRepost(feedViewPost.reason)) {
		const reposter = feedViewPost.reason.by;
		outputPost.repostedBy = {
			did: reposter.did,
			handle: reposter.handle,
			displayName: reposter.displayName,
			avatar: reposter.avatar,
			viewer: reposter.viewer,
			labels: reposter.labels,
		};
		outputPost.feedContext = `Reposted by @${reposter.handle}`;
	}

	if (feedViewPost.feedContext) {
		if (typeof outputPost.feedContext === 'string' && typeof feedViewPost.feedContext === 'string') {
			outputPost.feedContext = `${outputPost.feedContext}; ${feedViewPost.feedContext}`;
		} else if (!outputPost.feedContext) {
			outputPost.feedContext = feedViewPost.feedContext as string | { text: string; facets?: any[] };
		}
	}
	return outputPost;
}

export async function _getAuthorFeedInternal(
	agent: AtpAgent,
	params: AppBskyFeedGetAuthorFeed.QueryParams,
): Promise<OutputPost[]> {
	const response = await agent.getAuthorFeed(params);
	if (!response.success) {
		// After confirming !response.success, check for error properties before accessing
		if ('error' in response && 'message' in response) {
			throw new Error(`Failed to fetch author feed: ${response.error} - ${response.message}`);
		} else {
			// Fallback if structure is not as expected for a failure
			throw new Error('Failed to fetch author feed due to an unknown error structure.');
		}
	}
	return response.data.feed.map((item) => mapFeedViewPostToOutputPost(item));
}

export async function _getTimelineInternal(
	agent: AtpAgent,
	params: AppBskyFeedGetTimeline.QueryParams,
): Promise<OutputPost[]> {
	const response = await agent.getTimeline(params);
	if (!response.success) {
		// After confirming !response.success, check for error properties before accessing
		if ('error' in response && 'message' in response) {
			throw new Error(`Failed to fetch timeline: ${response.error} - ${response.message}`);
		} else {
			// Fallback if structure is not as expected for a failure
			throw new Error('Failed to fetch timeline due to an unknown error structure.');
		}
	}
	return response.data.feed.map((item) => mapFeedViewPostToOutputPost(item));
}

export const feedProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['feed'] } },
		options: [
			{ name: 'Get Author Feed', value: 'getAuthorFeed', description: 'Author feeds return posts by a single user', action: 'Retrieve feed with posts by a single user' },
			{ name: 'Timeline', value: 'getTimeline', description: 'The default chronological feed of posts from users the authenticated user follows', action: 'Retrieve user timeline' },
		],
		default: 'getAuthorFeed',
	},
	{
		displayName: 'Actor',
		name: 'actor',
		type: 'string',
		default: '',
		required: true,
		description: "The DID of the author whose posts you'd like to fetch",
		hint: 'The user getProfile operation can be used to get the DID of a user',
		displayOptions: { show: { resource: ['feed'], operation: ['getAuthorFeed'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		required: true,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['feed'], operation: ['getAuthorFeed', 'getTimeline'] } },
	},
];

export async function getAuthorFeed(
	agent: AtpAgent,
	actor: string,
	limit: number,
): Promise<INodeExecutionData[]> {
	const outputPosts = await _getAuthorFeedInternal(agent, { actor: actor, limit: limit });
	return outputPosts.map((post) => ({ json: post as IDataObject, pairedItem: { item: 0 } }));
}

export async function getTimeline(
	agent: AtpAgent,
	limit: number,
): Promise<INodeExecutionData[]> {
	const outputPosts = await _getTimelineInternal(agent, { limit: limit });
	return outputPosts.map((post) => ({ json: post as IDataObject, pairedItem: { item: 0 } }));
}
