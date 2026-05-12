import {
	createSimpleDraftPayload,
	createDraftOperation,
	deleteDraftOperation,
	getDraftPayloadFromInput,
	getDraftsOperation,
	parseDraftPayload,
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

			const draft = createSimpleDraftPayload('Hello draft', ['en']);
			const result = await createDraftOperation(agent, draft);

			expect(createDraft).toHaveBeenCalledWith({
				draft,
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
			const draft = createSimpleDraftPayload('Updated text', ['de']);

			const result = await updateDraftOperation(agent, 'draft-id-1', draft);

			expect(updateDraft).toHaveBeenCalledWith({
				draft: {
					$type: 'app.bsky.draft.defs#draftWithId',
					id: 'draft-id-1',
					draft,
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

	describe('parseDraftPayload', () => {
		it('should parse payload and normalize missing $type values', () => {
			const payload = parseDraftPayload(
				JSON.stringify({
					posts: [{ text: 'Payload text' }],
					langs: ['en'],
					deviceName: 'n8n',
				}),
			);

			expect(payload).toEqual({
				$type: 'app.bsky.draft.defs#draft',
				posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Payload text' }],
				langs: ['en'],
				deviceName: 'n8n',
			});
		});

		it('should throw for invalid JSON payloads', () => {
			expect(() => parseDraftPayload('{invalid-json')).toThrow('Draft payload must be valid JSON');
		});
	});

	describe('getDraftPayloadFromInput', () => {
		it('should use payload mode for advanced draft JSON', () => {
			const payload = getDraftPayloadFromInput(
				'payload',
				'Ignored text',
				['en'],
				JSON.stringify({
					posts: [{ text: 'Advanced draft' }],
					langs: ['de'],
				}),
			);

			expect(payload).toEqual({
				$type: 'app.bsky.draft.defs#draft',
				posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Advanced draft' }],
				langs: ['de'],
			});
		});
	});
});
