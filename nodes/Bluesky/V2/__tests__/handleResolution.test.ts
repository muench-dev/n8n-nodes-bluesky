import { AtpAgent, CredentialSession } from '@atproto/api';
import { LoggerProxy as Logger } from 'n8n-workflow';
import { BlueskyV2 } from '../BlueskyV2.node';

jest.mock('@atproto/api');
jest.mock('n8n-workflow', () => {
	const actual = jest.requireActual('n8n-workflow');
	return {
		...actual,
		LoggerProxy: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
		},
	};
});

const MockedAtpAgent = AtpAgent as jest.MockedClass<typeof AtpAgent>;
const MockedCredentialSession = CredentialSession as jest.MockedClass<typeof CredentialSession>;

/**
 * Creates a mock IExecuteFunctions context for testing BlueskyV2.execute().
 * The execute method uses `this: IExecuteFunctions`, so we need a mock context
 * with all the methods it calls during setup/auth and the operation phase.
 */
function createMockExecutionContext(overrides: {
	identifier: string;
	appPassword?: string;
	serviceUrl?: string;
	operation?: string;
}) {
	const {
		identifier,
		appPassword = 'test-app-password',
		serviceUrl = 'https://bsky.social',
		operation = 'getProfile',
	} = overrides;

	return {
		getInputData: jest.fn().mockReturnValue([{ json: {} }]),
		getCredentials: jest.fn().mockResolvedValue({
			identifier,
			appPassword,
			serviceUrl,
		}),
		getNodeParameter: jest.fn().mockImplementation((param: string, _index: number, fallback?: unknown) => {
			if (param === 'operation') return operation;
			if (param === 'actor') return 'test.bsky.social';
			return fallback;
		}),
		getNode: jest.fn().mockReturnValue({
			name: 'Bluesky',
			type: 'n8n-nodes-bluesky.bluesky',
			id: 'test-node-id',
		}),
		continueOnFail: jest.fn().mockReturnValue(false),
	};
}

describe('Handle Resolution (Custom Domain Fix)', () => {
	let mockResolveHandle: jest.Mock;
	let mockLogin: jest.Mock;
	let mockGetProfile: jest.Mock;
	let blueskyNode: BlueskyV2;

	beforeEach(() => {
		jest.clearAllMocks();

		mockResolveHandle = jest.fn();
		mockLogin = jest.fn().mockResolvedValue(undefined);
		mockGetProfile = jest.fn().mockResolvedValue({
			success: true,
			data: {
				did: 'did:plc:resolved',
				handle: 'test.bsky.social',
				displayName: 'Test User',
			},
		});

		// Each AtpAgent constructor call returns a fresh mock with these methods.
		// The first instance is used for handle resolution (tempAgent),
		// the second for the actual authenticated session.
		MockedAtpAgent.mockImplementation(() => ({
			resolveHandle: mockResolveHandle,
			login: mockLogin,
			getProfile: mockGetProfile,
		} as any));

		MockedCredentialSession.mockImplementation(() => ({} as any));

		blueskyNode = new BlueskyV2({
			displayName: 'Bluesky',
			name: 'bluesky',
			icon: 'file:bluesky.svg',
			group: ['transform'],
			description: 'Test',
		});
	});

	it('should resolve a custom domain handle (pants-the-person.me) to a DID before login', async () => {
		mockResolveHandle.mockResolvedValue({
			success: true,
			data: { did: 'did:plc:abc123customdomain' },
		});

		const ctx = createMockExecutionContext({
			identifier: 'pants-the-person.me',
		});

		await (blueskyNode as any).execute.call(ctx);

		expect(mockResolveHandle).toHaveBeenCalledWith({ handle: 'pants-the-person.me' });
		expect(mockLogin).toHaveBeenCalledWith({
			identifier: 'did:plc:abc123customdomain',
			password: 'test-app-password',
		});
	});

	it('should skip resolution when identifier is already a DID', async () => {
		const ctx = createMockExecutionContext({
			identifier: 'did:plc:alreadyadid',
		});

		await (blueskyNode as any).execute.call(ctx);

		expect(mockResolveHandle).not.toHaveBeenCalled();
		expect(mockLogin).toHaveBeenCalledWith({
			identifier: 'did:plc:alreadyadid',
			password: 'test-app-password',
		});
	});

	it('should resolve standard .bsky.social handles too', async () => {
		mockResolveHandle.mockResolvedValue({
			success: true,
			data: { did: 'did:plc:standarduser' },
		});

		const ctx = createMockExecutionContext({
			identifier: 'alice.bsky.social',
		});

		await (blueskyNode as any).execute.call(ctx);

		expect(mockResolveHandle).toHaveBeenCalledWith({ handle: 'alice.bsky.social' });
		expect(mockLogin).toHaveBeenCalledWith({
			identifier: 'did:plc:standarduser',
			password: 'test-app-password',
		});
	});

	it('should fall back to original identifier when resolution throws an error', async () => {
		mockResolveHandle.mockRejectedValue(new Error('Network timeout'));

		const ctx = createMockExecutionContext({
			identifier: 'pants-the-person.me',
		});

		await (blueskyNode as any).execute.call(ctx);

		expect(mockResolveHandle).toHaveBeenCalledWith({ handle: 'pants-the-person.me' });
		// Falls back to the original handle for login
		expect(mockLogin).toHaveBeenCalledWith({
			identifier: 'pants-the-person.me',
			password: 'test-app-password',
		});
		expect(Logger.warn).toHaveBeenCalledWith(
			expect.stringContaining('Error resolving handle pants-the-person.me'),
			expect.any(Object),
		);
	});

	it('should fall back to original identifier when resolution returns unsuccessful', async () => {
		mockResolveHandle.mockResolvedValue({
			success: false,
			data: {},
		});

		const ctx = createMockExecutionContext({
			identifier: 'pants-the-person.me',
		});

		await (blueskyNode as any).execute.call(ctx);

		expect(mockResolveHandle).toHaveBeenCalledWith({ handle: 'pants-the-person.me' });
		expect(mockLogin).toHaveBeenCalledWith({
			identifier: 'pants-the-person.me',
			password: 'test-app-password',
		});
		expect(Logger.warn).toHaveBeenCalledWith(
			expect.stringContaining('Failed to resolve handle pants-the-person.me'),
			expect.any(Object),
		);
	});

	it('should fall back when resolution succeeds but DID is missing', async () => {
		mockResolveHandle.mockResolvedValue({
			success: true,
			data: { did: undefined },
		});

		const ctx = createMockExecutionContext({
			identifier: 'pants-the-person.me',
		});

		await (blueskyNode as any).execute.call(ctx);

		expect(mockLogin).toHaveBeenCalledWith({
			identifier: 'pants-the-person.me',
			password: 'test-app-password',
		});
	});

	it('should use the configured service URL for handle resolution', async () => {
		mockResolveHandle.mockResolvedValue({
			success: true,
			data: { did: 'did:plc:customdomain' },
		});

		const ctx = createMockExecutionContext({
			identifier: 'pants-the-person.me',
			serviceUrl: 'https://custom-pds.example.com/',
		});

		await (blueskyNode as any).execute.call(ctx);

		// CredentialSession is called with a URL object derived from the service URL.
		// First call is for the temp resolution agent, second for the real agent.
		expect(MockedCredentialSession).toHaveBeenCalledTimes(2);
		const firstCallArg = MockedCredentialSession.mock.calls[0][0];
		expect((firstCallArg as URL).origin).toBe('https://custom-pds.example.com');
	});
});
