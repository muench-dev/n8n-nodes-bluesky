import { AtpAgent, AppBskyActorDefs, AppBskyGraphDefs, ComAtprotoRepoStrongRef } from '@atproto/api';
import { muteOperation, unmuteOperation, getProfileOperation, blockOperation, unblockOperation } from '../userOperations';

// Mock the entire @atproto/api module
jest.mock('@atproto/api');

// Mock the entire @atproto/api module
// jest.mock('@atproto/api'); // Already mocked at the top

const mockMute = jest.fn();
const mockUnmute = jest.fn();
const mockGetProfile = jest.fn();
const mockBlockCreate = jest.fn();
const mockBlockDelete = jest.fn();

const MockedAtpAgent = AtpAgent as jest.MockedClass<typeof AtpAgent>;

MockedAtpAgent.mockImplementation(() => {
	return {
		mute: mockMute,
		unmute: mockUnmute,
		getProfile: mockGetProfile,
		api: {
			app: {
				bsky: {
					graph: {
						block: {
							create: mockBlockCreate,
							delete: mockBlockDelete,
						},
					},
				},
			},
		},
	} as any;
});


describe('UserOperations', () => {
	let agent: jest.Mocked<AtpAgent>;

	beforeEach(() => {
		agent = new MockedAtpAgent({ service: 'https://bsky.social' }) as jest.Mocked<AtpAgent>;
		// Ensure agent methods are correctly typed and mocked
		(agent.mute as jest.Mock).mockImplementation(mockMute);
		(agent.unmute as jest.Mock).mockImplementation(mockUnmute);
		(agent.getProfile as jest.Mock).mockImplementation(mockGetProfile);
		(agent.api.app.bsky.graph.block.create as jest.Mock).mockImplementation(mockBlockCreate);
		(agent.api.app.bsky.graph.block.delete as jest.Mock).mockImplementation(mockBlockDelete);


		mockMute.mockClear();
		mockUnmute.mockClear();
		mockGetProfile.mockClear();
		mockBlockCreate.mockClear();
		mockBlockDelete.mockClear();

		MockedAtpAgent.mockClear();
		MockedAtpAgent.mockImplementation(() => {
			return {
				mute: mockMute,
				unmute: mockUnmute,
				getProfile: mockGetProfile,
				api: {
					app: {
						bsky: {
							graph: {
								block: {
									create: mockBlockCreate,
									delete: mockBlockDelete,
								},
							},
						},
					},
				},
			} as any;
		});
	});

	// Sample data and helper functions will be added in subsequent steps
	// For now, we'll keep the describe block minimal

	describe('muteOperation', () => {
		const actorDid = 'did:plc:testuser';

		it('should call agent.mute with correct parameters and return data on success', async () => {
			// Mock the successful response from agent.mute
			// According to @atproto/api docs, mute resolves with `undefined` on success (empty body)
			// and the actual response is { success: true, headers: {...} }
			const mockSuccessResponse = { success: true, headers: {} };
			mockMute.mockResolvedValue(mockSuccessResponse);

			const result = await muteOperation(agent, { actor: actorDid });

			// Check if agent.mute was called correctly
			expect(mockMute).toHaveBeenCalledTimes(1);
			expect(mockMute).toHaveBeenCalledWith({ actor: actorDid });

			// Check if the returned data is as expected (empty for mute)
			// The operation itself returns a boolean indicating success.
			expect(result).toEqual(true);
		});

		it('should throw an error if agent.mute fails', async () => {
			// Mock the failed response from agent.mute
			const errorMessage = 'Failed to mute user';
			const mockErrorResponse = { success: false, error: 'NetworkError', message: errorMessage };
			mockMute.mockResolvedValue(mockErrorResponse); // Simulating a resolved promise with a failure object, as per Bluesky's API client style

			// Call muteOperation and expect it to throw an error
			await expect(muteOperation(agent, { actor: actorDid }))
				.rejects
				.toThrow(`Failed to mute user ${actorDid}: NetworkError - ${errorMessage}`);

			// Check if agent.mute was called correctly
			expect(mockMute).toHaveBeenCalledTimes(1);
			expect(mockMute).toHaveBeenCalledWith({ actor: actorDid });
		});
	});

	describe('unmuteOperation', () => {
		const actorDid = 'did:plc:testuser';

		it('should call agent.unmute with correct parameters and return data on success', async () => {
			// Mock the successful response from agent.unmute
			// Similar to mute, unmute resolves with `undefined` on success (empty body)
			const mockSuccessResponse = { success: true, headers: {} };
			mockUnmute.mockResolvedValue(mockSuccessResponse);

			const result = await unmuteOperation(agent, { actor: actorDid });

			// Check if agent.unmute was called correctly
			expect(mockUnmute).toHaveBeenCalledTimes(1);
			expect(mockUnmute).toHaveBeenCalledWith({ actor: actorDid });

			// Check if the returned data is as expected (boolean true for success)
			expect(result).toEqual(true);
		});

		it('should throw an error if agent.unmute fails', async () => {
			// Mock the failed response from agent.unmute
			const errorMessage = 'Failed to unmute user';
			const mockErrorResponse = { success: false, error: 'UpstreamFailure', message: errorMessage };
			mockUnmute.mockResolvedValue(mockErrorResponse);

			// Call unmuteOperation and expect it to throw an error
			await expect(unmuteOperation(agent, { actor: actorDid }))
				.rejects
				.toThrow(`Failed to unmute user ${actorDid}: UpstreamFailure - ${errorMessage}`);

			// Check if agent.unmute was called correctly
			expect(mockUnmute).toHaveBeenCalledTimes(1);
			expect(mockUnmute).toHaveBeenCalledWith({ actor: actorDid });
		});
	});

	describe('getProfileOperation', () => {
		const actorDid = 'did:plc:testuser';
		const sampleProfileData: AppBskyActorDefs.ProfileViewDetailed = {
			$type: 'app.bsky.actor.defs#profileViewDetailed',
			did: actorDid,
			handle: 'testuser.bsky.social',
			displayName: 'Test User',
			description: 'This is a test user profile.',
			avatar: 'https://example.com/avatar.jpg',
			banner: 'https://example.com/banner.jpg',
			followersCount: 100,
			followsCount: 50,
			postsCount: 10,
			indexedAt: new Date().toISOString(),
			viewer: {
				muted: false,
				blockedBy: false,
			},
			labels: [],
		};

		it('should call agent.getProfile with correct parameters and return profile data on success', async () => {
			const mockSuccessResponse = { success: true, data: sampleProfileData, headers: {} };
			mockGetProfile.mockResolvedValue(mockSuccessResponse);

			const result = await getProfileOperation(agent, { actor: actorDid });

			expect(mockGetProfile).toHaveBeenCalledTimes(1);
			expect(mockGetProfile).toHaveBeenCalledWith({ actor: actorDid });
			expect(result).toEqual(sampleProfileData);
		});

		it('should throw an error if agent.getProfile fails', async () => {
			const errorMessage = 'Profile not found';
			const mockErrorResponse = { success: false, error: 'NotFound', message: errorMessage };
			mockGetProfile.mockResolvedValue(mockErrorResponse);

			await expect(getProfileOperation(agent, { actor: actorDid }))
				.rejects
				.toThrow(`Failed to get profile for ${actorDid}: NotFound - ${errorMessage}`);

			expect(mockGetProfile).toHaveBeenCalledTimes(1);
			expect(mockGetProfile).toHaveBeenCalledWith({ actor: actorDid });
		});
	});

	describe('blockOperation', () => {
		const subjectDid = 'did:plc:targetuser';
		const mockRepo = 'did:plc:selfuser'; // Assuming 'did:plc:selfuser' is the authenticated user's DID
		const expectedBlockUri = `at://${mockRepo}/app.bsky.graph.block/self`;

		beforeEach(() => {
			// Mock agent.session.did, which is used by blockOperation to get the repo
			// Ensure agent is already a MockedAtpAgent instance from the outer beforeEach
			(agent as any).session = { did: mockRepo };
		});

		it('should call agent.api.app.bsky.graph.block.create with correct parameters and return URI on success', async () => {
			const mockSuccessResponse = {
				success: true,
				data: { uri: expectedBlockUri, cid: 'sampleCid' }, // Actual API returns uri and cid
				headers: {},
			};
			mockBlockCreate.mockResolvedValue(mockSuccessResponse);

			const result = await blockOperation(agent, { subject: subjectDid });

			expect(mockBlockCreate).toHaveBeenCalledTimes(1);
			expect(mockBlockCreate).toHaveBeenCalledWith(
				{ repo: mockRepo }, // First argument to create is { repo, rkey?, validate?, record, swapCommit? }
				{ subject: subjectDid, createdAt: expect.any(String), $type: 'app.bsky.graph.block' }, // Second argument is the record itself
			);
			expect(result).toEqual({ uri: expectedBlockUri });
		});

		it('should throw an error if agent.api.app.bsky.graph.block.create fails', async () => {
			const errorMessage = 'Failed to create block';
			const mockErrorResponse = { success: false, error: 'Forbidden', message: errorMessage };
			mockBlockCreate.mockResolvedValue(mockErrorResponse);

			await expect(blockOperation(agent, { subject: subjectDid }))
				.rejects
				.toThrow(`Failed to block user ${subjectDid}: Forbidden - ${errorMessage}`);

			expect(mockBlockCreate).toHaveBeenCalledTimes(1);
			expect(mockBlockCreate).toHaveBeenCalledWith(
				{ repo: mockRepo },
				{ subject: subjectDid, createdAt: expect.any(String), $type: 'app.bsky.graph.block' },
			);
		});
	});

	describe('unblockOperation', () => {
		const mockRepo = 'did:plc:selfuser';
		const recordRkey = 'self'; // rkey for a block record is often 'self' or a timestamp-based ID.
		const blockUriToDelete = `at://${mockRepo}/app.bsky.graph.block/${recordRkey}`;

		beforeEach(() => {
			// Mock agent.session.did, which is used by unblockOperation to parse the repo from the URI
			(agent as any).session = { did: mockRepo };
		});

		it('should call agent.api.app.bsky.graph.block.delete with correct parameters and return original URI on success', async () => {
			// The delete operation typically returns a 200 OK with no body if successful.
			// The AtpAgent wrapper might return { success: true, headers: {} }
			const mockSuccessResponse = { success: true, headers: {} };
			mockBlockDelete.mockResolvedValue(mockSuccessResponse);

			const result = await unblockOperation(agent, { uri: blockUriToDelete });

			expect(mockBlockDelete).toHaveBeenCalledTimes(1);
			// The first argument for delete is { repo, collection, rkey, swapRecord?, swapCommit? }
			// For app.bsky.graph.block.delete, the collection is implicitly app.bsky.graph.block
			expect(mockBlockDelete).toHaveBeenCalledWith({
				repo: mockRepo,
				collection: 'app.bsky.graph.block', // This is inferred by the SDK/API structure
				rkey: recordRkey,
			});
			// The operation should return an object indicating success and the URI that was unblocked
			expect(result).toEqual({ success: true, uri: blockUriToDelete });
		});

		it('should throw an error if agent.api.app.bsky.graph.block.delete fails', async () => {
			const errorMessage = 'Failed to delete block';
			const mockErrorResponse = { success: false, error: 'NotFound', message: errorMessage };
			mockBlockDelete.mockResolvedValue(mockErrorResponse);

			await expect(unblockOperation(agent, { uri: blockUriToDelete }))
				.rejects
				.toThrow(`Failed to unblock user via record ${blockUriToDelete}: NotFound - ${errorMessage}`);

			expect(mockBlockDelete).toHaveBeenCalledTimes(1);
			expect(mockBlockDelete).toHaveBeenCalledWith({
				repo: mockRepo,
				collection: 'app.bsky.graph.block',
				rkey: recordRkey,
			});
		});
	});
});
