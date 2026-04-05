import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	JsonObject,
	LoggerProxy as Logger,
	NodeApiError,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { AtpAgent, CredentialSession } from '@atproto/api';

import { resourcesProperty } from './resources';
import {
	deleteLikeOperation,
	deletePostOperation,
	deleteRepostOperation,
	likeOperation,
	postOperation,
	postProperties,
	quoteOperation,
	replyOperation,
	repostOperation,
} from './postOperations';
import {
	blockOperation,
	getProfileOperation,
	listAllFollowersOperation,
	listAllFollowsOperation,
	muteOperation,
	unblockOperation,
	unmuteOperation,
	userProperties,
} from './userOperations';
import { feedProperties, getAuthorFeed, getPostThread, getTimeline } from './feedOperations';
import {
	analyticsProperties,
	getPostInteractionsOperation,
	getUnreadCountOperation,
	listNotificationsOperation,
	updateSeenNotificationsOperation,
} from './analyticsOperations';
import { graphProperties, muteThreadOperation } from './graphOperations';
import {
	addUserToListOperation,
	createListOperation,
	deleteListOperation,
	getListFeedOperation,
	getListsOperation,
	listProperties,
	removeUserFromListOperation,
	updateListOperation,
} from './listOperations';
import { searchPostsOperation, searchProperties, searchUsersOperation } from './searchOperations';

type MediaItemPayload = {
	alt?: string;
	mimeType?: string;
	binary?: Buffer;
	width?: number;
	height?: number;
};

async function getWebsiteCardPayload(context: IExecuteFunctions, itemIndex: number) {
	const websiteCardRaw = context.getNodeParameter('websiteCard', itemIndex, {}) as any;
	let websiteCard = websiteCardRaw;

	if (websiteCardRaw && typeof websiteCardRaw === 'object' && 'details' in websiteCardRaw) {
		if (Array.isArray(websiteCardRaw.details) && websiteCardRaw.details.length > 0) {
			websiteCard = websiteCardRaw.details[0];
		} else if (typeof websiteCardRaw.details === 'object') {
			websiteCard = websiteCardRaw.details;
		}
	}

	let thumbnailBinary: Buffer | undefined;
	if (websiteCard?.thumbnailBinaryProperty && websiteCard.fetchOpenGraphTags === false) {
		thumbnailBinary = await context.helpers.getBinaryDataBuffer(
			itemIndex,
			websiteCard.thumbnailBinaryProperty,
		);
	}

	let websiteCardUri = websiteCard?.uri;
	try {
		if (websiteCardUri) {
			new URL(websiteCardUri);
		}
	} catch {
		websiteCardUri = undefined;
	}

	if (
		!websiteCardUri &&
		!websiteCard?.title &&
		!websiteCard?.description &&
		!thumbnailBinary &&
		websiteCard?.fetchOpenGraphTags === undefined
	) {
		return undefined;
	}

	return {
		uri: websiteCardUri ?? undefined,
		title: websiteCard?.title ?? undefined,
		description: websiteCard?.description ?? undefined,
		thumbnailBinary,
		fetchOpenGraphTags: websiteCard?.fetchOpenGraphTags ?? undefined,
	};
}

async function getLegacyImagePayload(context: IExecuteFunctions, itemIndex: number) {
	const imageParamRaw = context.getNodeParameter('image', itemIndex, {}) as any;
	const imageParam = imageParamRaw && imageParamRaw.details ? imageParamRaw.details : imageParamRaw;

	if (!imageParam || (!imageParam.binary && !imageParam.alt && !imageParam.mimeType)) {
		return undefined;
	}

	let imageBuffer: Buffer | undefined;
	if (imageParam.binary) {
		imageBuffer = await context.helpers.getBinaryDataBuffer(itemIndex, imageParam.binary as string);
	}

	return {
		alt: imageParam.alt,
		mimeType: imageParam.mimeType,
		binary: imageBuffer,
		width: imageParam.width,
		height: imageParam.height,
	};
}

async function getMediaItemsPayload(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<MediaItemPayload[]> {
	const includeMedia = context.getNodeParameter('includeMedia', itemIndex, false) as boolean;
	if (!includeMedia) {
		return [];
	}

	const mediaItemsRaw = context.getNodeParameter('mediaItems', itemIndex, {}) as {
		media?: Array<{ media?: { binaryPropertyName?: string; altText?: string } }>;
	};

	const mediaItems = mediaItemsRaw.media ?? [];
	const payload: MediaItemPayload[] = [];

	for (const item of mediaItems) {
		const binaryPropertyName = item.media?.binaryPropertyName;
		if (!binaryPropertyName) {
			continue;
		}

		const binaryData = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
		const binaryMeta = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);

		payload.push({
			alt: item.media?.altText,
			mimeType: binaryMeta.mimeType,
			binary: binaryData,
		});
	}

	return payload;
}

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
			properties: [
				resourcesProperty,
				...analyticsProperties,
				...graphProperties,
				...listProperties,
				...userProperties,
				...postProperties,
				...feedProperties,
				...searchProperties,
			],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = (await this.getCredentials('blueskyApi')) as {
			identifier: string;
			appPassword: string;
			serviceUrl: string;
		};

		const operation = this.getNodeParameter('operation', 0) as string;
		const serviceUrl = new URL(credentials.serviceUrl.replace(/\/+$/, ''));

		const node = this.getNode();
		const nodeMeta = { nodeName: node.name, nodeType: node.type, nodeId: node.id, operation };

		Logger.info('Initializing Bluesky session', { ...nodeMeta, serviceOrigin: serviceUrl.origin });

		const session = new CredentialSession(serviceUrl);
		const agent = new AtpAgent(session);
		await agent.login({
			identifier: credentials.identifier,
			password: credentials.appPassword,
		});

		Logger.info('Authenticated with Bluesky', { ...nodeMeta });

		for (let i = 0; i < items.length; i++) {
			const itemMeta = { ...nodeMeta, itemIndex: i };

			try {
				switch (operation) {
					case 'post': {
						const postText = this.getNodeParameter('postText', i) as string;
						const langs = this.getNodeParameter('langs', i) as string[];
						const websiteCardPayload = await getWebsiteCardPayload(this, i);
						const imagePayload = await getLegacyImagePayload(this, i);
						const mediaItemsPayload = await getMediaItemsPayload(this, i);

						returnData.push(
							...(await postOperation(
								agent,
								postText,
								langs,
								websiteCardPayload,
								imagePayload,
								mediaItemsPayload,
							)),
						);
						break;
					}

					case 'reply': {
						const replyText = this.getNodeParameter('replyText', i) as string;
						const replyLangs = this.getNodeParameter('replyLangs', i) as string[];
						const uri = this.getNodeParameter('uri', i) as string;
						const cid = this.getNodeParameter('cid', i) as string;
						const websiteCardPayload = await getWebsiteCardPayload(this, i);
						const mediaItemsPayload = await getMediaItemsPayload(this, i);

						returnData.push(
							...(await replyOperation(
								agent,
								replyText,
								replyLangs,
								uri,
								cid,
								websiteCardPayload,
								mediaItemsPayload,
							)),
						);
						break;
					}

					case 'quote': {
						const quoteText = this.getNodeParameter('quoteText', i) as string;
						const quoteLangs = this.getNodeParameter('quoteLangs', i) as string[];
						const uri = this.getNodeParameter('uri', i) as string;
						const cid = this.getNodeParameter('cid', i) as string;

						returnData.push(...(await quoteOperation(agent, quoteText, quoteLangs, uri, cid)));
						break;
					}

					case 'deletePost': {
						returnData.push(
							...(await deletePostOperation(agent, this.getNodeParameter('uri', i) as string)),
						);
						break;
					}

					case 'like': {
						returnData.push(
							...(await likeOperation(
								agent,
								this.getNodeParameter('uri', i) as string,
								this.getNodeParameter('cid', i) as string,
							)),
						);
						break;
					}

					case 'deleteLike': {
						returnData.push(
							...(await deleteLikeOperation(agent, this.getNodeParameter('uri', i) as string)),
						);
						break;
					}

					case 'repost': {
						returnData.push(
							...(await repostOperation(
								agent,
								this.getNodeParameter('uri', i) as string,
								this.getNodeParameter('cid', i) as string,
							)),
						);
						break;
					}

					case 'deleteRepost': {
						returnData.push(
							...(await deleteRepostOperation(agent, this.getNodeParameter('uri', i) as string)),
						);
						break;
					}

					case 'getAuthorFeed': {
						returnData.push(
							...(await getAuthorFeed(
								agent,
								this.getNodeParameter('actor', i) as string,
								this.getNodeParameter('limit', i) as number,
								(this.getNodeParameter('filter', i, '') as string) || undefined,
							)),
						);
						break;
					}

					case 'getPostThread': {
						returnData.push(
							...(await getPostThread(
								agent,
								this.getNodeParameter('uri', i) as string,
								this.getNodeParameter('depth', i) as number,
								this.getNodeParameter('parentHeight', i) as number,
							)),
						);
						break;
					}

					case 'getTimeline': {
						returnData.push(
							...(await getTimeline(agent, this.getNodeParameter('limit', i) as number)),
						);
						break;
					}

					case 'getProfile': {
						returnData.push(
							...(await getProfileOperation(agent, this.getNodeParameter('actor', i) as string)),
						);
						break;
					}

					case 'listAllFollowers': {
						returnData.push(
							...(await listAllFollowersOperation(
								agent,
								this.getNodeParameter('handle', i) as string,
								this.getNodeParameter('maxResults', i) as number,
								this.getNodeParameter('pageSize', i) as number,
							)),
						);
						break;
					}

					case 'listAllFollows': {
						returnData.push(
							...(await listAllFollowsOperation(
								agent,
								this.getNodeParameter('handle', i) as string,
								this.getNodeParameter('maxResults', i) as number,
								this.getNodeParameter('pageSize', i) as number,
							)),
						);
						break;
					}

					case 'mute': {
						returnData.push(
							...(await muteOperation(agent, this.getNodeParameter('did', i) as string)),
						);
						break;
					}

					case 'unmute': {
						returnData.push(
							...(await unmuteOperation(agent, this.getNodeParameter('did', i) as string)),
						);
						break;
					}

					case 'block': {
						returnData.push(
							...(await blockOperation(agent, this.getNodeParameter('did', i) as string)),
						);
						break;
					}

					case 'unblock': {
						returnData.push(
							...(await unblockOperation(agent, this.getNodeParameter('uri', i) as string)),
						);
						break;
					}

					case 'searchUsers': {
						returnData.push(
							...(await searchUsersOperation(
								agent,
								this.getNodeParameter('q', i) as string,
								this.getNodeParameter('limit', i) as number,
							)),
						);
						break;
					}

					case 'searchPosts': {
						returnData.push(
							...(await searchPostsOperation(
								agent,
								this.getNodeParameter('q', i) as string,
								this.getNodeParameter('limit', i) as number,
								(this.getNodeParameter('author', i, '') as string) || undefined,
							)),
						);
						break;
					}

					case 'muteThread': {
						returnData.push(
							...(await muteThreadOperation(agent, this.getNodeParameter('uri', i) as string)),
						);
						break;
					}

					case 'listNotifications': {
						returnData.push(
							...(await listNotificationsOperation(
								agent,
								this.getNodeParameter('limit', i) as number,
								this.getNodeParameter('unreadOnly', i) as boolean,
								this.getNodeParameter('markRetrievedAsRead', i) as boolean,
							)),
						);
						break;
					}

					case 'getUnreadCount': {
						returnData.push(...(await getUnreadCountOperation(agent)));
						break;
					}

					case 'updateSeenNotifications': {
						returnData.push(
							...(await updateSeenNotificationsOperation(
								agent,
								(this.getNodeParameter('seenAt', i, '') as string) || undefined,
							)),
						);
						break;
					}

					case 'getPostInteractions': {
						returnData.push(
							...(await getPostInteractionsOperation(
								agent,
								this.getNodeParameter('uri', i) as string,
								this.getNodeParameter('interactionTypes', i) as string[],
								this.getNodeParameter('interactionLimit', i) as number,
							)),
						);
						break;
					}

					case 'createList': {
						returnData.push(
							...(await createListOperation(
								agent,
								this.getNodeParameter('name', i) as string,
								this.getNodeParameter('purpose', i) as string,
								(this.getNodeParameter('description', i, '') as string) || undefined,
							)),
						);
						break;
					}

					case 'updateList': {
						returnData.push(
							...(await updateListOperation(
								agent,
								this.getNodeParameter('listUri', i) as string,
								this.getNodeParameter('name', i) as string,
								this.getNodeParameter('purpose', i) as string,
								(this.getNodeParameter('description', i, '') as string) || undefined,
							)),
						);
						break;
					}

					case 'deleteList': {
						returnData.push(
							...(await deleteListOperation(agent, this.getNodeParameter('listUri', i) as string)),
						);
						break;
					}

					case 'getLists': {
						returnData.push(
							...(await getListsOperation(
								agent,
								this.getNodeParameter('actor', i) as string,
								this.getNodeParameter('limit', i) as number,
							)),
						);
						break;
					}

					case 'getListFeed': {
						returnData.push(
							...(await getListFeedOperation(
								agent,
								this.getNodeParameter('listUri', i) as string,
								this.getNodeParameter('limit', i) as number,
							)),
						);
						break;
					}

					case 'addUserToList': {
						returnData.push(
							...(await addUserToListOperation(
								agent,
								this.getNodeParameter('listUri', i) as string,
								this.getNodeParameter('userDid', i) as string,
							)),
						);
						break;
					}

					case 'removeUserFromList': {
						returnData.push(
							...(await removeUserFromListOperation(
								agent,
								this.getNodeParameter('listItemUri', i) as string,
							)),
						);
						break;
					}

					default:
						Logger.warn('Unknown operation requested', itemMeta);
				}
			} catch (error) {
				Logger.error('Operation failed', { ...itemMeta, error: (error as Error)?.message });

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

		Logger.info('Node execution finished', {
			...nodeMeta,
			itemsProcessed: items.length,
			itemsReturned: returnData.length,
		});

		return [returnData];
	}
}
