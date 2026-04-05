import { AtpAgent, RichText } from '@atproto/api';
import sharp from 'sharp';
import { INodeExecutionData, INodeProperties, LoggerProxy as Logger } from 'n8n-workflow';
import ogs from 'open-graph-scraper';
import { getLanguageOptions } from './languages';

const IMAGE_SIZE_LIMIT = 976.56 * 1024;
const MAX_IMAGE_WIDTH = 1000;
const MAX_IMAGES = 4;

type WebsiteCardInput = {
	thumbnailBinary?: Buffer;
	description?: string;
	title?: string;
	uri?: string;
	fetchOpenGraphTags?: boolean;
};

type ImageInput = {
	alt?: string;
	mimeType?: string;
	binary?: Buffer;
	width?: number;
	height?: number;
};

type MediaItemInput = {
	alt?: string;
	mimeType?: string;
	binary?: Buffer;
	width?: number;
	height?: number;
};

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
			{ name: 'Create a Post', value: 'post', action: 'Create a post' },
			{ name: 'Delete a Post', value: 'deletePost', action: 'Delete a post' },
			{ name: 'Delete Repost', value: 'deleteRepost', action: 'Delete a repost' },
			{ name: 'Like a Post', value: 'like', action: 'Like a post' },
			{ name: 'Quote a Post', value: 'quote', action: 'Quote a post' },
			{ name: 'Reply to a Post', value: 'reply', action: 'Reply to a post' },
			{ name: 'Repost a Post', value: 'repost', action: 'Repost a post' },
			{ name: 'Unline a Post', value: 'deleteLike', action: 'Unlike a post' },
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
		displayName: 'Reply Text',
		name: 'replyText',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['reply'],
			},
		},
	},
	{
		displayName: 'Quote Text',
		name: 'quoteText',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['quote'],
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
		displayName: 'Reply Languages',
		name: 'replyLangs',
		type: 'multiOptions',
		description:
			'Choose from the list of supported languages. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		options: getLanguageOptions(),
		default: ['en'],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['reply'],
			},
		},
	},
	{
		displayName: 'Quote Languages',
		name: 'quoteLangs',
		type: 'multiOptions',
		description:
			'Choose from the list of supported languages. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		options: getLanguageOptions(),
		default: ['en'],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['quote'],
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
				operation: ['deletePost', 'like', 'deleteLike', 'repost', 'reply', 'quote'],
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
				operation: ['like', 'repost', 'reply', 'quote'],
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
					{ displayName: 'URI', name: 'uri', type: 'string', default: '', required: true },
					{
						displayName: 'Fetch Open Graph Tags',
						name: 'fetchOpenGraphTags',
						type: 'boolean',
						description: 'Whether to fetch open graph tags from the website',
						hint: 'If enabled, the node will fetch open graph tags from the provided URL and use them to create the website card',
						default: false,
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						required: true,
						displayOptions: { show: { fetchOpenGraphTags: [false] } },
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						displayOptions: { show: { fetchOpenGraphTags: [false] } },
					},
					{
						displayName: 'Binary Property',
						name: 'thumbnailBinaryProperty',
						type: 'string',
						default: '',
						description: 'Name of the binary property containing the thumbnail image',
						displayOptions: { show: { fetchOpenGraphTags: [false] } },
					},
				],
			},
		],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post', 'reply'],
				includeMedia: [false],
			},
		},
	},
	{
		displayName: 'Include Media',
		name: 'includeMedia',
		type: 'boolean',
		default: false,
		description: 'Whether to include media attachments',
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post', 'reply'],
			},
		},
	},
	{
		displayName: 'Media Items',
		name: 'mediaItems',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Media Item',
		typeOptions: {
			multiple: true,
			multipleValueButtonText: 'Add Media',
			sortable: true,
		},
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post', 'reply'],
				includeMedia: [true],
			},
		},
		options: [
			{
				displayName: 'Media',
				name: 'media',
				values: [
					{
						displayName: 'Binary Property',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						required: true,
						description: 'Name of the binary property containing the image data',
					},
					{
						displayName: 'Alt Text',
						name: 'altText',
						type: 'string',
						default: '',
						description: 'Alt text for accessibility',
					},
				],
			},
		],
	},
	{
		displayName: 'Image',
		name: 'image',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Image',
		options: [
			{
				displayName: 'Details',
				name: 'details',
				values: [
					{ displayName: 'ALT', name: 'alt', type: 'string', default: '', required: true },
					{
						displayName: 'mimeType',
						name: 'mimeType',
						type: 'string',
						default: '',
						required: true,
					},
					{ displayName: 'Width', name: 'width', type: 'number', default: 400 },
					{ displayName: 'Height', name: 'height', type: 'number', default: 300 },
					{
						displayName: 'Binary Property',
						name: 'binary',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property containing the image',
					},
				],
			},
		],
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['post'],
				includeMedia: [false],
			},
		},
	},
];

async function resizeImageIfNeeded(
	imageBuffer: Buffer,
	maxWidth: number,
	maxSizeBytes: number,
): Promise<Buffer> {
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
			Logger.warn(
				`Failed to resize image at quality ${quality}: ${error.message}. Returning original image.`,
			);
			break;
		}

		if (buffer.length <= maxSizeBytes) {
			return buffer;
		}

		quality -= drop;
	}

	if (buffer.length > maxSizeBytes) {
		Logger.warn(`Image could not be resized below ${maxSizeBytes} bytes. Returning best effort.`);
	}

	return buffer;
}

async function createRichText(agent: AtpAgent, text: string): Promise<RichText> {
	const rt = new RichText({ text });

	try {
		await rt.detectFacets(agent);
	} catch (facetsErr: any) {
		Logger.error(`Failed to detect facets in post text: ${facetsErr?.message || facetsErr}`);
	}

	return rt;
}

async function createImageEmbed(
	agent: AtpAgent,
	images: MediaItemInput[],
): Promise<any | undefined> {
	const validImages = images.filter((image) => Boolean(image.binary));

	if (validImages.length === 0) {
		return undefined;
	}

	if (validImages.length > MAX_IMAGES) {
		throw new Error(`Cannot attach more than ${MAX_IMAGES} images to a post.`);
	}

	const uploadedImages = [];

	for (const image of validImages) {
		const resizedImageBuffer = await resizeImageIfNeeded(
			image.binary!,
			MAX_IMAGE_WIDTH,
			IMAGE_SIZE_LIMIT,
		);
		const uploadResponse = await agent.uploadBlob(resizedImageBuffer, {
			encoding: image.mimeType && image.mimeType.trim() !== '' ? image.mimeType : 'image/jpeg',
		});

		const imageEntry: any = {
			alt: image.alt || '',
			image: uploadResponse.data.blob,
		};

		if (
			typeof image.width === 'number' &&
			typeof image.height === 'number' &&
			image.width > 0 &&
			image.height > 0
		) {
			imageEntry.aspectRatio = { width: image.width, height: image.height };
		}

		uploadedImages.push(imageEntry);
	}

	return {
		$type: 'app.bsky.embed.images',
		images: uploadedImages,
	};
}

async function createWebsiteCardEmbed(
	agent: AtpAgent,
	websiteCard?: WebsiteCardInput,
): Promise<any | undefined> {
	if (!websiteCard?.uri) {
		return undefined;
	}

	try {
		new URL(websiteCard.uri);
	} catch {
		throw new Error(`Invalid URL provided: ${websiteCard.uri}`);
	}

	let thumbBlob = undefined;
	let title = websiteCard.title;
	let description = websiteCard.description;

	if (websiteCard.fetchOpenGraphTags === true) {
		try {
			const ogsResponse = await ogs({ url: websiteCard.uri });
			if (!ogsResponse.error) {
				const ogImage = (ogsResponse.result as any).ogImage;
				let imageUrl: string | undefined;
				if (typeof ogImage === 'string') {
					imageUrl = ogImage;
				} else if (Array.isArray(ogImage) && ogImage.length > 0) {
					const first = ogImage[0];
					imageUrl = typeof first === 'string' ? first : first?.url;
				} else if (ogImage && typeof ogImage === 'object' && 'url' in ogImage) {
					imageUrl = (ogImage as any).url;
				}

				if (imageUrl) {
					const imageDataResponse = await fetch(imageUrl);
					if (imageDataResponse.ok) {
						const thumbBlobArrayBuffer = await imageDataResponse.arrayBuffer();
						const thumbBuffer = await resizeImageIfNeeded(
							Buffer.from(thumbBlobArrayBuffer),
							MAX_IMAGE_WIDTH,
							IMAGE_SIZE_LIMIT,
						);
						const { data } = await agent.uploadBlob(thumbBuffer, { encoding: 'image/jpeg' });
						thumbBlob = data.blob;
					}
				}

				title = ogsResponse.result.ogTitle || title || websiteCard.uri;
				description = ogsResponse.result.ogDescription || description || '';
			} else if (!title) {
				title = websiteCard.uri;
				description = description || '';
			}
		} catch (err: any) {
			Logger.error(
				`Failed to fetch Open Graph tags for URL '${websiteCard.uri}': ${err?.message || err}`,
			);
		}
	} else if (websiteCard.thumbnailBinary) {
		try {
			const resized = await resizeImageIfNeeded(
				websiteCard.thumbnailBinary,
				MAX_IMAGE_WIDTH,
				IMAGE_SIZE_LIMIT,
			);
			const uploadResponse = await agent.uploadBlob(resized, { encoding: 'image/jpeg' });
			thumbBlob = uploadResponse.data.blob;
		} catch (thumbErr: any) {
			Logger.error(`Failed to process or upload thumbnail: ${thumbErr?.message || thumbErr}`);
		}
	}

	const externalEmbed: any = {
		uri: websiteCard.uri,
		title: title,
		description: description,
	};

	if (thumbBlob) {
		externalEmbed.thumb = thumbBlob;
	}

	return {
		$type: 'app.bsky.embed.external',
		external: externalEmbed,
	};
}

async function buildEmbed(
	agent: AtpAgent,
	websiteCard?: WebsiteCardInput,
	image?: ImageInput,
	mediaItems: MediaItemInput[] = [],
): Promise<any | undefined> {
	const normalizedImages = mediaItems.length > 0 ? mediaItems : image?.binary ? [image] : [];
	const imageEmbed = await createImageEmbed(agent, normalizedImages);
	if (imageEmbed) {
		return imageEmbed;
	}

	return createWebsiteCardEmbed(agent, websiteCard);
}

export async function postOperation(
	agent: AtpAgent,
	postText: string,
	langs: string[],
	websiteCard?: WebsiteCardInput,
	image?: ImageInput,
	mediaItems: MediaItemInput[] = [],
): Promise<INodeExecutionData[]> {
	const rt = await createRichText(agent, postText);
	const postData: any = {
		text: rt.text || postText,
		langs,
		facets: rt.facets,
	};

	const embed = await buildEmbed(agent, websiteCard, image, mediaItems);
	if (embed) {
		postData.embed = embed;
	}

	const postResponse: { uri: string; cid: string } = await agent.post(postData);

	return [
		{
			json: {
				uri: postResponse.uri,
				cid: postResponse.cid,
			},
		},
	];
}

export async function replyOperation(
	agent: AtpAgent,
	replyText: string,
	langs: string[],
	parentUri: string,
	parentCid: string,
	websiteCard?: WebsiteCardInput,
	mediaItems: MediaItemInput[] = [],
): Promise<INodeExecutionData[]> {
	const rt = await createRichText(agent, replyText);
	const parentThreadResponse = await agent.app.bsky.feed.getPostThread({ uri: parentUri });
	let root = { uri: parentUri, cid: parentCid };
	const thread = parentThreadResponse.data.thread as
		| { post?: { record?: { reply?: { root?: { uri: string; cid: string } } } } }
		| undefined;
	const nestedRoot = thread?.post?.record?.reply?.root;
	if (nestedRoot?.uri && nestedRoot?.cid) {
		root = nestedRoot;
	}

	const replyData: any = {
		text: rt.text || replyText,
		langs,
		facets: rt.facets,
		reply: {
			root,
			parent: { uri: parentUri, cid: parentCid },
		},
	};

	const embed = await buildEmbed(agent, websiteCard, undefined, mediaItems);
	if (embed) {
		replyData.embed = embed;
	}

	const replyResponse: { uri: string; cid: string } = await agent.post(replyData);

	return [
		{
			json: {
				uri: replyResponse.uri,
				cid: replyResponse.cid,
			},
		},
	];
}

export async function quoteOperation(
	agent: AtpAgent,
	quoteText: string,
	langs: string[],
	quotedUri: string,
	quotedCid: string,
): Promise<INodeExecutionData[]> {
	const rt = await createRichText(agent, quoteText);
	const quoteResponse: { uri: string; cid: string } = await agent.post({
		text: rt.text || quoteText,
		langs,
		facets: rt.facets,
		embed: {
			$type: 'app.bsky.embed.record',
			record: {
				uri: quotedUri,
				cid: quotedCid,
			},
		},
	});

	return [
		{
			json: {
				uri: quoteResponse.uri,
				cid: quoteResponse.cid,
			},
		},
	];
}

export async function deletePostOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	await agent.deletePost(uri);

	return [
		{
			json: {
				uri,
			},
		},
	];
}

export async function likeOperation(
	agent: AtpAgent,
	uri: string,
	cid: string,
): Promise<INodeExecutionData[]> {
	const likeResponse: { uri: string; cid: string } = await agent.like(uri, cid);

	return [
		{
			json: {
				uri: likeResponse.uri,
				cid: likeResponse.cid,
			},
		},
	];
}

export async function deleteLikeOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	await agent.deleteLike(uri);

	return [
		{
			json: {
				uri,
			},
		},
	];
}

export async function repostOperation(
	agent: AtpAgent,
	uri: string,
	cid: string,
): Promise<INodeExecutionData[]> {
	const repostResult: { uri: string; cid: string } = await agent.repost(uri, cid);

	return [
		{
			json: {
				uri: repostResult.uri,
				cid: repostResult.cid,
			},
		},
	];
}

export async function deleteRepostOperation(
	agent: AtpAgent,
	uri: string,
): Promise<INodeExecutionData[]> {
	await agent.deleteRepost(uri);

	return [
		{
			json: {
				uri,
			},
		},
	];
}
