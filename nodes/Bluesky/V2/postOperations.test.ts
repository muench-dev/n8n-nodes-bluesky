import { AtpAgent, RichText } from '@atproto/api';
import { postOperation } from './postOperations'; // Assuming postOperations.ts is in the same directory
import ogs from 'open-graph-scraper';

// Mock AtpAgent and RichText
jest.mock('@atproto/api', () => {
	const actualApi = jest.requireActual('@atproto/api');
	return {
		...actualApi,
		AtpAgent: jest.fn().mockImplementation(() => ({
			post: jest.fn().mockResolvedValue({ uri: 'at://did:plc:test/app.bsky.feed.post/123', cid: 'bafy...' }),
			uploadBlob: jest.fn().mockResolvedValue({ data: { blob: { $type: 'blob', ref: 'test-blob-ref', mimeType: 'image/png', size: 100 } } }),
		})),
		RichText: jest.fn().mockImplementation(({ text }) => ({
			text: text,
			facets: [], // Default mock, can be overridden in tests
			detectFacets: jest.fn().mockResolvedValue(undefined),
		})),
	};
});

// Mock open-graph-scraper
jest.mock('open-graph-scraper', () => jest.fn());

// Mock global fetch
global.fetch = jest.fn();

describe('postOperation', () => {
	let agent: AtpAgent;
	let consoleWarnSpy: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		agent = new AtpAgent(); // Creates a mocked instance due to jest.mock above
		consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn during tests
	});

	afterEach(() => {
		consoleWarnSpy.mockRestore();
	});

	const defaultPostText = 'This is a test post.';
	const defaultLangs = ['en'];
	const defaultWebsiteCardUri = 'https://example.com';

	// Scenario 1: Card Fetch Success
	it('should include embed object when card fetch is successful', async () => {
		const mockOgsData = {
			error: false,
			result: {
				success: true,
				ogTitle: 'Test Title',
				ogDescription: 'Test Description',
				ogImage: [{ url: 'https://example.com/image.png' }],
			},
		};
		(ogs as jest.Mock).mockResolvedValue(mockOgsData);
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)), // Mock image data
		});

		const websiteCardDetails = {
			uri: defaultWebsiteCardUri,
			title: 'Initial Title', // This should be overridden by OGS
			description: 'Initial Description', // Overridden by OGS
			thumbnailBinary: undefined,
			fetchOpenGraphTags: true,
			fallbackToLinkFacetOnError: false,
		};

		const result = await postOperation(agent, defaultPostText, defaultLangs, websiteCardDetails);

		expect(ogs).toHaveBeenCalledWith({ url: defaultWebsiteCardUri });
		expect(global.fetch).toHaveBeenCalledWith(mockOgsData.result.ogImage[0].url);
		expect(agent.uploadBlob).toHaveBeenCalledTimes(1); // For the thumbnail
		expect(agent.post).toHaveBeenCalledTimes(1);

		const postCallArg = (agent.post as jest.Mock).mock.calls[0][0];
		expect(postCallArg.embed).toBeDefined();
		expect(postCallArg.embed.$type).toBe('app.bsky.embed.external');
		expect(postCallArg.embed.external.uri).toBe(defaultWebsiteCardUri);
		expect(postCallArg.embed.external.title).toBe(mockOgsData.result.ogTitle);
		expect(postCallArg.embed.external.description).toBe(mockOgsData.result.ogDescription);
		expect(postCallArg.embed.external.thumb).toBeDefined();

		expect(result[0].json.uri).toBeDefined();
		expect(result[0].json.cid).toBeDefined();
	});

	// Scenario 2: Card Fetch Failure (OGS Error) - Fallback Enabled
	it('should not include embed and not throw when card fetch fails (OGS error) and fallback is enabled', async () => {
		(ogs as jest.Mock).mockResolvedValue({ error: true, result: { success: false } }); // Simulate OGS error

		const websiteCardDetails = {
			uri: defaultWebsiteCardUri,
			title: 'Test Title',
			description: 'Test Description',
			thumbnailBinary: undefined,
			fetchOpenGraphTags: true,
			fallbackToLinkFacetOnError: true, // Fallback ENABLED
		};

		const result = await postOperation(agent, defaultPostText, defaultLangs, websiteCardDetails);

		expect(ogs).toHaveBeenCalledWith({ url: defaultWebsiteCardUri });
		expect(global.fetch).not.toHaveBeenCalled(); // Should not attempt to fetch image if OGS fails
		expect(agent.uploadBlob).not.toHaveBeenCalled(); // No thumbnail to upload

		expect(agent.post).toHaveBeenCalledTimes(1);
		const postCallArg = (agent.post as jest.Mock).mock.calls[0][0];
		expect(postCallArg.embed).toBeUndefined(); // Embed should NOT be present

		expect(result[0].json.uri).toBeDefined(); // Post should still succeed
		expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Website card creation for "${defaultWebsiteCardUri}" failed`));
	});

	// Scenario 3: Card Fetch Failure (OGS Error) - Fallback Disabled
	it('should throw error when card fetch fails (OGS error) and fallback is disabled', async () => {
		const ogsErrorMessage = 'OGS failed spectacularly';
		(ogs as jest.Mock).mockResolvedValue({ error: true, result: { success: false, ogTitle: ogsErrorMessage } }); // Simulate OGS error

		const websiteCardDetails = {
			uri: defaultWebsiteCardUri,
			title: 'Test Title',
			description: 'Test Description',
			thumbnailBinary: undefined,
			fetchOpenGraphTags: true,
			fallbackToLinkFacetOnError: false, // Fallback DISABLED
		};

		await expect(
			postOperation(agent, defaultPostText, defaultLangs, websiteCardDetails)
		).rejects.toThrow(`Failed to create website card for "${defaultWebsiteCardUri}": Error fetching Open Graph tags: ${ogsErrorMessage}`);

		expect(ogs).toHaveBeenCalledWith({ url: defaultWebsiteCardUri });
		expect(global.fetch).not.toHaveBeenCalled();
		expect(agent.uploadBlob).not.toHaveBeenCalled();
		expect(agent.post).not.toHaveBeenCalled(); // Post should NOT be attempted
		expect(consoleWarnSpy).not.toHaveBeenCalled();
	});

	// Scenario 4: Card Fetch Failure (Image Fetch Error) - Fallback Enabled
	it('should not include embed and not throw when image fetch fails and fallback is enabled', async () => {
		const mockOgsData = {
			error: false,
			result: {
				success: true,
				ogTitle: 'Test Title',
				ogDescription: 'Test Description',
				ogImage: [{ url: 'https://example.com/image.png' }],
			},
		};
		(ogs as jest.Mock).mockResolvedValue(mockOgsData);
		(global.fetch as jest.Mock).mockResolvedValue({ // Simulate image fetch failure
			ok: false,
			statusText: 'Not Found',
		});

		const websiteCardDetails = {
			uri: defaultWebsiteCardUri,
			title: 'Initial Title',
			description: 'Initial Description',
			thumbnailBinary: undefined,
			fetchOpenGraphTags: true,
			fallbackToLinkFacetOnError: true, // Fallback ENABLED
		};

		const result = await postOperation(agent, defaultPostText, defaultLangs, websiteCardDetails);

		expect(ogs).toHaveBeenCalledWith({ url: defaultWebsiteCardUri });
		expect(global.fetch).toHaveBeenCalledWith(mockOgsData.result.ogImage[0].url);
		expect(agent.uploadBlob).not.toHaveBeenCalled(); // Should not upload if fetch fails

		expect(agent.post).toHaveBeenCalledTimes(1);
		const postCallArg = (agent.post as jest.Mock).mock.calls[0][0];
		expect(postCallArg.embed).toBeUndefined(); // Embed should NOT be present

		expect(result[0].json.uri).toBeDefined(); // Post should still succeed
		expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Website card creation for "${defaultWebsiteCardUri}" failed: Error fetching image data from ${mockOgsData.result.ogImage[0].url}: Not Found`));
	});

	// Scenario 5: Card Fetch Failure (Image Fetch Error) - Fallback Disabled
	it('should throw error when image fetch fails and fallback is disabled', async () => {
		const mockOgsData = {
			error: false,
			result: {
				success: true,
				ogTitle: 'Test Title',
				ogDescription: 'Test Description',
				ogImage: [{ url: 'https://example.com/image.png' }],
			},
		};
		(ogs as jest.Mock).mockResolvedValue(mockOgsData);
		const fetchErrorStatusText = 'Forbidden';
		(global.fetch as jest.Mock).mockResolvedValue({ // Simulate image fetch failure
			ok: false,
			statusText: fetchErrorStatusText,
		});

		const websiteCardDetails = {
			uri: defaultWebsiteCardUri,
			title: 'Initial Title',
			description: 'Initial Description',
			thumbnailBinary: undefined,
			fetchOpenGraphTags: true,
			fallbackToLinkFacetOnError: false, // Fallback DISABLED
		};

		await expect(
			postOperation(agent, defaultPostText, defaultLangs, websiteCardDetails)
		).rejects.toThrow(`Failed to create website card for "${defaultWebsiteCardUri}": Error fetching image data from ${mockOgsData.result.ogImage[0].url}: ${fetchErrorStatusText}`);

		expect(ogs).toHaveBeenCalledWith({ url: defaultWebsiteCardUri });
		expect(global.fetch).toHaveBeenCalledWith(mockOgsData.result.ogImage[0].url);
		expect(agent.uploadBlob).not.toHaveBeenCalled();
		expect(agent.post).not.toHaveBeenCalled();
		expect(consoleWarnSpy).not.toHaveBeenCalled();
	});

	// Scenario 6: No Website Card URI Provided
	it('should not attempt card processing if no website card URI is provided (undefined URI)', async () => {
		const websiteCardDetails = {
			uri: undefined, // URI is undefined
			title: 'Test Title',
			description: 'Test Description',
			thumbnailBinary: undefined,
			fetchOpenGraphTags: true,
			fallbackToLinkFacetOnError: false,
		};

		// @ts-expect-error testing undefined uri which is not allowed by type but possible from user
		const result = await postOperation(agent, defaultPostText, defaultLangs, websiteCardDetails);

		expect(ogs).not.toHaveBeenCalled();
		expect(global.fetch).not.toHaveBeenCalled();
		expect(agent.uploadBlob).not.toHaveBeenCalled(); // No card processing implies no blob upload for card

		expect(agent.post).toHaveBeenCalledTimes(1);
		const postCallArg = (agent.post as jest.Mock).mock.calls[0][0];
		expect(postCallArg.embed).toBeUndefined(); // No embed expected

		expect(result[0].json.uri).toBeDefined();
		expect(consoleWarnSpy).not.toHaveBeenCalled();
	});

	it('should not attempt card processing if websiteCard object itself is undefined', async () => {
		const result = await postOperation(agent, defaultPostText, defaultLangs, undefined); // websiteCard is undefined

		expect(ogs).not.toHaveBeenCalled();
		expect(global.fetch).not.toHaveBeenCalled();
		expect(agent.uploadBlob).not.toHaveBeenCalled();

		expect(agent.post).toHaveBeenCalledTimes(1);
		const postCallArg = (agent.post as jest.Mock).mock.calls[0][0];
		expect(postCallArg.embed).toBeUndefined();

		expect(result[0].json.uri).toBeDefined();
		expect(consoleWarnSpy).not.toHaveBeenCalled();
	});

});
