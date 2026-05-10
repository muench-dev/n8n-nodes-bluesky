import {
	createDraftOperation,
	deleteDraftOperation,
	getDraftsOperation,
	updateDraftOperation,
} from '../draftOperations';
import { AtpAgent } from '@atproto/api';

describe('draftOperations', () => {
	let createDraft: jest.Mock;
	let getDrafts: jest.Mock;
	let updateDraft: jest.Mock;
	let deleteDraft: jest.Mock;
	let agent: AtpAgent;

	beforeEach(() => {
		createDraft = jest.fn();
		getDrafts = jest.fn();
		updateDraft = jest.fn();
		deleteDraft = jest.fn();

		agent = {
			app: {
				bsky: {
					draft: { createDraft, getDrafts, updateDraft, deleteDraft },
				},
			},
		} as unknown as AtpAgent;
	});

	describe('createDraftOperation', () => {
		it('should create a draft and return its id', async () => {
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
		it('should update a draft and return confirmation', async () => {
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
	});

	describe('deleteDraftOperation', () => {
		it('should delete a draft and return confirmation', async () => {
			deleteDraft.mockResolvedValue({});

			const result = await deleteDraftOperation(agent, 'draft-id-1');

			expect(deleteDraft).toHaveBeenCalledWith({ id: 'draft-id-1' });
			expect(result).toEqual([{ json: { id: 'draft-id-1', deleted: true } }]);
		});
	});
});
