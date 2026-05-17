import {
	createDraftOperation,
	deleteDraftOperation,
	getDraftsOperation,
	publishDraftOperation,
	updateDraftOperation,
} from '../draftOperations';
import { AtpAgent } from '@atproto/api';

describe('draftOperations', () => {
	let createDraft: jest.Mock;
	let getDrafts: jest.Mock;
	let updateDraft: jest.Mock;
	let deleteDraft: jest.Mock;
	let post: jest.Mock;
	let agent: AtpAgent;

	beforeEach(() => {
		createDraft = jest.fn();
		getDrafts = jest.fn();
		updateDraft = jest.fn();
		deleteDraft = jest.fn();
		post = jest.fn().mockResolvedValue({ uri: 'at://test/post/1', cid: 'cid-1' });

		agent = {
			app: {
				bsky: {
					draft: { createDraft, getDrafts, updateDraft, deleteDraft },
				},
			},
			post,
		} as unknown as AtpAgent;
	});

	describe('createDraftOperation', () => {
		it('should create a draft with text and langs and return its id', async () => {
			createDraft.mockResolvedValue({ data: { id: 'draft-id-1' } });

			const result = await createDraftOperation(agent, 'Hello draft', ['en']);

			expect(createDraft).toHaveBeenCalledWith({
				draft: {
					$type: 'app.bsky.draft.defs#draft',
					posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Hello draft' }],
					langs: ['en'],
				},
			});
			expect(result).toEqual([{ json: { id: 'draft-id-1' } }]);
		});

		it('should include an external embed when externalUri is provided', async () => {
			createDraft.mockResolvedValue({ data: { id: 'draft-id-2' } });

			await createDraftOperation(agent, 'Link post', ['en'], 'https://example.com');

			const draftArg = createDraft.mock.calls[0][0].draft;
			expect(draftArg.posts[0].embedExternals).toEqual([
				{ $type: 'app.bsky.draft.defs#draftEmbedExternal', uri: 'https://example.com/' },
			]);
			expect(draftArg.posts[0].embedRecords).toBeUndefined();
		});

		it('should include a record embed when quoteUri and quoteCid are provided', async () => {
			createDraft.mockResolvedValue({ data: { id: 'draft-id-3' } });

			await createDraftOperation(agent, 'Quote post', ['en'], undefined, 'at://post/1', 'cid-abc');

			const draftArg = createDraft.mock.calls[0][0].draft;
			expect(draftArg.posts[0].embedRecords).toEqual([
				{
					$type: 'app.bsky.draft.defs#draftEmbedRecord',
					record: { uri: 'at://post/1', cid: 'cid-abc' },
				},
			]);
			expect(draftArg.posts[0].embedExternals).toBeUndefined();
		});

		it('should throw when only quoteUri is provided', async () => {
			await expect(
				createDraftOperation(agent, 'Incomplete quote', ['en'], undefined, 'at://post/1'),
			).rejects.toThrow('Quote Post URI and Quote Post CID must be provided together.');
			expect(createDraft).not.toHaveBeenCalled();
		});

		it('should throw when only quoteCid is provided', async () => {
			await expect(
				createDraftOperation(agent, 'Incomplete quote', ['en'], undefined, undefined, 'cid-abc'),
			).rejects.toThrow('Quote Post URI and Quote Post CID must be provided together.');
			expect(createDraft).not.toHaveBeenCalled();
		});

		it('should throw when both externalUri and quoteUri/quoteCid are provided', async () => {
			await expect(
				createDraftOperation(
					agent,
					'Ambiguous post',
					['en'],
					'https://example.com',
					'at://post/1',
					'cid-abc',
				),
			).rejects.toThrow(
				'A draft post can only have one embed type. Provide either an External URI or a Quote Post URI/CID, not both.',
			);
			expect(createDraft).not.toHaveBeenCalled();
		});

		it('should throw when externalUri is provided alongside a partial quote (only quoteUri)', async () => {
			await expect(
				createDraftOperation(
					agent,
					'Ambiguous post',
					['en'],
					'https://example.com',
					'at://post/1',
				),
			).rejects.toThrow('Quote Post URI and Quote Post CID must be provided together.');
			expect(createDraft).not.toHaveBeenCalled();
		});

		it('should throw when externalUri is invalid', async () => {
			await expect(createDraftOperation(agent, 'Link post', ['en'], 'not-a-url')).rejects.toThrow(
				'External URI must be a valid URL.',
			);
			expect(createDraft).not.toHaveBeenCalled();
		});

		it('should throw when externalUri uses an unsupported scheme', async () => {
			await expect(
				createDraftOperation(agent, 'Link post', ['en'], 'ftp://example.com'),
			).rejects.toThrow('External URI must use the http or https scheme.');
			expect(createDraft).not.toHaveBeenCalled();
		});
	});

	describe('getDraftsOperation', () => {
		it('should return a list of drafts', async () => {
			const mockDraft = {
				id: 'draft-id-1',
				draft: { posts: [{ text: 'Hello' }], langs: ['en'] },
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts.mockResolvedValue({ data: { drafts: [mockDraft] } });

			const result = await getDraftsOperation(agent, 10);

			expect(getDrafts).toHaveBeenCalledWith({ limit: 10 });
			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockDraft);
		});

		it('should pass cursor when provided', async () => {
			getDrafts.mockResolvedValue({ data: { drafts: [] } });

			await getDraftsOperation(agent, 50, 'cursor-abc');

			expect(getDrafts).toHaveBeenCalledWith({ limit: 50, cursor: 'cursor-abc' });
		});

		it('should return empty array when no drafts', async () => {
			getDrafts.mockResolvedValue({ data: { drafts: [] } });

			const result = await getDraftsOperation(agent);

			expect(result).toEqual([]);
		});
	});

	describe('updateDraftOperation', () => {
		it('should update a draft with new text and langs and return confirmation', async () => {
			updateDraft.mockResolvedValue({});

			const result = await updateDraftOperation(agent, 'draft-id-1', 'Updated text', ['de']);

			expect(updateDraft).toHaveBeenCalledWith({
				draft: {
					$type: 'app.bsky.draft.defs#draftWithId',
					id: 'draft-id-1',
					draft: {
						$type: 'app.bsky.draft.defs#draft',
						posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Updated text' }],
						langs: ['de'],
					},
				},
			});
			expect(result).toEqual([{ json: { id: 'draft-id-1', updated: true } }]);
		});

		it('should include an external embed when externalUri is provided', async () => {
			updateDraft.mockResolvedValue({});

			await updateDraftOperation(
				agent,
				'draft-id-1',
				'Updated with link',
				['en'],
				'https://example.com',
			);

			const draftArg = updateDraft.mock.calls[0][0].draft.draft;
			expect(draftArg.posts[0].embedExternals).toEqual([
				{ $type: 'app.bsky.draft.defs#draftEmbedExternal', uri: 'https://example.com/' },
			]);
		});
	});

	describe('deleteDraftOperation', () => {
		it('should delete a draft and return confirmation', async () => {
			deleteDraft.mockResolvedValue({});

			const result = await deleteDraftOperation(agent, 'draft-id-1');

			expect(deleteDraft).toHaveBeenCalledWith({ id: 'draft-id-1' });
			expect(result).toEqual([{ json: { id: 'draft-id-1', deleted: true } }]);
		});
	});

	describe('publishDraftOperation', () => {
		it('should publish the draft as a post, delete it, and return the result', async () => {
			const mockDraftView = {
				id: 'draft-id-1',
				draft: {
					posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Published text' }],
					langs: ['en'],
				},
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts.mockResolvedValue({ data: { drafts: [mockDraftView] } });
			deleteDraft.mockResolvedValue({});

			const result = await publishDraftOperation(agent, 'draft-id-1');

			expect(post).toHaveBeenCalledTimes(1);
			expect(post).toHaveBeenCalledWith(
				expect.objectContaining({
					text: 'Published text',
					langs: ['en'],
				}),
			);
			expect(deleteDraft).toHaveBeenCalledWith({ id: 'draft-id-1' });
			expect(result).toEqual([
				{
					json: {
						uri: 'at://test/post/1',
						cid: 'cid-1',
						draftId: 'draft-id-1',
						draftDeleted: true,
					},
				},
			]);
		});

		it('should publish all posts as a thread when the draft has multiple posts', async () => {
			const mockDraftView = {
				id: 'draft-id-thread',
				draft: {
					posts: [
						{ $type: 'app.bsky.draft.defs#draftPost', text: 'Thread post 1' },
						{ $type: 'app.bsky.draft.defs#draftPost', text: 'Thread post 2' },
						{ $type: 'app.bsky.draft.defs#draftPost', text: 'Thread post 3' },
					],
					langs: ['en'],
				},
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts.mockResolvedValue({ data: { drafts: [mockDraftView] } });
			post
				.mockResolvedValueOnce({ uri: 'at://test/post/1', cid: 'cid-1' })
				.mockResolvedValueOnce({ uri: 'at://test/post/2', cid: 'cid-2' })
				.mockResolvedValueOnce({ uri: 'at://test/post/3', cid: 'cid-3' });
			deleteDraft.mockResolvedValue({});

			const result = await publishDraftOperation(agent, 'draft-id-thread');

			expect(post).toHaveBeenCalledTimes(3);

			// First post has no reply
			expect(post).toHaveBeenNthCalledWith(
				1,
				expect.not.objectContaining({ reply: expect.anything() }),
			);

			// Second post replies to the first
			expect(post).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					text: 'Thread post 2',
					reply: {
						root: { uri: 'at://test/post/1', cid: 'cid-1' },
						parent: { uri: 'at://test/post/1', cid: 'cid-1' },
					},
				}),
			);

			// Third post: root is still the first, parent is the second
			expect(post).toHaveBeenNthCalledWith(
				3,
				expect.objectContaining({
					text: 'Thread post 3',
					reply: {
						root: { uri: 'at://test/post/1', cid: 'cid-1' },
						parent: { uri: 'at://test/post/2', cid: 'cid-2' },
					},
				}),
			);

			expect(result).toHaveLength(3);
			expect(result[0].json).toEqual(
				expect.objectContaining({ uri: 'at://test/post/1', draftId: 'draft-id-thread' }),
			);
			expect(result[2].json).toEqual(
				expect.objectContaining({ uri: 'at://test/post/3', draftId: 'draft-id-thread' }),
			);
		});

		it('should include an external embed with URI as title when the draft has an external URI', async () => {
			const mockDraftView = {
				id: 'draft-id-2',
				draft: {
					posts: [
						{
							$type: 'app.bsky.draft.defs#draftPost',
							text: 'Link post',
							embedExternals: [
								{ $type: 'app.bsky.draft.defs#draftEmbedExternal', uri: 'https://example.com' },
							],
						},
					],
					langs: ['en'],
				},
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts.mockResolvedValue({ data: { drafts: [mockDraftView] } });
			deleteDraft.mockResolvedValue({});

			await publishDraftOperation(agent, 'draft-id-2');

			expect(post).toHaveBeenCalledWith(
				expect.objectContaining({
					embed: {
						$type: 'app.bsky.embed.external',
						external: {
							uri: 'https://example.com',
							title: 'https://example.com',
							description: '',
						},
					},
				}),
			);
		});

		it('should include a record embed when the draft quotes a post', async () => {
			const mockDraftView = {
				id: 'draft-id-3',
				draft: {
					posts: [
						{
							$type: 'app.bsky.draft.defs#draftPost',
							text: 'Quote post',
							embedRecords: [
								{
									$type: 'app.bsky.draft.defs#draftEmbedRecord',
									record: { uri: 'at://quoted/post/1', cid: 'quoted-cid' },
								},
							],
						},
					],
					langs: ['en'],
				},
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts.mockResolvedValue({ data: { drafts: [mockDraftView] } });
			deleteDraft.mockResolvedValue({});

			await publishDraftOperation(agent, 'draft-id-3');

			expect(post).toHaveBeenCalledWith(
				expect.objectContaining({
					embed: {
						$type: 'app.bsky.embed.record',
						record: { uri: 'at://quoted/post/1', cid: 'quoted-cid' },
					},
				}),
			);
		});

		it('should throw an error when the draft is not found', async () => {
			getDrafts.mockResolvedValue({ data: { drafts: [] } });

			await expect(publishDraftOperation(agent, 'nonexistent-id')).rejects.toThrow(
				"Draft with ID 'nonexistent-id' not found.",
			);
		});

		it('should paginate to find the draft when it is not on the first page', async () => {
			const mockDraftView = {
				id: 'draft-id-page2',
				draft: {
					posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Found on page 2' }],
					langs: ['en'],
				},
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts
				.mockResolvedValueOnce({ data: { drafts: [], cursor: 'next-page-cursor' } })
				.mockResolvedValueOnce({ data: { drafts: [mockDraftView] } });
			deleteDraft.mockResolvedValue({});

			const result = await publishDraftOperation(agent, 'draft-id-page2');

			expect(getDrafts).toHaveBeenCalledTimes(2);
			expect(getDrafts).toHaveBeenNthCalledWith(1, { limit: 100 });
			expect(getDrafts).toHaveBeenNthCalledWith(2, { limit: 100, cursor: 'next-page-cursor' });
			expect(result[0].json.draftId).toBe('draft-id-page2');
		});

		it('should return draftDeleted: false and log an error when draft deletion fails after posting', async () => {
			const mockDraftView = {
				id: 'draft-id-del-fail',
				draft: {
					posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Delete fail post' }],
					langs: ['en'],
				},
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-02T00:00:00Z',
			};
			getDrafts.mockResolvedValue({ data: { drafts: [mockDraftView] } });
			deleteDraft.mockRejectedValue(new Error('Network error'));

			const result = await publishDraftOperation(agent, 'draft-id-del-fail');

			expect(post).toHaveBeenCalledTimes(1);
			expect(result).toEqual([
				expect.objectContaining({
					json: expect.objectContaining({
						uri: 'at://test/post/1',
						cid: 'cid-1',
						draftId: 'draft-id-del-fail',
						draftDeleted: false,
					}),
				}),
			]);
		});
	});
});
