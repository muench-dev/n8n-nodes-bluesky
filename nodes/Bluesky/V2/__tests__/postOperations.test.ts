import { postOperation } from '../postOperations';
import ogs from 'open-graph-scraper';
import { AtpAgent } from '@atproto/api';

jest.mock('open-graph-scraper');
jest.mock('@atproto/api');

describe('postOperation', () => {
	let mockAgent: jest.Mocked<AtpAgent>;

	beforeEach(() => {
		// Reset mocks before each test
		(ogs as jest.Mock).mockReset();

		// Mock AtpAgent and its methods
		mockAgent = {
			post: jest.fn().mockResolvedValue({ uri: 'test-uri', cid: 'test-cid' }),
			uploadBlob: jest.fn().mockResolvedValue({ data: { blob: 'test-blob' } }),
		} as any; // Using 'any' to simplify mock structure for methods not directly used by postOperation's core logic being tested
	});

	it('should set description to empty string if ogDescription is missing when fetching Open Graph tags', async () => {
		(ogs as jest.Mock).mockResolvedValue({
			error: false,
			result: {
				ogTitle: 'Test Title',
				// ogDescription is intentionally missing
				ogImage: [{ url: 'http://example.com/image.png' }],
				success: true,
			},
		});

		// Mock fetch for image data
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			statusText: 'OK',
			arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
		} as any);

		const postText = 'Test post';
		const langs = ['en'];
		const websiteCard = {
			uri: 'http://example.com',
			fetchOpenGraphTags: true,
			title: '', // Title will be overridden by OG data
			description: 'Initial Description', // This should be overridden
			thumbnailBinary: undefined,
		};

		await postOperation(mockAgent, postText, langs, websiteCard);

		expect(mockAgent.post).toHaveBeenCalledTimes(1);
		const postData = mockAgent.post.mock.calls[0][0];
		expect(postData).toEqual({
			langs: ['en'],
			embed: {
				$type: 'app.bsky.embed.external',
				external: {
					uri: 'http://example.com',
					title: 'Test Title',
					description: '',
					thumb: 'test-blob',
				},
			},
			text: "Test post"
		});
	});

	it('should handle empty websiteCard.description', async () => {
		const postText = 'Test post';
		const langs = ['en'];
		const websiteCard = {
			uri: 'http://example.com',
			fetchOpenGraphTags: false,
			title: 'Test Title',
			description: '',
			thumbnailBinary: undefined,
		};

		await postOperation(mockAgent, postText, langs, websiteCard);

		expect(mockAgent.post).toHaveBeenCalledTimes(1);
		const postData = mockAgent.post.mock.calls[0][0];
		expect(postData).toEqual({
			embed: {
				$type: 'app.bsky.embed.external',
				external: {
					uri: 'http://example.com',
					title: 'Test Title',
					description: '',
					thumb: undefined,
				},
			},
			facets: undefined,
			text: postText,
			langs: ['en'],
		});
	});
});
