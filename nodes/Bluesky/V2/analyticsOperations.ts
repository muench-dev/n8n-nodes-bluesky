import { AtpAgent } from '@atproto/api';
import { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

export const analyticsProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['analytics'],
			},
		},
		options: [
			{
				name: 'Get Post Interactions',
				value: 'getPostInteractions',
				description: 'Get likes, reposts, and replies for a post',
				action: 'Get post interactions',
			},
			{
				name: 'Get Unread Notification Count',
				value: 'getUnreadCount',
				description: 'Get unread notification count for the authenticated user',
				action: 'Get unread notification count',
			},
			{
				name: 'List Notifications',
				value: 'listNotifications',
				description: 'List notifications for the authenticated user',
				action: 'List notifications',
			},
			{
				name: 'Update Seen Notifications',
				value: 'updateSeenNotifications',
				description: 'Mark notifications as seen',
				action: 'Mark notifications as seen',
			},
		],
		default: 'listNotifications',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['listNotifications'],
			},
		},
	},
	{
		displayName: 'Unread Only',
		name: 'unreadOnly',
		type: 'boolean',
		default: true,
		description: 'Whether to only return unread notifications',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['listNotifications'],
			},
		},
	},
	{
		displayName: 'Mark Retrieved as Read',
		name: 'markRetrievedAsRead',
		type: 'boolean',
		default: true,
		description: 'Whether to mark retrieved notifications as read after returning them',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['listNotifications'],
			},
		},
	},
	{
		displayName: 'Seen At (ISO Date String)',
		name: 'seenAt',
		type: 'string',
		default: '',
		description: 'Optional timestamp to use when marking notifications as seen',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['updateSeenNotifications'],
			},
		},
	},
	{
		displayName: 'Post URI',
		name: 'uri',
		type: 'string',
		default: '',
		required: true,
		description: 'AT URI of the post to analyze',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['getPostInteractions'],
			},
		},
	},
	{
		displayName: 'Interactions to Retrieve',
		name: 'interactionTypes',
		type: 'multiOptions',
		options: [
			{ name: 'Likes', value: 'likes' },
			{ name: 'Replies', value: 'replies' },
			{ name: 'Reposts', value: 'reposts' },
		],
		default: ['likes', 'reposts', 'replies'],
		description: 'Types of interactions to include in the response',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['getPostInteractions'],
			},
		},
	},
	{
		displayName: 'Interaction Limit',
		name: 'interactionLimit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		description: 'Max number of each interaction type to return',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['getPostInteractions'],
			},
		},
	},
];

export async function listNotificationsOperation(
	agent: AtpAgent,
	limit: number,
	unreadOnly: boolean,
	markRetrievedAsRead: boolean,
): Promise<INodeExecutionData[]> {
	const notifications: IDataObject[] = [];
	let cursor: string | undefined;

	while (notifications.length < limit) {
		const response = await agent.app.bsky.notification.listNotifications({
			limit: Math.min(100, limit - notifications.length),
			...(cursor ? { cursor } : {}),
		});

		const pageNotifications = (response.data.notifications ?? []).filter((notification) =>
			unreadOnly ? !notification.isRead : true,
		);

		notifications.push(...(pageNotifications as unknown as IDataObject[]));

		if (!response.data.cursor || response.data.notifications.length === 0) {
			break;
		}

		cursor = response.data.cursor;
	}

	const finalNotifications = notifications.slice(0, limit);

	if (markRetrievedAsRead && finalNotifications.length > 0) {
		await agent.app.bsky.notification.updateSeen({
			seenAt: new Date().toISOString(),
		});
	}

	return finalNotifications.map((notification) => ({ json: notification }));
}

export async function getUnreadCountOperation(agent: AtpAgent): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.notification.getUnreadCount();

	return [
		{
			json: {
				count: response.data.count,
			},
		},
	];
}

export async function updateSeenNotificationsOperation(
	agent: AtpAgent,
	seenAt?: string,
): Promise<INodeExecutionData[]> {
	const timestamp = seenAt || new Date().toISOString();

	await agent.app.bsky.notification.updateSeen({ seenAt: timestamp });

	return [
		{
			json: {
				success: true,
				seenAt: timestamp,
			},
		},
	];
}

export async function getPostInteractionsOperation(
	agent: AtpAgent,
	uri: string,
	interactionTypes: string[],
	interactionLimit: number,
): Promise<INodeExecutionData[]> {
	const interactions: IDataObject = {};

	if (interactionTypes.includes('likes')) {
		const likesResponse = await agent.app.bsky.feed.getLikes({ uri, limit: interactionLimit });
		interactions.likes = likesResponse.data.likes.map((like) => ({
			actor: like.actor,
			createdAt: like.createdAt,
			indexedAt: like.indexedAt,
		}));
	}

	if (interactionTypes.includes('reposts')) {
		const repostsResponse = await agent.app.bsky.feed.getRepostedBy({
			uri,
			limit: interactionLimit,
		});
		interactions.reposts = repostsResponse.data.repostedBy as unknown as IDataObject[];
	}

	if (interactionTypes.includes('replies')) {
		const threadResponse = await agent.app.bsky.feed.getPostThread({ uri, depth: 1 });
		const thread = threadResponse.data.thread as
			| { replies?: Array<{ post?: IDataObject }> }
			| undefined;
		interactions.replies = (thread?.replies ?? [])
			.map((reply) => ({
				post: reply.post,
				author: reply.post?.author,
			}))
			.slice(0, interactionLimit) as unknown as IDataObject[];
	}

	interactions.analytics = {
		likeCount: Array.isArray(interactions.likes) ? interactions.likes.length : 0,
		repostCount: Array.isArray(interactions.reposts) ? interactions.reposts.length : 0,
		replyCount: Array.isArray(interactions.replies) ? interactions.replies.length : 0,
	};

	return [{ json: interactions }];
}
