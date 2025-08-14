import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeTypeBaseDescription, JsonObject, NodeApiError,
} from 'n8n-workflow';

import { NodeConnectionType } from 'n8n-workflow';

import { AtpAgent, CredentialSession } from '@atproto/api';

import { resourcesProperty } from './resources';

// Operations
import {
	deleteLikeOperation,
	deletePostOperation,
	likeOperation,
	postOperation,
	deleteRepostOperation,
	postProperties,
	repostOperation,
} from './postOperations';
import {
	getProfileOperation,
	muteOperation,
	userProperties,
	unmuteOperation,
	blockOperation,
	unblockOperation,
} from './userOperations';
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
			inputs: [NodeConnectionType.Main],
			outputs: [NodeConnectionType.Main],
			credentials: [
				{
					name: 'blueskyApi',
					required: true,
				},
			],
			properties: [resourcesProperty, ...userProperties, ...postProperties, ...feedProperties],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Load credentials
		const credentials = (await this.getCredentials('blueskyApi')) as {
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
			try {
				switch (operation) {
					/**
					 * Post operations
					 */

					case 'post':
						const postText = this.getNodeParameter('postText', i) as string;
						const langs = this.getNodeParameter('langs', i) as string[];

						/**
						 * Handle website card details if provided
						 */

						let websiteCardRaw = this.getNodeParameter('websiteCard', i, {});
						let websiteCard: any = websiteCardRaw;
						if (
							websiteCardRaw &&
							typeof websiteCardRaw === 'object' &&
							'details' in websiteCardRaw
						) {
							if (Array.isArray((websiteCardRaw as any).details) && (websiteCardRaw as any).details.length > 0) {
								websiteCard = (websiteCardRaw as any).details[0];
							} else if (typeof (websiteCardRaw as any).details === 'object') {
								websiteCard = (websiteCardRaw as any).details;
							}
						}

						// Load thumbnail binary only when explicitly provided and OG tags are not fetched
						let thumbnailBinary: Buffer | undefined;
						if (websiteCard.thumbnailBinaryProperty && websiteCard.fetchOpenGraphTags === false) {
							thumbnailBinary = await this.helpers.getBinaryDataBuffer(i, websiteCard.thumbnailBinaryProperty);
						}

						// Validate URL; ignore invalid/relative URLs
						let websiteCardUri = websiteCard.uri;
						try {
							if (websiteCardUri) new URL(websiteCardUri);
						} catch {
							websiteCardUri = undefined;
						}

						// Construct websiteCardPayload analogously to imagePayload
						let websiteCardPayload: {
								uri: string | undefined;
								title: string | undefined;
								description: string | undefined;
								thumbnailBinary: Buffer | undefined;
								fetchOpenGraphTags: boolean | undefined;
						} | undefined;
						if (websiteCardUri || websiteCard.title || websiteCard.description || thumbnailBinary || websiteCard.fetchOpenGraphTags !== undefined) {
							websiteCardPayload = {
								uri: websiteCardUri ?? undefined,
								title: websiteCard.title ?? undefined,
								description: websiteCard.description ?? undefined,
								thumbnailBinary: thumbnailBinary ?? undefined,
								fetchOpenGraphTags: websiteCard.fetchOpenGraphTags ?? undefined,
							};
						}
						console.debug('websiteCardPayload:', websiteCardPayload);

						// Handle optional image parameter (supports both flattened and .details shapes)
						const imageParamRaw = this.getNodeParameter('image', i, {}) as any;
						const imageParam = (imageParamRaw && imageParamRaw.details) ? imageParamRaw.details : imageParamRaw;
						let imagePayload: {
							alt?: string;
							mimeType?: string;
							binary?: Buffer;
							width?: number;
							height?: number;
						} | undefined;
						if (imageParam && (imageParam.binary || imageParam.alt || imageParam.mimeType)) {
							let imageBuffer: Buffer | undefined;
							if (imageParam.binary) {
								imageBuffer = await this.helpers.getBinaryDataBuffer(i, imageParam.binary as string);
							}
							imagePayload = {
								alt: imageParam.alt,
								mimeType: imageParam.mimeType,
								binary: imageBuffer,
								width: imageParam.width,
								height: imageParam.height,
							};
						}

						/*console.log(langs);
						console.log(postText);
						console.log(websiteCardPayload);
						console.log(postOperation.name);
						console.log(imagePayload);*/

						const postData = await postOperation(
							agent,
							postText,
							langs,
							websiteCardPayload,
							imagePayload
						);

						returnData.push(...postData);
						break;

					case 'deletePost':
						const uriDeletePost = this.getNodeParameter('uri', i) as string;
						const deletePostData = await deletePostOperation(agent, uriDeletePost);
						returnData.push(...deletePostData);
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
						const feedData = await getAuthorFeed(agent, authorFeedActor, authorFeedPostLimit);
						returnData.push(...feedData);
						break;

					case 'getTimeline':
						const timelinePostLimit = this.getNodeParameter('limit', i) as number;
						const timelineData = await getTimeline(agent, timelinePostLimit);
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

					case 'unblock':
						const uriUnblock = this.getNodeParameter('uri', i) as string;
						const unblockData = await unblockOperation(agent, uriUnblock);
						returnData.push(...unblockData);
						break;

					default:
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: [{ item: i }],
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		return [returnData];
	}
}
