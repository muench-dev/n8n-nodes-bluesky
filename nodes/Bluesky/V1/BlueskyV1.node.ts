import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription, INodeTypeBaseDescription,
} from 'n8n-workflow';

import { AppBskyFeedGetAuthorFeed, AppBskyFeedPost, AtpAgent, CredentialSession, RichText } from '@atproto/api';
import { getLanguageOptions } from './languages';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';


export class BlueskyV1 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			version: 1,
			subtitle: '',
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
				}
			],
		};
	}

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

				let rt = new RichText({
					text: this.getNodeParameter('postText', i) as string,
				})

				await rt.detectFacets(agent)

				let postData = {
					text: rt.text,
					langs: this.getNodeParameter('langs', i) as string[],
					facets: rt.facets,
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
