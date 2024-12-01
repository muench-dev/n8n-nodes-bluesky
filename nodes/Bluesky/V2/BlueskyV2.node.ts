import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription, INodeTypeBaseDescription,
} from 'n8n-workflow';

import { AtpAgent, CredentialSession } from '@atproto/api';

import { resourcesProperty } from './resources';

// Operations
import {
	deleteLikeOperation,
	likeOperation,
	postOperation,
	deleteRepostOperation,
	postProperties,
	repostOperation,
} from './postOperations';
import { getProfileOperation, muteOperation, userProperties, unmuteOperation, blockOperation } from './userOperations';
import { getAuthorFeed, feedProperties, getTimeline } from './feedOperations';


export class BlueskyV2 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			version: 2,
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
				resourcesProperty,
				...userProperties,
				...postProperties,
				...feedProperties,
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

		const session = new CredentialSession(serviceUrl);
		const agent = new AtpAgent(session);
		await agent.login({
			identifier: credentials.identifier,
			password: credentials.appPassword,
		});

		for (let i = 0; i < items.length; i++) {

			switch (operation) {

				/**
				 * Post operations
				 */

				case 'post':
					const postText = this.getNodeParameter('postText', i) as string;
					const langs = this.getNodeParameter('langs', i) as string[];
					const postData = await postOperation(agent, postText, langs);
					returnData.push(...postData);
					break;

				case 'like':
					const uriLike = this.getNodeParameter('uri', i) as string;
					const cidLike = this.getNodeParameter('cid', i) as string;
					const likeData = await likeOperation(agent, uriLike, cidLike);
					returnData.push(...likeData);
					break;

				case 'deleteLike':
					const uriDeleteLike = this.getNodeParameter('uri', i) as string;
					const deleteLikeData = await deleteLikeOperation(agent, uriDeleteLike);
					returnData.push(...deleteLikeData);
					break;

				case 'repost':
					const uriRepost = this.getNodeParameter('uri', i) as string;
					const cidRepost = this.getNodeParameter('cid', i) as string;
					const repostData = await repostOperation(agent, uriRepost, cidRepost);
					returnData.push(...repostData);
					break;

				case 'deleteRepost':
					const uriDeleteRepost = this.getNodeParameter('uri', i) as string;
					const deleteRepostData = await deleteRepostOperation(agent, uriDeleteRepost);
					returnData.push(...deleteRepostData);
					break;

				/**
				 * Feed operations
				 */

				case 'getAuthorFeed':
					const authorFeedActor = this.getNodeParameter('actor', i) as string;
					const authorFeedPostLimit = this.getNodeParameter('limit', i) as number;
					const feedData = await getAuthorFeed(
						agent,
						authorFeedActor,
						authorFeedPostLimit,
					);
					returnData.push(...feedData);
					break;

				case 'getTimeline':
					const timelinePostLimit = this.getNodeParameter('limit', i) as number;
					const timelineData = await getTimeline(
						agent,
						timelinePostLimit,
					);
					returnData.push(...timelineData);
					break;

				/**
				 * User operations
				 */

				case 'getProfile':
					const actor = this.getNodeParameter('actor', i) as string;
					const profileData = await getProfileOperation(agent, actor);
					returnData.push(...profileData);
					break;

				case 'mute':
					const didMute = this.getNodeParameter('did', i) as string;
					const muteData = await muteOperation(agent, didMute);
					returnData.push(...muteData);
					break;

				case 'unmute':
					const didUnmute = this.getNodeParameter('did', i) as string;
					const unmuteData = await unmuteOperation(agent, didUnmute);
					returnData.push(...unmuteData);
					break;

				case 'block':
					const didBlock = this.getNodeParameter('did', i) as string;
					const blockData = await blockOperation(agent, didBlock);
					returnData.push(...blockData);
					break;

				default:
			}
		}

		return [returnData];
	}
}
