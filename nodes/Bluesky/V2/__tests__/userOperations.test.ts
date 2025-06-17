import {
  muteOperation,
  unmuteOperation,
  getProfileOperation,
  blockOperation,
  unblockOperation
} from '../userOperations';
import {
  AtpAgent,
  AtUri
} from '@atproto/api';

// Mock the @atproto/api module
jest.mock('@atproto/api');

describe('userOperations', () => {
  let mockAgent: jest.Mocked<AtpAgent>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock AtpAgent and its methods
    mockAgent = {
      mute: jest.fn().mockResolvedValue({}),
      unmute: jest.fn().mockResolvedValue({}),
      getProfile: jest.fn().mockResolvedValue({
        data: {
          did: 'did:plc:testuser',
          handle: 'test.bsky.social',
          displayName: 'Test User',
        }
      }),
      app: {
        bsky: {
          graph: {
            block: {
              create: jest.fn().mockResolvedValue({ uri: 'test-block-uri' }),
              delete: jest.fn().mockResolvedValue({})
            }
          }
        }
      },
      session: {
        did: 'did:plc:loggedinuser'
      }
    } as any;
  });

  describe('muteOperation', () => {
    it('should call agent.mute with the correct DID', async () => {
      const did = 'did:plc:testuser';
      const result = await muteOperation(mockAgent, did);

      expect(mockAgent.mute).toHaveBeenCalledWith(did);
      expect(result).toHaveLength(1);
      expect(result[0].json).toEqual({ did, success: true });
    });

    it('should return the mute response in the result', async () => {
      const mockResponse = { success: true };
      (mockAgent.mute as jest.Mock).mockResolvedValue(mockResponse);

      const did = 'did:plc:testuser';
      const result = await muteOperation(mockAgent, did);

      expect(result[0].json).toEqual({ did, success: true });
    });
  });

  describe('unmuteOperation', () => {
    it('should call agent.unmute with the correct DID', async () => {
      const did = 'did:plc:testuser';
      const result = await unmuteOperation(mockAgent, did);

      expect(mockAgent.unmute).toHaveBeenCalledWith(did);
      expect(result).toHaveLength(1);
      expect(result[0].json).toEqual({ did, success: true });
    });

    it('should return the unmute response in the result', async () => {
      const mockResponse = { success: true };
      (mockAgent.unmute as jest.Mock).mockResolvedValue(mockResponse);

      const did = 'did:plc:testuser';
      const result = await unmuteOperation(mockAgent, did);

      expect(result[0].json).toEqual({ did, success: true });
    });
  });

  describe('getProfileOperation', () => {
    it('should call agent.getProfile with the correct actor', async () => {
      const actor = 'test.bsky.social';
      const result = await getProfileOperation(mockAgent, actor);

      expect(mockAgent.getProfile).toHaveBeenCalledWith({ actor });
      expect(result).toHaveLength(1);
      expect(result[0].json).toEqual({
        did: 'did:plc:testuser',
        handle: 'test.bsky.social',
        displayName: 'Test User',
      });
    });

    it('should return the profile data in the result', async () => {
      const mockProfileData = {
        did: 'did:plc:testuser',
        handle: 'test.bsky.social',
        displayName: 'Custom Name',
        description: 'Test description'
      };

      (mockAgent.getProfile as jest.Mock).mockResolvedValue({
        data: mockProfileData
      });

      const actor = 'test.bsky.social';
      const result = await getProfileOperation(mockAgent, actor);

      expect(result[0].json).toEqual(mockProfileData);
    });
  });

  describe('blockOperation', () => {
    it('should call agent.app.bsky.graph.block.create with the correct parameters', async () => {
      const did = 'did:plc:testuser';
      const result = await blockOperation(mockAgent, did);

      expect(mockAgent.app.bsky.graph.block.create).toHaveBeenCalledWith(
        { repo: 'did:plc:loggedinuser' },
        {
          subject: did,
          createdAt: expect.any(String)
        }
      );
      expect(result).toHaveLength(1);
      expect(result[0].json).toEqual({ uri: 'test-block-uri' });
    });
  });

  describe('unblockOperation', () => {
    it('should call agent.app.bsky.graph.block.delete with the correct parameters', async () => {
      // Mock AtUri constructor
      ((AtUri as unknown) as jest.Mock).mockImplementation((uri) => {
        return {
          uri,
          rkey: 'test-rkey'
        };
      });

      const uri = 'at://did:plc:loggedinuser/app.bsky.graph.block/test-rkey';
      const result = await unblockOperation(mockAgent, uri);

      expect(mockAgent.app.bsky.graph.block.delete).toHaveBeenCalledWith({
        repo: 'did:plc:loggedinuser',
        rkey: 'test-rkey'
      });
      expect(result).toHaveLength(1);
      expect(result[0].json).toEqual({ uri });
    });
  });
});
