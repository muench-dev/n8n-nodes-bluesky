import {
	AppBskyActorDefs,
	AppBskyFeedDefs,
	AppBskyFeedGetAuthorFeed,
	AppBskyFeedGetTimeline,
	AtpAgent,
	ComAtprotoLabelDefs,
} from '@atproto/api';
import { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

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
			outputPost.replyParent = {
				uri: parent.uri,
				cid: 'not_found_cid',
				authorDid: 'not_found_author',
			};
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
		if (
			typeof outputPost.feedContext === 'string' &&
			typeof feedViewPost.feedContext === 'string'
		) {
			outputPost.feedContext = `${outputPost.feedContext}; ${feedViewPost.feedContext}`;
		} else if (!outputPost.feedContext) {
			outputPost.feedContext = feedViewPost.feedContext as
				| string
				| { text: string; facets?: any[] };
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
		if ('error' in response && 'message' in response) {
			throw new Error(`Failed to fetch author feed: ${response.error} - ${response.message}`);
		}

		throw new Error('Failed to fetch author feed due to an unknown error structure.');
	}

	return response.data.feed.map((item) => mapFeedViewPostToOutputPost(item));
}

export async function _getTimelineInternal(
	agent: AtpAgent,
	params: AppBskyFeedGetTimeline.QueryParams,
): Promise<OutputPost[]> {
	const response = await agent.getTimeline(params);
	if (!response.success) {
		if ('error' in response && 'message' in response) {
			throw new Error(`Failed to fetch timeline: ${response.error} - ${response.message}`);
		}

		throw new Error('Failed to fetch timeline due to an unknown error structure.');
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
			{
				name: 'Get Author Feed',
				value: 'getAuthorFeed',
				description: 'Author feeds return posts by a single user',
				action: 'Retrieve feed with posts by a single user',
			},
			{
				name: 'Get Post Thread',
				value: 'getPostThread',
				description: 'Retrieve the full context of a post thread',
				action: 'Retrieve a post thread',
			},
			{
				name: 'Timeline',
				value: 'getTimeline',
				description:
					'The default chronological feed of posts from users the authenticated user follows',
				action: 'Retrieve user timeline',
			},
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
		displayName: 'Post URI',
		name: 'uri',
		type: 'string',
		default: '',
		required: true,
		description: 'The URI of the post to fetch the thread for',
		displayOptions: { show: { resource: ['feed'], operation: ['getPostThread'] } },
	},
	{
		displayName: 'Depth',
		name: 'depth',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 6,
		description: 'Depth of parent replies to fetch',
		displayOptions: { show: { resource: ['feed'], operation: ['getPostThread'] } },
	},
	{
		displayName: 'Parent Height',
		name: 'parentHeight',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 80,
		description: 'Depth of child replies to fetch',
		displayOptions: { show: { resource: ['feed'], operation: ['getPostThread'] } },
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
	{
		displayName: 'Filter',
		name: 'filter',
		type: 'options',
		default: 'posts_with_replies',
		description: 'Filter posts by type',
		options: [
			{
				name: 'Posts and Author Threads',
				value: 'posts_and_author_threads',
				description: 'Posts and threads authored by the user',
			},
			{
				name: 'Posts with Media',
				value: 'posts_with_media',
				description: 'Only posts containing media attachments',
			},
			{
				name: 'Posts with Replies',
				value: 'posts_with_replies',
				description: 'All posts, including replies',
			},
			{
				name: 'Posts with Video',
				value: 'posts_with_video',
				description: 'Only posts containing video content',
			},
			{
				name: 'Posts without Replies',
				value: 'posts_no_replies',
				description: 'Only top-level posts',
			},
		],
		displayOptions: { show: { resource: ['feed'], operation: ['getAuthorFeed'] } },
	},
];

export async function getAuthorFeed(
	agent: AtpAgent,
	actor: string,
	limit: number,
	filter?: string,
): Promise<INodeExecutionData[]> {
	const outputPosts = await _getAuthorFeedInternal(agent, {
		actor,
		limit,
		...(filter ? { filter } : {}),
	});
	return outputPosts.map((post) => ({ json: post as IDataObject, pairedItem: { item: 0 } }));
}

export async function getPostThread(
	agent: AtpAgent,
	uri: string,
	depth?: number,
	parentHeight?: number,
): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.feed.getPostThread({
		uri,
		...(depth !== undefined ? { depth } : {}),
		...(parentHeight !== undefined ? { parentHeight } : {}),
	});

	if (!response.data.thread) {
		return [];
	}

	return [
		{
			json: JSON.parse(JSON.stringify(response.data.thread)) as IDataObject,
			pairedItem: { item: 0 },
		},
	];
}

export async function getTimeline(agent: AtpAgent, limit: number): Promise<INodeExecutionData[]> {
	const outputPosts = await _getTimelineInternal(agent, { limit });
	return outputPosts.map((post) => ({ json: post as IDataObject, pairedItem: { item: 0 } }));
}
