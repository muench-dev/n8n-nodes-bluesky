import { AtpAgent, AppBskyFeedGetAuthorFeed,AppBskyFeedGetTimeline,AppBskyFeedDefs,AppBskyActorDefs } from '@atproto/api';
import { _getAuthorFeedInternal, _getTimelineInternal } from '../feedOperations';

// Mock the entire @atproto/api module
jest.mock('@atproto/api');

// Restore actual implementations for type guards
const { AppBskyFeedDefs: ActualAppBskyFeedDefs } = jest.requireActual('@atproto/api');

// After jest.mock, all exports are jest.fn(). We need to make them use the actual implementation.
// Cast to JestMockedFunction for type safety with mockImplementation.
(AppBskyFeedDefs.isPostView as jest.MockedFunction<typeof ActualAppBskyFeedDefs.isPostView>)
	.mockImplementation(ActualAppBskyFeedDefs.isPostView);
(AppBskyFeedDefs.isNotFoundPost as jest.MockedFunction<typeof ActualAppBskyFeedDefs.isNotFoundPost>)
	.mockImplementation(ActualAppBskyFeedDefs.isNotFoundPost);
(AppBskyFeedDefs.isBlockedPost as jest.MockedFunction<typeof ActualAppBskyFeedDefs.isBlockedPost>)
	.mockImplementation(ActualAppBskyFeedDefs.isBlockedPost);
(AppBskyFeedDefs.isReasonRepost as jest.MockedFunction<typeof ActualAppBskyFeedDefs.isReasonRepost>)
	.mockImplementation(ActualAppBskyFeedDefs.isReasonRepost);


const mockGetAuthorFeed = jest.fn();
const mockGetTimeline = jest.fn();

const MockedAtpAgent = AtpAgent as jest.MockedClass<typeof AtpAgent>;

MockedAtpAgent.mockImplementation(() => {
	return {
		getAuthorFeed: mockGetAuthorFeed,
		getTimeline: mockGetTimeline,
	} as any;
});


describe('FeedOperations', () => {
	let agent: jest.Mocked<AtpAgent>;

	beforeEach(() => {
		agent = new MockedAtpAgent({ service: 'https://bsky.social' }) as jest.Mocked<AtpAgent>;
		(agent.getAuthorFeed as jest.Mock).mockImplementation(mockGetAuthorFeed);
		(agent.getTimeline as jest.Mock).mockImplementation(mockGetTimeline);

		mockGetAuthorFeed.mockClear();
		mockGetTimeline.mockClear();

		MockedAtpAgent.mockClear();
		MockedAtpAgent.mockImplementation(() => {
			return {
				getAuthorFeed: mockGetAuthorFeed,
				getTimeline: mockGetTimeline,
			} as any;
		});
	});

	const sampleAuthor = (did: string, handleSuffix: string = 'test'): AppBskyActorDefs.ProfileViewBasic => ({
		$type: 'app.bsky.actor.defs#profileViewBasic',
		did: did,
		handle: `${handleSuffix}.bsky.social`,
		displayName: `User ${did.slice(-4)}`,
		avatar: 'https://example.com/avatar.jpg',
		viewer: {},
		labels: [],
	});

	const samplePostRecord = (text: string): { $type: 'app.bsky.feed.post', text: string, createdAt: string } => ({
		$type: 'app.bsky.feed.post',
		text: text,
		createdAt: new Date().toISOString(),
	});

	const samplePostView = (id: string, text: string, actorDid: string = 'did:plc:testactor'): AppBskyFeedDefs.PostView => ({
		$type: 'app.bsky.feed.defs#postView',
		uri: `at://${actorDid}/app.bsky.feed.post/${id}`,
		cid: `cid${id}`,
		author: sampleAuthor(actorDid, id),
		record: samplePostRecord(text) as unknown as AppBskyFeedDefs.PostView['record'],
		indexedAt: new Date().toISOString(),
		viewer: {},
		labels: [],
		likeCount: 0,
		repostCount: 0,
		replyCount: 0,
	});

	const createReasonRepost = (reposterDid: string, indexedAt: string): AppBskyFeedDefs.ReasonRepost => ({
		$type: 'app.bsky.feed.defs#reasonRepost',
		by: sampleAuthor(reposterDid, 'reposter'),
		indexedAt: indexedAt,
	});


	describe('_getAuthorFeedInternal', () => {
		const actor = 'did:plc:testactor';
		const limit = 10;

		beforeEach(() => {
			mockGetAuthorFeed.mockClear();
		});

		it('should return mapped feed items for a successful response', async () => {
			const mockFeedItems: AppBskyFeedDefs.FeedViewPost[] = [
				{ post: samplePostView('post1', 'Hello World', actor) },
				{ post: samplePostView('post2', 'Another Post', actor) },
			];
			const mockApiResponse: AppBskyFeedGetAuthorFeed.Response = {
				success: true, data: { feed: mockFeedItems, cursor: 'cursor123' }, headers: {},
			};
			mockGetAuthorFeed.mockResolvedValue(mockApiResponse);
			const result = await _getAuthorFeedInternal(agent, { actor, limit });
			expect(mockGetAuthorFeed).toHaveBeenCalledWith({ actor, limit });
			expect(result).toHaveLength(2);
		});

		it('should return an empty array for an empty feed response', async () => {
			const mockApiResponse: AppBskyFeedGetAuthorFeed.Response = {
				success: true, data: { feed: [] }, headers: {},
			};
			mockGetAuthorFeed.mockResolvedValue(mockApiResponse);
			const result = await _getAuthorFeedInternal(agent, { actor, limit });
			expect(result).toEqual([]);
		});

		it('should correctly map all potential fields in a feed item for getAuthorFeed', async () => {
			const detailedPost = samplePostView('postDetailed', 'Detailed post content', actor);
			const parentPostSimple = samplePostView('parentPost', 'Parent content', 'did:plc:parentactor');
			const rootPostSimple = samplePostView('rootPost', 'Root content', 'did:plc:rootactor');

			const replyRef: AppBskyFeedDefs.ReplyRef = {
				root: rootPostSimple as any as AppBskyFeedDefs.ReplyRef['root'],
				parent: parentPostSimple as any as AppBskyFeedDefs.ReplyRef['parent'],
			};
			const reasonRepost = createReasonRepost('did:plc:reposter', new Date().toISOString());

			const mockFeedItem: AppBskyFeedDefs.FeedViewPost = {
				post: detailedPost,
				reply: replyRef,
				reason: reasonRepost as any as AppBskyFeedDefs.FeedViewPost['reason'],
			};
			const mockApiResponse: AppBskyFeedGetAuthorFeed.Response = { success: true, data: { feed: [mockFeedItem] }, headers: {} };
			mockGetAuthorFeed.mockResolvedValue(mockApiResponse);

			const result = await _getAuthorFeedInternal(agent, { actor, limit });
			expect(result).toHaveLength(1);
			const output = result[0];

			expect(output.uri).toBe(detailedPost.uri);
			expect(output.record.text).toBe('Detailed post content');
			expect(output.replyParent?.uri).toBe(parentPostSimple.uri);
			expect(output.replyParent?.cid).toBe(parentPostSimple.cid);
			expect(output.repostedBy?.did).toBe(reasonRepost.by.did);
		});

		it('should throw an error if API call fails for getAuthorFeed', async () => {
			mockGetAuthorFeed.mockResolvedValue({ success: false, error: 'Unauthorized', message: 'Auth required' });
			await expect(_getAuthorFeedInternal(agent, { actor, limit })).rejects.toThrow('Failed to fetch author feed: Unauthorized - Auth required');
		});
	});

	describe('_getTimelineInternal', () => {
		const algorithm = 'reverse-chronological';
		const limit = 15;

		beforeEach(() => {
			mockGetTimeline.mockClear();
		});


		it('should return mapped feed items for a successful timeline response', async () => {
			const mockFeedItems: AppBskyFeedDefs.FeedViewPost[] = [
				{ post: samplePostView('timelinePost1', 'Timeline Hello') },
				{ post: samplePostView('timelinePost2', 'Timeline World') },
			];
			const mockApiResponse: AppBskyFeedGetTimeline.Response = {
				success: true, data: { feed: mockFeedItems, cursor: 'timelineCursor456' }, headers: {},
			};
			mockGetTimeline.mockResolvedValue(mockApiResponse);
			const result = await _getTimelineInternal(agent, { algorithm, limit });
			expect(mockGetTimeline).toHaveBeenCalledWith({ algorithm, limit });
			expect(result).toHaveLength(2);
		});

		it('should return an empty array for an empty timeline response', async () => {
			const mockApiResponse: AppBskyFeedGetTimeline.Response = {
				success: true, data: { feed: [] }, headers: {},
			};
			mockGetTimeline.mockResolvedValue(mockApiResponse);
			const result = await _getTimelineInternal(agent, { limit });
			expect(result).toEqual([]);
		});

		it('should correctly map all potential fields in a timeline item', async () => {
			const actorDidForTimeline = 'did:plc:timelineposter';
			const detailedPost = samplePostView('postDetailedTimeline', 'Detailed timeline post', actorDidForTimeline);
			const parentPostSimple = samplePostView('parentPostTimeline', 'Parent content', 'did:plc:parentactorTimeline');
			const rootPostSimple = samplePostView('rootPostTimeline', 'Root content', 'did:plc:rootactorTimeline');

			const replyRef: AppBskyFeedDefs.ReplyRef = {
				root: rootPostSimple as any as AppBskyFeedDefs.ReplyRef['root'],
				parent: parentPostSimple as any as AppBskyFeedDefs.ReplyRef['parent'],
			};
			const reasonRepost = createReasonRepost('did:plc:timelinereposter', new Date().toISOString());

			const mockFeedItem: AppBskyFeedDefs.FeedViewPost = {
				post: detailedPost,
				reply: replyRef,
				reason: reasonRepost as any as AppBskyFeedDefs.FeedViewPost['reason'],
			};
			const mockApiResponse: AppBskyFeedGetTimeline.Response = { success: true, data: { feed: [mockFeedItem] }, headers: {} };
			mockGetTimeline.mockResolvedValue(mockApiResponse);

			const result = await _getTimelineInternal(agent, { limit });
			expect(result).toHaveLength(1);
			const output = result[0];
			expect(output.uri).toBe(detailedPost.uri);
			expect(output.record.text).toBe('Detailed timeline post');
			expect(output.replyParent?.uri).toBe(parentPostSimple.uri);
			expect(output.repostedBy?.did).toBe(reasonRepost.by.did);
		});

		it('should throw an error if API call fails for getTimeline', async () => {
			mockGetTimeline.mockResolvedValue({ success: false, error: 'Server Error', message: 'Internal issue' });
			await expect(_getTimelineInternal(agent, { limit })).rejects.toThrow('Failed to fetch timeline: Server Error - Internal issue');
		});
	});
});
