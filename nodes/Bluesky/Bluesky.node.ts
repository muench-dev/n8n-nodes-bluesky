import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { AppBskyFeedGetAuthorFeed, AppBskyFeedPost, AtpAgent, CredentialSession } from '@atproto/api';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';

export class Bluesky implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bluesky',
		name: 'bluesky',
		icon: 'file:bluesky.svg',
		group: ['transform'],
		version: 1,
		description: 'Interact with the Bluesky social platform',
		defaults: {
			name: 'Bluesky',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'blueskyApi',
				required: true,
			},
		],
		properties: [
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
						operation: ['post'],
					},
				},
			},
			{
				displayName: 'Languages',
				name: 'langs',
				type: 'multiOptions',
				options: [
					{
						name: 'English',
						value: 'en',
					},
					{
						name: 'German',
						value: 'de',
					}
				],
				default: ['en'],
				displayOptions: {
					show: {
						operation: ['post'],
					},
				},
			}
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Load credentials
		const credentials = await this.getCredentials('blueskyApi') as {
			identifier: string;
			appPassword: string;
			serviceUrl: string;
		};

		const operation = this.getNodeParameter('operation', 0) as string;
		const serviceUrl = new URL(credentials.serviceUrl.replace(/\/+$/, '')); // Ensure no trailing slash


		const session = new CredentialSession(serviceUrl)
		const agent = new AtpAgent(session)
		await agent.login({
			identifier: credentials.identifier,
			password: credentials.appPassword
		})

		for (let i = 0; i < items.length; i++) {

			if (operation === 'getAuthorFeed') {
				const authorFeedResponse: AppBskyFeedGetAuthorFeed.Response = await agent.getAuthorFeed({
					actor: credentials.identifier,
					limit: 10,
				})

				authorFeedResponse.data.feed.forEach((feedPost: FeedViewPost) => {
					returnData.push({
						json: {
							post: feedPost.post,
							reply: feedPost.reply,
							reason: feedPost.reason,
							feedContext: feedPost.feedContext,
						}
					});
				})
			}

			if (operation === 'post') {
				let postData = {
					text: this.getNodeParameter('postText', i) as string,
					langs: this.getNodeParameter('langs', i) as string[],
				} as AppBskyFeedPost.Record & Omit<AppBskyFeedPost.Record, 'createdAt'>

				const postResponse: { uri: string; cid: string } = await agent.post(postData)

				returnData.push({
					json: {
						uri: postResponse.uri,
						cid: postResponse.cid,
					}
				});
			}
		}

		return [returnData];
	}
}
