import {
	INodeExecutionData,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeTypeBaseDescription, INodeCredentialDescription, NodeDefaults, JsonObject, NodeApiError, NodeOperationError,
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
import { credentialTypeProperty } from './credentialTypes';

export class BlueskyV2 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			version: [2, 2.1],
			defaults: {
				name: 'Bluesky',
			} as NodeDefaults,
			usableAsTool: true,
			inputs: [NodeConnectionType.Main],
			outputs: [NodeConnectionType.Main],
			credentials: [
				{
					name: 'blueskyApi',
					displayName: 'Bluesky API (App Password)',
					required: true,
					displayOptions: {
						show: {
							'@version': [2],
						},
					},
				} as INodeCredentialDescription,
				{
					name: 'blueskyApi',
					displayName: 'Bluesky API (App Password)',
					required: true,
					displayOptions: {
						show: {
							'@version': [2.1],
							credentialType: ['appPassword'],
						},
					},
				} as INodeCredentialDescription,
				{
					name: 'blueskyOAuth2Api',
					displayName: 'Bluesky API (OAuth2)',
					required: true,
					displayOptions: {
						show: {
							'@version': [2.1],
							credentialType: ['oAuth2'],
						},
					},
				} as INodeCredentialDescription,
			] as INodeCredentialDescription[],
			properties: [credentialTypeProperty, resourcesProperty, ...userProperties, ...postProperties, ...feedProperties],
		} as INodeTypeDescription;
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentialType = this.getNodeParameter('credentialType', 0) as string | 'appPassword';

		let agent: AtpAgent;
		const operation = this.getNodeParameter('operation', 0) as string;

		if (credentialType === 'appPassword') {
			const credentials = (await this.getCredentials('blueskyApi')) as {
				identifier: string;
				appPassword: string;
				serviceUrl: string;
			};
			const serviceUrl = new URL(credentials.serviceUrl.replace(/\/+$/, '')); // Ensure no trailing slash
			let loginIdentifier = credentials.identifier;

			// Check if identifier is a handle (contains '.' and not 'did:')
			if (loginIdentifier.includes('.') && !loginIdentifier.startsWith('did:')) {
				try {
					// Attempt to resolve handle
					const tempAgentServiceUrl = new URL(credentials.serviceUrl.replace(/\/+$/, ''));
					const tempSession = new CredentialSession(tempAgentServiceUrl);
					const tempAgent = new AtpAgent(tempSession);
					// Note: tempAgent does not need to be logged in to resolve a handle.
					this.logger.debug(`Attempting to resolve handle: ${loginIdentifier}`);
					const resolveResult = await tempAgent.resolveHandle({ handle: loginIdentifier });
					if (resolveResult.success && resolveResult.data.did) {
						this.logger.debug(`Handle resolved: ${loginIdentifier} -> ${resolveResult.data.did}`);
						loginIdentifier = resolveResult.data.did;
					} else {
						this.logger.warn(`Failed to resolve handle ${loginIdentifier}. Proceeding with original identifier. Reason: ${resolveResult.success ? 'DID not found' : 'Resolution unsuccessful'}`);
					}
				} catch (error) {
					this.logger.warn(`Error during handle resolution for ${loginIdentifier}: ${error.message}. Proceeding with original identifier.`);
				}
			}

			const session = new CredentialSession(serviceUrl);
			agent = new AtpAgent(session);
			await agent.login({
				identifier: loginIdentifier,
				password: credentials.appPassword,
			});
		} else if (credentialType === 'oAuth2') {
			const oauth2Credentials = await this.getCredentials('blueskyOAuth2Api');
			// Assuming the PDS URL is stored or can be derived.
			// For OAuth2, the service URL might not be directly in the credential like for App Password.
			// This might need adjustment based on how PDS URL is determined with OAuth.
			// For now, let's assume a default or a configured PDS URL if not in OAuth2 creds.
			// This part is speculative and depends on Bluesky's OAuth implementation details.
			// For the purpose of this example, we'll try to get it from the OAuth credential if available,
			// or use a sensible default or require it as an additional node parameter.
			// Let's assume for now the user is expected to have a blueskyApi credential selected
			// even for OAuth2 to provide the serviceUrl, or it's a fixed URL.
			// This needs clarification based on actual Bluesky OAuth flow.
			// For now, we will try to get serviceUrl from blueskyApi if it exists,
			// otherwise, we might need to add a new field or use a default.
			// Let's assume 'https://bsky.social' as a fallback for the service URL for OAuth.
			let serviceUrlString = 'https://bsky.social/xrpc'; // Default PDS for Bluesky
			try {
				const appPasswordCredentials = (await this.getCredentials('blueskyApi')) as { serviceUrl?: string };
				if (appPasswordCredentials && appPasswordCredentials.serviceUrl) {
					serviceUrlString = appPasswordCredentials.serviceUrl;
				}
			} catch (e) {
				// If blueskyApi is not selected, or doesn't have serviceUrl, use default.
				this.logger.warn(`Could not get serviceUrl from 'blueskyApi' credentials for OAuth2, using default. Error: ${e.message}`);
			}

			const serviceUrl = new URL(serviceUrlString.replace(/\/+$/, ''));
			const session = new CredentialSession(serviceUrl);
			agent = new AtpAgent(session);
			agent.api.xrpc.setHeader('Authorization', `Bearer ${oauth2Credentials.accessToken}`);
			// With OAuth2, the agent might not need a separate login call if the token itself is sufficient
			// and represents an authenticated session. We might need to resume a session or ensure
			// the agent is configured to use the bearer token directly.
			// The @atproto/api might need a way to initialize AtpAgent with an existing access token
			// without calling agent.login(). This depends on the library's capabilities.
			// For now, setting the header directly is a common approach for HTTP clients.
			// If @atproto/api's AtpAgent strictly requires a login method, this needs adjustment.
			// A potential approach:
			// If the agent allows setting session data directly:
			// agent.session = { accessJwt: oauth2Credentials.accessToken, did: '', handle: '' ... };
			// This is highly dependent on the @atproto/api library.
			// For now, we rely on setting the Authorization header, assuming xrpc client will pick it up.

		} else {
			throw new NodeOperationError(this.getNode(), 'Unsupported authentication type');
		}


		for (let i = 0; i < items.length; i++) {
			try {
				switch (operation) {
					/**
					 * Post operations
					 */

					case 'post':
						const postText = this.getNodeParameter('postText', i) as string;
						const langs = this.getNodeParameter('langs', i) as string[];

						// Get website card details if provided
						const websiteCardDetails = this.getNodeParameter('websiteCard', i, {}) as {
							details?: {
								uri: string;
								title: string;
								description: string;
								thumbnailBinaryProperty?: string;
								fetchOpenGraphTags: boolean;
							};
						};

						// Handle thumbnail binary data if provided
						let thumbnailBinary: Buffer | undefined;
						if (websiteCardDetails.details?.thumbnailBinaryProperty
							  && websiteCardDetails.details?.fetchOpenGraphTags === false
						) {
							thumbnailBinary = await this.helpers.getBinaryDataBuffer(
								i,
								websiteCardDetails.details.thumbnailBinaryProperty as string
							);
						}

						let websiteCardUri = websiteCardDetails.details?.uri;
						if (websiteCardUri && !/^https?:\/\//i.test(websiteCardUri)) {
							// Skip relative URLs to prevent TypeError in postOperation
							websiteCardUri = undefined;
						}

						const postData = await postOperation(
							agent,
							postText,
							langs,
							{
								uri: websiteCardUri,
								title: websiteCardDetails.details?.title,
								description: websiteCardDetails.details?.description,
								thumbnailBinary: thumbnailBinary,
								fetchOpenGraphTags: websiteCardDetails.details?.fetchOpenGraphTags,
							}
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
