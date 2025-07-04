import { AtpAgent, RichText } from '@atproto/api';
import sharp from 'sharp';
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
						default: '',
						description: 'Name of the binary property containing the thumbnail image',
						displayOptions: {
							show: {
								fetchOpenGraphTags: [false],
							},
						}
					},
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

/**
 * Resize an image if it exceeds the specified size or width.
 *
 * @link https://github.com/lovell/sharp/issues/1667
 *
 * @param imageBuffer
 * @param maxWidth
 * @param maxSizeBytes
 */
async function resizeImageIfNeeded(imageBuffer: Buffer, maxWidth: number, maxSizeBytes: number): Promise<Buffer> {
	let quality = 90;
	let buffer = imageBuffer;
	const minQuality = 40;
	const drop = 5;

	while (buffer.length > maxSizeBytes && quality >= minQuality) {
		try {
			buffer = await sharp(imageBuffer)
				.resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
				.jpeg({ quality })
				.toBuffer();
		} catch (error: any) {
			console.warn(`Failed to resize image at quality ${quality}: ${error.message}. Returning original image.`);
			break;
		}
		if (buffer.length <= maxSizeBytes) {
			return buffer;
		}
		quality -= drop;
	}
	if (buffer.length > maxSizeBytes) {
		console.warn(`Image could not be resized below ${maxSizeBytes} bytes. Returning best effort.`);
	}
	return buffer;
}

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
	},
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	let rt = new RichText({ text: postText });
	try {
		await rt.detectFacets(agent);
	} catch (facetsErr: any) {
		console.error(`Failed to detect facets in post text: ${facetsErr?.message || facetsErr}`);
		// Continue without facets if detection fails
	}

	let postData: any = {
		text: rt.text || postText,
		langs: langs,
		facets: rt.facets,
	};

	if (websiteCard?.uri) {
		// Validate URL before proceeding
		try {
			new URL(websiteCard.uri);
		} catch (error) {
			throw new Error(`Invalid URL provided: ${websiteCard.uri}`);
		}

		let thumbBlob = undefined;
		const imageSizeLimit = 976.56 * 1024; // 976.56KB in bytes
		const maxWidth = 1000;

		if (websiteCard.fetchOpenGraphTags === true) {
			try {
				const ogsResponse = await ogs({ url: websiteCard.uri });
				if (ogsResponse.error) {
					console.error(`Error fetching Open Graph tags: ${ogsResponse.error}`);
					if (!websiteCard.title) {
						websiteCard.title = websiteCard.uri || 'Untitled';
					}
				} else {
					if (ogsResponse.result.ogImage) {
						try {
							const imageUrl = ogsResponse.result.ogImage[0].url;
							const imageDataResponse = await fetch(imageUrl);
							if (imageDataResponse.ok) {
								const thumbBlobArrayBuffer = await imageDataResponse.arrayBuffer();
								let thumbBuffer = Buffer.from(thumbBlobArrayBuffer);
								thumbBuffer = await resizeImageIfNeeded(thumbBuffer, maxWidth, imageSizeLimit);
								const { data } = await agent.uploadBlob(thumbBuffer);
								thumbBlob = data.blob;
							}
						} catch (imageErr: any) {
							throw new Error(`Failed to fetch or process image from Open Graph tags: ${imageErr?.message || imageErr}`);
						}
					}
					if (ogsResponse.result.ogTitle) {
						websiteCard.title = ogsResponse.result.ogTitle;
					} else if (!websiteCard.title) {
						websiteCard.title = websiteCard.uri || 'Untitled';
					}
					if (ogsResponse.result.ogDescription) {
						websiteCard.description = ogsResponse.result.ogDescription;
					} else {
						websiteCard.description = '';
					}
				}
			} catch (err: any) {
				console.error(`Failed to fetch Open Graph tags for URL '${websiteCard.uri}': ${err?.message || err}`);
				throw err;
			}
		} else if (websiteCard.thumbnailBinary) {
			// Only upload image if provided and not fetching OG tags
			try {
				websiteCard.thumbnailBinary = await resizeImageIfNeeded(websiteCard.thumbnailBinary, maxWidth, imageSizeLimit);
				const uploadResponse = await agent.uploadBlob(websiteCard.thumbnailBinary);
				thumbBlob = uploadResponse.data.blob;
			} catch (thumbErr: any) {
				console.error(`Failed to process or upload thumbnail: ${thumbErr?.message || thumbErr}`);
				// Don't throw here, continue with the post without the thumbnail
			}
		}

		// Define the thumbnail for the embed
		if (websiteCard.fetchOpenGraphTags === false) {
			// handle thumbnailBinary
			if (websiteCard.thumbnailBinary && !thumbBlob) {
				try {
					websiteCard.thumbnailBinary = await resizeImageIfNeeded(websiteCard.thumbnailBinary, maxWidth, imageSizeLimit);
					const uploadResponse = await agent.uploadBlob(websiteCard.thumbnailBinary);
					thumbBlob = uploadResponse.data.blob;
				} catch (thumbErr: any) {
					console.error(`Failed to process or upload thumbnail: ${thumbErr?.message || thumbErr}`);
				}
			}
		}

		// Always include thumb, even if undefined
		const externalEmbed: any = {
			uri: websiteCard.uri,
			title: websiteCard.title,
			description: websiteCard.description,
		};

		if (thumbBlob) {
			externalEmbed.thumb = thumbBlob;
		}

		postData.embed = {
			$type: 'app.bsky.embed.external',
			external: externalEmbed,
		};
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
