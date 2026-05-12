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
			expect(() => parseDraftPayload('{invalid-json')).toThrow(
				'Draft payload must be valid JSON:',
			);
		});

		it('should throw when payload is not a JSON object', () => {
			expect(() => parseDraftPayload('null')).toThrow('Draft payload must be a JSON object');
			expect(() => parseDraftPayload('[]')).toThrow('Draft payload must be a JSON object');
		});

		it('should throw when posts are missing, invalid, or empty', () => {
			expect(() => parseDraftPayload(JSON.stringify({ langs: ['en'] }))).toThrow(
				'Draft payload must include "posts"',
			);
			expect(() => parseDraftPayload(JSON.stringify({ posts: {} }))).toThrow(
				'Draft payload "posts" must be an array',
			);
			expect(() => parseDraftPayload(JSON.stringify({ posts: [] }))).toThrow(
				'Draft payload "posts" must not be empty',
			);
		});

		it('should throw when a draft post has no valid text field', () => {
			expect(() =>
				parseDraftPayload(
					JSON.stringify({
						posts: [{}],
					}),
				),
			).toThrow('Each draft post must include a "text" string');
		});

		it('should throw when a draft post is not an object', () => {
			expect(() =>
				parseDraftPayload(
					JSON.stringify({
						posts: ['invalid'],
					}),
				),
			).toThrow('Each draft post must be a JSON object');
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

		it('should use simple mode for text and language input', () => {
			const payload = getDraftPayloadFromInput('simple', 'Simple draft', ['it']);

			expect(payload).toEqual({
				$type: 'app.bsky.draft.defs#draft',
				posts: [{ $type: 'app.bsky.draft.defs#draftPost', text: 'Simple draft' }],
				langs: ['it'],
			});
		});

		it('should fail when payload mode is selected without payload JSON', () => {
			expect(() => getDraftPayloadFromInput('payload', 'Ignored text', ['en'], '   ')).toThrow(
				'Draft payload is required when using payload mode',
			);
		});
	});
});
