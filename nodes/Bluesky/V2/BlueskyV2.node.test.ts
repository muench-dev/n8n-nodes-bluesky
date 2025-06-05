import { AtpAgent } from '@atproto/api';
import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { BlueskyV2 } from './BlueskyV2.node';

// Mock AtpAgent methods
jest.mock('@atproto/api', () => {
	const actualApi = jest.requireActual('@atproto/api');
	return {
		...actualApi,
		AtpAgent: jest.fn().mockImplementation(() => ({
			login: jest.fn().mockResolvedValue(undefined),
			post: jest.fn(), // Will be further mocked in tests
			// Add other methods as needed by operations
			deletePost: jest.fn(),
			like: jest.fn(),
			deleteLike: jest.fn(),
			repost: jest.fn(),
			deleteRepost: jest.fn(),
			getProfile: jest.fn(),
			mute: jest.fn(),
			unmute: jest.fn(),
			block: jest.fn(),
			unblock: jest.fn(),
			getAuthorFeed: jest.fn(),
			getTimeline: jest.fn(),
		})),
		CredentialSession: jest.fn().mockImplementation(() => ({})),
	};
});


describe('BlueskyV2 Node', () => {
	let executeFunctions: IExecuteFunctions;
	let blueskyNodeInstance: BlueskyV2;

	beforeEach(() => {
		// Reset mocks for each test
		jest.clearAllMocks();

		// Mock IExecuteFunctions
		executeFunctions = {
			getInputData: jest.fn().mockReturnValue([]),
			getCredentials: jest.fn().mockResolvedValue({
				identifier: 'testUser',
				appPassword: 'testPassword',
				serviceUrl: 'https://bsky.social',
			}),
			getNodeParameter: jest.fn(),
			getURL: jest.fn(),
			helpers: {
				executionApi: {
					addExecutionError: jest.fn(),
				},
				getBinaryDataBuffer: jest.fn(),
			},
			getNode: jest.fn().mockReturnValue({
				// Mock a minimal node structure
				name: 'Bluesky Test Node',
				type: 'BlueskyV2',
				typeVersion: 2,
				position: [0,0],
				id: 'test-node-id'
			}),
			continueOnFail: jest.fn().mockReturnValue(false), // Default to false
		} as unknown as IExecuteFunctions;

		// Instantiate the node. Adjust constructor params if baseDescription is more complex.
		blueskyNodeInstance = new BlueskyV2({
			displayName: 'Bluesky Test',
			name: 'BlueskyV2',
			group: ['social media'],
			version: 1, // Example version
			description: 'Test Bluesky Node',
			defaults: { name: 'Bluesky' },
			inputs: ['main'],
			outputs: ['main'],
			credentials: [{ name: 'blueskyApi', required: true }],
			properties: [], // Simplified for testing core logic
		});

		// Mock AtpAgent instance for direct access if needed by operations
		// (though operations are mostly self-contained after agent init)
		// mockedAgentInstance = new AtpAgent();
	});

	describe('execute method error handling', () => {
		it('should re-throw error if operation fails and continueOnFail is false', async () => {
			const mockError = new Error('Operation failed');
			const inputItem: INodeExecutionData = { json: { text: 'Test post' } };

			(executeFunctions.getInputData as jest.Mock).mockReturnValue([inputItem]);
			(executeFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string, itemIndex: number) => {
					if (paramName === 'operation') return 'post';
					if (paramName === 'postText') return 'Test post text';
					if (paramName === 'langs') return ['en'];
					return undefined;
			});
			(executeFunctions.continueOnFail as jest.Mock).mockReturnValue(false);

			// Mock the 'post' operation within AtpAgent to throw an error
			const mockedAgentPost = AtpAgent.prototype.post as jest.Mock;
			mockedAgentPost.mockRejectedValue(mockError);


			await expect(blueskyNodeInstance.execute.call(executeFunctions)).rejects.toThrow(mockError.message);

			expect(executeFunctions.helpers.executionApi.addExecutionError).toHaveBeenCalledTimes(1);
			expect(executeFunctions.helpers.executionApi.addExecutionError).toHaveBeenCalledWith(
				expect.any(NodeOperationError), // Or expect.any(Error) if that's what's thrown by the node before wrapping
			);
			// More detailed check for NodeOperationError
			const errorCall = (executeFunctions.helpers.executionApi.addExecutionError as jest.Mock).mock.calls[0][0];
			expect(errorCall).toBeInstanceOf(NodeOperationError);
			expect(errorCall.message).toContain("Failed to process item 0 for operation 'post': Operation failed");
			expect(errorCall.node).toEqual(executeFunctions.getNode());
			expect(errorCall.itemDetails).toEqual(inputItem.json);
		});

		it('should not re-throw error if operation fails and continueOnFail is true, returning empty for the item', async () => {
			const mockError = new Error('Operation failed again');
			const inputItem: INodeExecutionData = { json: { text: 'Another test post' } };

			(executeFunctions.getInputData as jest.Mock).mockReturnValue([inputItem]);
			(executeFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string, itemIndex: number) => {
					if (paramName === 'operation') return 'post';
					if (paramName === 'postText') return 'Test post text for continueOnFail';
					if (paramName === 'langs') return ['en'];
					return undefined;
				});
			(executeFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			// Mock the 'post' operation to throw an error
			const mockedAgentPost = AtpAgent.prototype.post as jest.Mock;
			mockedAgentPost.mockRejectedValue(mockError);

			const result = await blueskyNodeInstance.execute.call(executeFunctions);

			expect(result).toEqual([[]]); // Expecting an empty array for the failed item's execution path.
			                               // If the node returns INodeExecutionData[][], and one item fails, it should be [[]]
			                               // If it's structured per item, it might be different, e.g. [{json: {}, error: ...}]
			                               // Based on current BlueskyV2.node.ts, it returns [returnData] where returnData is flat.
			                               // If an item fails and continueOnFail is true, it's skipped from returnData.
			                               // So if 1 item is input and it fails, returnData is [], so result is [[]].

			expect(executeFunctions.helpers.executionApi.addExecutionError).toHaveBeenCalledTimes(1);
			const errorCall = (executeFunctions.helpers.executionApi.addExecutionError as jest.Mock).mock.calls[0][0];
			expect(errorCall).toBeInstanceOf(NodeOperationError);
			expect(errorCall.message).toContain("Failed to process item 0 for operation 'post': Operation failed again");
			expect(errorCall.node).toEqual(executeFunctions.getNode());
			expect(errorCall.itemDetails).toEqual(inputItem.json);

			// Ensure error is not re-thrown (implicitly tested by not using .rejects and .toThrow)
		});

		it('should handle multiple items with one error correctly when continueOnFail is true', async () => {
			const mockError = new Error('Specific item operation failed');
			const inputItems: INodeExecutionData[] = [
				{ json: { id: 'item1-success', text: 'Successful post' } },
				{ json: { id: 'item2-failure', text: 'Failed post attempt' } },
				{ json: { id: 'item3-success', text: 'Another successful post' } },
			];
			const successfulPostResult1 = { uri: 'at://did:plc:123/app.bsky.feed.post/success1', cid: 'bafysuccess1' };
			const successfulPostResult3 = { uri: 'at://did:plc:123/app.bsky.feed.post/success3', cid: 'bafysuccess3' };

			(executeFunctions.getInputData as jest.Mock).mockReturnValue(inputItems);
			(executeFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((paramName: string, itemIndex: number) => {
					if (paramName === 'operation') return 'post';
					if (paramName === 'postText') return inputItems[itemIndex].json.text;
					if (paramName === 'langs') return ['en'];
					return undefined;
				});
			(executeFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			// Mock AtpAgent's post method
			const mockedAgentPost = AtpAgent.prototype.post as jest.Mock;
			mockedAgentPost
				.mockResolvedValueOnce(successfulPostResult1) // For item 0 (item1-success)
				.mockRejectedValueOnce(mockError)             // For item 1 (item2-failure)
				.mockResolvedValueOnce(successfulPostResult3); // For item 2 (item3-success)

			const result = await blueskyNodeInstance.execute.call(executeFunctions);

			// Assertions
			expect(executeFunctions.helpers.executionApi.addExecutionError).toHaveBeenCalledTimes(1);
			const errorCall = (executeFunctions.helpers.executionApi.addExecutionError as jest.Mock).mock.calls[0][0];
			expect(errorCall).toBeInstanceOf(NodeOperationError);
			// Note: The item index in the error message is the original index from the inputItems array.
			expect(errorCall.message).toContain("Failed to process item 1 for operation 'post': Specific item operation failed");
			expect(errorCall.itemDetails).toEqual(inputItems[1].json); // Error associated with the second item

			// Check returned data: should contain results for successful items only
			// The structure of returnData is INodeExecutionData[] which is then wrapped in an array by execute method: [returnData]
			expect(result).toEqual([
				[
					{ json: successfulPostResult1 }, // Result for item 0
					{ json: successfulPostResult3 }, // Result for item 2
				],
			]);

			// Ensure post was called for all items
			expect(mockedAgentPost).toHaveBeenCalledTimes(3);
			expect(mockedAgentPost).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: inputItems[0].json.text }));
			expect(mockedAgentPost).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: inputItems[1].json.text }));
			expect(mockedAgentPost).toHaveBeenNthCalledWith(3, expect.objectContaining({ text: inputItems[2].json.text }));
		});
	});
});

// Helper to properly type AtpAgent mock for direct method mocking if needed elsewhere
// const mockedAgentInstance = new AtpAgent() as jest.Mocked<AtpAgent>;
// For example: mockedAgentInstance.post.mockResolvedValue({ uri: 'at://did:plc:123/app.bsky.feed.post/abc', cid: 'bafy...' });
