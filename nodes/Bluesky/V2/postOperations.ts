import { AtpAgent, RichText } from '@atproto/api';
import { INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { getLanguageOptions } from './languages';
import ogs from 'open-graph-scraper';

export const postProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		default: 'post',
		displayOptions: {
			show: {
				resource: ['post'],
			},
		},
		name: 'operation',
		noDataExpression: true,
		options: [
			{
				name: 'Create a Post',
				value: 'post',
				action: 'Create a post',
			},
			{
				name: 'Delete a Post',
				value: 'deletePost',
				action: 'Delete a post',
			},
			{
				name: 'Delete Repost',
				value: 'deleteRepost',
				action: 'Delete a repost',
			},
			{
				name: 'Like a Post',
				value: 'like',
				action: 'Like a post',
			},
			{
				name: 'Repost a Post',
				value: 'repost',
				action: 'Repost a post',
			},
			{
				name: 'Unline a Post',
				value: 'deleteLike',
				action: 'Unlike a post',
			},
		],
		type: 'options',
	},
	{
		displayName: 'Post Text',
		name: 'postText',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post'],
			},
		},
	},
	{
		displayName: 'Language Names or IDs',
		name: 'langs',
		type: 'multiOptions',
		description:
			'Choose from the list of supported languages. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		options: getLanguageOptions(),
		default: ['en'],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post'],
			},
		},
	},
	{
		displayName: 'Uri',
		name: 'uri',
		type: 'string',
		description: 'The URI of the post',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['deletePost', 'like', 'deleteLike', 'repost'],
			},
		},
	},
	{
		displayName: 'Cid',
		name: 'cid',
		type: 'string',
		description: 'The CID of the post',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['like', 'repost'],
			},
		},
	},
	{
		displayName: 'Website Card',
		name: 'websiteCard',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Website Card',
		options: [
			{
				displayName: 'Details',
				name: 'details',
				values: [
					{
						displayName: 'URI',
						name: 'uri',
						type: 'string',
						default: '',
						required: true,
					},
					{
						displayName: 'Fetch Open Graph Tags',
						name: 'fetchOpenGraphTags',
						type: 'boolean',
						description: 'Whether to fetch open graph tags from the website',
						hint: 'If enabled, the node will fetch the open graph tags from the website URL provided and use them to create a website card',
						default: false,
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						required: true,
						displayOptions: {
							show: {
								fetchOpenGraphTags: [false],
							},
						}
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								fetchOpenGraphTags: [false],
							},
						}
					},
					{
						displayName: 'Binary Property',
						name: 'thumbnailBinaryProperty',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property containing the thumbnail image',
						displayOptions: {
							show: {
								fetchOpenGraphTags: [false],
							},
						}
					},
					{
						displayName: 'Fallback to Link Facet on Error',
						name: 'fallbackToLinkFacetOnError',
						type: 'boolean',
						default: false,
						description: 'If true, creates a simple link facet if fetching website card details fails, instead of failing the post.',
						displayOptions: {
							show: {
								// Show if websiteCard URI is not empty.
								// This assumes 'uri' is a sibling field within the same 'details' collection.
								// The path might need adjustment if 'uri' is at a different level.
								'uri': [{value: "", condition: "ne"}]
							},
						},
					}
				],
			},
		],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post'],
			},
		},
	},
];

export async function postOperation(
	agent: AtpAgent,
	postText: string,
	langs: string[],
	websiteCard?: {
		thumbnailBinary: Buffer | undefined;
		description: string | undefined;
		title: string | undefined;
		uri: string | undefined;
		fetchOpenGraphTags: boolean | undefined;
		fallbackToLinkFacetOnError?: boolean;
	},
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	let rt = new RichText({ text: postText });
	await rt.detectFacets(agent);

	let postData: any = {
		text: rt.text,
		langs: langs,
		facets: rt.facets,
	};

	if (websiteCard?.uri) {
		try {
			let thumbBlob = undefined;
			// Use a temporary variable for websiteCard title and description
			// as they might be updated by OGS and we need the original in case of fallback.
			let cardTitle = websiteCard.title;
			let cardDescription = websiteCard.description;

			if (websiteCard.thumbnailBinary) {
				const uploadResponse = await agent.uploadBlob(websiteCard.thumbnailBinary, {
					encoding: 'image/png', // Adjust based on expected image type
				});
				thumbBlob = uploadResponse.data.blob;
			}

			if (websiteCard.fetchOpenGraphTags === true) {
				const ogsResponse = await ogs({ url: websiteCard.uri });
				if (ogsResponse.error || !ogsResponse.result.success) {
					throw new Error(`Error fetching Open Graph tags: ${ogsResponse.result?.ogTitle || 'Unknown error'}`);
				}
				if (ogsResponse.result.ogImage?.length) {
					const imageUrl = ogsResponse.result.ogImage[0].url;
					const imageDataResponse = await fetch(imageUrl);
					if (!imageDataResponse.ok) {
						throw new Error(`Error fetching image data from ${imageUrl}: ${imageDataResponse.statusText}`);
					}
					const thumbBlobArrayBuffer = await imageDataResponse.arrayBuffer();
					const imageBuffer = Buffer.from(thumbBlobArrayBuffer);
					const { data } = await agent.uploadBlob(imageBuffer); // MIME type auto-detected by agent
					thumbBlob = data.blob;
				}
				if (ogsResponse.result.ogTitle) {
					cardTitle = ogsResponse.result.ogTitle;
				}
				if (ogsResponse.result.ogDescription) {
					cardDescription = ogsResponse.result.ogDescription;
				}
			}

			postData.embed = {
				$type: 'app.bsky.embed.external',
				external: {
					uri: websiteCard.uri,
					title: cardTitle,
					description: cardDescription,
					thumb: thumbBlob,
				},
			};
		} catch (error) {
			if (websiteCard.fallbackToLinkFacetOnError) {
				console.warn(`Website card creation for "${websiteCard.uri}" failed: ${error.message}. Posting without card embed (fallback enabled).`);
				postData.embed = undefined; // Ensure embed is not set
				// The original rt.detectFacets() on postText handles existing links in text.
				// If the card URI was also in the text as a plain URL, it's already faceted.
			} else {
				// Fallback not enabled, re-throw the error to fail the operation.
				// It's good practice to wrap the original error or provide a more specific one.
				throw new Error(`Failed to create website card for "${websiteCard.uri}": ${error.message}`);
			}
		}
	}

	const postResponse: { uri: string; cid: string } = await agent.post(postData);

	returnData.push({
		json: {
			uri: postResponse.uri,
			cid: postResponse.cid,
		},
	});

	return returnData;
}

export async function deletePostOperation(agent: AtpAgent, uri: string): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	await agent.deletePost(uri)

	returnData.push({
		json: {
			uri: uri,
		},
	});

	return returnData;
}

export async function likeOperation(
	agent: AtpAgent,
	uri: string,
	cid: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// https://docs.bsky.app/docs/tutorials/like-repost#liking-a-post
	const likeResponse: { uri: string; cid: string } = await agent.like(uri, cid);

	returnData.push({
		json: {
			uri: likeResponse.uri,
			cid: likeResponse.cid,
		},
	});

	return returnData;
}

export async function deleteLikeOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// no response from deleteLike
	// https://docs.bsky.app/docs/tutorials/like-repost#unliking-a-post
	await agent.deleteLike(uri);

	returnData.push({
		json: {
			uri: uri,
		},
	});

	return returnData;
}

export async function repostOperation(
	agent: AtpAgent,
	uri: string,
	cid: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// https://docs.bsky.app/docs/tutorials/like-repost#quote-reposting
	const repostResult: { uri: string; cid: string } = await agent.repost(uri, cid);

	returnData.push({
		json: {
			uri: repostResult.uri,
			cid: repostResult.cid,
		},
	});

	return returnData;
}

export async function deleteRepostOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	// no response from deleteRepost
	await agent.deleteRepost(uri);

	returnData.push({
		json: {
			uri: uri,
		},
	});

	return returnData;
}
