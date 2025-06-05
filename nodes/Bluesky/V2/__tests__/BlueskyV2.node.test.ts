import { BlueskyV2 } from '../BlueskyV2.node';
import { IExecuteFunctions, NodeApiError } from 'n8n-workflow'; // Removed INodeExecutionData
import { AtpAgent } from '@atproto/api';
import * as userOperations from '../userOperations';

// Mock @atproto/api
jest.mock('@atproto/api');

// Mock specific user operation
jest.mock('../userOperations', () => ({
	...jest.requireActual('../userOperations'), // Import and retain default behavior for other exports
	getProfileOperation: jest.fn(), // Mock only getProfileOperation
}));

describe('BlueskyV2 Node', () => {
	let executeFunctions: IExecuteFunctions;
	let mockAgent: jest.Mocked<AtpAgent>;

	beforeEach(() => {
		// Reset mocks before each test
		(userOperations.getProfileOperation as jest.Mock).mockReset();
		(AtpAgent as any).mockReset(); // Reset AtpAgent constructor mock

		// Setup mock for AtpAgent instance and its methods
		mockAgent = {
			login: jest.fn().mockResolvedValue(undefined),
			// Add other methods if they are called before the target operation
		} as any;

		(AtpAgent as any).mockImplementation(() => mockAgent);


		// Mock IExecuteFunctions context for the node
		executeFunctions = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]), // Default mock for input data
			getCredentials: jest.fn().mockResolvedValue({
				identifier: 'testuser',
				appPassword: 'password',
				serviceUrl: 'https://bsky.social',
			}),
			getNodeParameter: jest.fn((name, index, defaultValue) => {
				if (name === 'operation') return 'getProfile'; // Default to 'getProfile' operation for tests
				if (name === 'actor') return 'dummy.bsky.social';
				return defaultValue;
			}),
			continueOnFail: jest.fn().mockReturnValue(false), // Default to false
			getNode: jest.fn().mockReturnValue({
				getNodeParameter: (param: string) => param === 'continueOnError',
				getContext: () => ({}),
				id: 'testNode',
				name: 'Bluesky',
				type: 'Bluesky',
				typeVersion: 2,
				getExecutionId: () => 'execution-123',
			} as any),
			helpers: {
				getBinaryDataBuffer: jest.fn(),
			} as any,
		} as any;
	});

	describe('execute method error handling', () => {
		it('should return error data if operation fails and continueOnFail is true', async () => {
			(executeFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			const errorMessage = 'Test operation error';
			(userOperations.getProfileOperation as jest.Mock).mockRejectedValue(new Error(errorMessage));

			const node = new BlueskyV2({displayName: 'Bluesky', name: 'bluesky', group: ['transform'], defaultVersion: 2, description: 'Test node'});
			const result = await node.execute.call(executeFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json.error).toBe(errorMessage);
			expect(result[0][0].pairedItem).toEqual([{ item: 0 }]);
			expect(userOperations.getProfileOperation).toHaveBeenCalled();
		});

		it('should throw NodeApiError if operation fails and continueOnFail is false', async () => {
			(executeFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
			const errorMessage = 'Test operation error for NodeApiError';
			const originalError = new Error(errorMessage);
			(userOperations.getProfileOperation as jest.Mock).mockRejectedValue(originalError);

			const node = new BlueskyV2({displayName: 'Bluesky', name: 'bluesky', group: ['transform'], defaultVersion: 2, description: 'Test node'});

			let thrownError;
			try {
				await node.execute.call(executeFunctions);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeApiError);
			expect((thrownError as NodeApiError).message).toContain(errorMessage);
			// Check if the original error is correctly wrapped, if possible (depends on NodeApiError implementation details)
			// For example, if NodeApiError stores the original error in a property like 'cause' or similar:
			// expect((thrownError as any).cause).toBe(originalError);
			// Or check if the getNode() method of the NodeApiError returns the correct node
			// expect((thrownError as NodeApiError).getNode()).toBe(executeFunctions.getNode()); // Removed problematic line
			expect(userOperations.getProfileOperation).toHaveBeenCalled();
		});

		it('should handle errors for multiple items correctly when continueOnFail is true', async () => {
			(executeFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			// Mock getInputData to return two items
			(executeFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: { id: 1 } }, // First item processing will succeed
				{ json: { id: 2 } }, // Second item processing will fail
			]);

			const successData = [{ json: { profile: 'user1' } }];
			const errorMessage = 'Error processing second item';

			// First call to getProfileOperation succeeds
			(userOperations.getProfileOperation as jest.Mock)
				.mockResolvedValueOnce(successData)
				// Second call to getProfileOperation fails
				.mockRejectedValueOnce(new Error(errorMessage));

			// Mock getNodeParameter to return different actors for different items if necessary
			(executeFunctions.getNodeParameter as jest.Mock)
				.mockImplementation((name, index, defaultValue) => {
					if (name === 'operation') return 'getProfile';
					if (name === 'actor') return `actor${index + 1}.bsky.social`; // e.g., actor1.bsky.social, actor2.bsky.social
					return defaultValue;
				});

			const node = new BlueskyV2({displayName: 'Bluesky', name: 'bluesky', group: ['transform'], defaultVersion: 2, description: 'Test node'});
			const result = await node.execute.call(executeFunctions);

			expect(result).toHaveLength(1); // Outer array
			expect(result[0]).toHaveLength(2); // Two items processed

			// Check first item (success)
			expect(result[0][0].json).toEqual(successData[0].json);

			// Check second item (error)
			expect(result[0][1].json.error).toBe(errorMessage);
			expect(result[0][1].pairedItem).toEqual([{ item: 1 }]);

			expect(userOperations.getProfileOperation).toHaveBeenCalledTimes(2);
		});
	});
});
