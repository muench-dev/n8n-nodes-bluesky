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
						default: 'data',
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

async function resizeImageIfNeeded(imageBuffer: Buffer, maxWidth: number, maxSizeBytes: number): Promise<Buffer> {
	if (imageBuffer.length > maxSizeBytes) {
		try {
			return await sharp(imageBuffer)
				.resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
				.toBuffer();
		} catch (error: any) {
			console.warn(`Failed to resize image: ${error.message}. Returning original image.`);
		}
	}
	return imageBuffer;
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
	await rt.detectFacets(agent);

	let postData: any = {
		text: rt.text || postText,
		langs: langs,
		facets: rt.facets,
	};

	if (websiteCard?.uri) {
		let thumbBlob = undefined;
		const imageSizeLimit = 976.56 * 1024; // 976.56KB in bytes
		const maxWidth = 1000;
		if (websiteCard.thumbnailBinary) {
			websiteCard.thumbnailBinary = await resizeImageIfNeeded(websiteCard.thumbnailBinary, maxWidth, imageSizeLimit);
			const uploadResponse = await agent.uploadBlob(websiteCard.thumbnailBinary, {
				encoding: 'image/png', // Adjust based on expected image type
			});
			thumbBlob = uploadResponse.data.blob;
		}

		if (websiteCard.fetchOpenGraphTags === true) {
			try {
				const ogsResponse = await ogs({ url: websiteCard.uri });
				if (ogsResponse.error) {
					console.error(`Error fetching Open Graph tags: ${ogsResponse.error}`);
				} else {
					if (ogsResponse.result.ogImage) {
						const imageUrl = ogsResponse.result.ogImage[0].url;
						const imageDataResponse = await fetch(imageUrl);
						if (imageDataResponse.ok) {
							const thumbBlobArrayBuffer = await imageDataResponse.arrayBuffer();
							let thumbBuffer = Buffer.from(thumbBlobArrayBuffer);
							thumbBuffer = await resizeImageIfNeeded(thumbBuffer, maxWidth, imageSizeLimit);
							const { data } = await agent.uploadBlob(thumbBuffer);
							thumbBlob = data.blob;
						}
					}
					if (ogsResponse.result.ogTitle) {
						websiteCard.title = ogsResponse.result.ogTitle;
					}
					if (ogsResponse.result.ogDescription) {
						websiteCard.description = ogsResponse.result.ogDescription;
					} else {
						websiteCard.description = '';
					}
				}
			} catch (err: any) {
				console.error(`Failed to fetch Open Graph tags for URL '${websiteCard.uri}': ${err?.message || err}`);
			}
		}

		postData.embed = {
			$type: 'app.bsky.embed.external',
			external: {
				uri: websiteCard.uri,
				title: websiteCard.title,
				description: websiteCard.description,
				thumb: thumbBlob,
			},
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
