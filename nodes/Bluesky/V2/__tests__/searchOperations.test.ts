import { searchPostsOperation, searchUsersOperation } from '../searchOperations';
import { AtpAgent } from '@atproto/api';

describe('searchOperations', () => {
	it('searchUsersOperation should return actor results', async () => {
		const agent = {
			app: {
				bsky: {
					actor: {
						searchActors: jest.fn().mockResolvedValue({
							data: { actors: [{ handle: 'one.bsky.social' }, { handle: 'two.bsky.social' }] },
						}),
					},
				},
			},
		} as unknown as AtpAgent;

		const result = await searchUsersOperation(agent, 'one', 2);

		expect(result).toHaveLength(2);
		expect(result[0].json).toEqual({ handle: 'one.bsky.social' });
	});

	it('searchPostsOperation should pass author filter', async () => {
		const searchPosts = jest.fn().mockResolvedValue({
			data: { posts: [{ uri: 'at://post/1' }] },
		});
		const agent = {
			app: {
				bsky: {
					feed: { searchPosts },
				},
			},
		} as unknown as AtpAgent;

		const result = await searchPostsOperation(agent, 'hello', 5, 'author.bsky.social');

		expect(searchPosts).toHaveBeenCalledWith({
			q: 'hello',
			limit: 5,
			author: 'author.bsky.social',
		});
		expect(result[0].json).toEqual({ uri: 'at://post/1' });
	});
});
