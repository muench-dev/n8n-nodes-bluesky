import {
	addUserToListOperation,
	createListOperation,
	deleteListOperation,
	getListFeedOperation,
	getListsOperation,
	removeUserFromListOperation,
	updateListOperation,
} from '../listOperations';
import { AtpAgent, AtUri } from '@atproto/api';

jest.mock('@atproto/api', () => ({
	...jest.requireActual('@atproto/api'),
	AtUri: jest.fn(),
}));

describe('listOperations', () => {
	beforeEach(() => {
		(AtUri as unknown as jest.Mock).mockImplementation((uri: string) => ({ uri, rkey: 'rkey-1' }));
	});

	it('createListOperation should create a list record', async () => {
		const createRecord = jest
			.fn()
			.mockResolvedValue({ data: { uri: 'at://list/1', cid: 'cid-1' } });
		const agent = {
			session: { did: 'did:plc:self' },
			com: { atproto: { repo: { createRecord } } },
		} as unknown as AtpAgent;

		const result = await createListOperation(
			agent,
			'My List',
			'app.bsky.graph.defs#curatelist',
			'desc',
		);

		expect(createRecord).toHaveBeenCalled();
		expect(result[0].json).toEqual(
			expect.objectContaining({ uri: 'at://list/1', cid: 'cid-1', name: 'My List' }),
		);
	});

	it('updateListOperation should update existing list', async () => {
		const getRecord = jest
			.fn()
			.mockResolvedValue({ data: { value: { createdAt: '2025-01-01T00:00:00.000Z' } } });
		const putRecord = jest.fn().mockResolvedValue({ data: { cid: 'cid-2' } });
		const agent = {
			session: { did: 'did:plc:self' },
			com: { atproto: { repo: { getRecord, putRecord } } },
		} as unknown as AtpAgent;

		const result = await updateListOperation(
			agent,
			'at://list/1',
			'Updated',
			'app.bsky.graph.defs#curatelist',
			'desc',
		);

		expect(putRecord).toHaveBeenCalled();
		expect(result[0].json).toEqual(
			expect.objectContaining({ uri: 'at://list/1', cid: 'cid-2', name: 'Updated' }),
		);
	});

	it('deleteListOperation should delete list record', async () => {
		const deleteRecord = jest.fn().mockResolvedValue({});
		const agent = {
			session: { did: 'did:plc:self' },
			com: { atproto: { repo: { deleteRecord } } },
		} as unknown as AtpAgent;

		const result = await deleteListOperation(agent, 'at://list/1');

		expect(deleteRecord).toHaveBeenCalled();
		expect(result[0].json).toEqual({ uri: 'at://list/1', deleted: true });
	});

	it('getListsOperation should return list entries', async () => {
		const agent = {
			app: {
				bsky: {
					graph: {
						getLists: jest.fn().mockResolvedValue({ data: { lists: [{ uri: 'at://list/1' }] } }),
					},
				},
			},
		} as unknown as AtpAgent;

		const result = await getListsOperation(agent, 'user.bsky.social', 10);
		expect(result[0].json).toEqual({ uri: 'at://list/1' });
	});

	it('getListFeedOperation should return feed entries', async () => {
		const agent = {
			app: {
				bsky: {
					feed: {
						getListFeed: jest
							.fn()
							.mockResolvedValue({ data: { feed: [{ post: { uri: 'at://post/1' } }] } }),
					},
				},
			},
		} as unknown as AtpAgent;

		const result = await getListFeedOperation(agent, 'at://list/1', 10);
		expect(result[0].json).toEqual({ post: { uri: 'at://post/1' } });
	});

	it('addUserToListOperation should create listitem record', async () => {
		const createRecord = jest
			.fn()
			.mockResolvedValue({ data: { uri: 'at://listitem/1', cid: 'cid-3' } });
		const agent = {
			session: { did: 'did:plc:self' },
			com: { atproto: { repo: { createRecord } } },
		} as unknown as AtpAgent;

		const result = await addUserToListOperation(agent, 'at://list/1', 'did:plc:user');
		expect(result[0].json).toEqual(
			expect.objectContaining({ uri: 'at://listitem/1', cid: 'cid-3', subject: 'did:plc:user' }),
		);
	});

	it('removeUserFromListOperation should delete listitem record', async () => {
		const deleteRecord = jest.fn().mockResolvedValue({});
		const agent = {
			session: { did: 'did:plc:self' },
			com: { atproto: { repo: { deleteRecord } } },
		} as unknown as AtpAgent;

		const result = await removeUserFromListOperation(agent, 'at://listitem/1');
		expect(result[0].json).toEqual({ uri: 'at://listitem/1', deleted: true });
	});
});
