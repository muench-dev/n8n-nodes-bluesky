import { AppBskyDraftDefs, AtpAgent } from '@atproto/api';
import { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { getLanguageOptions } from './languages';

export const draftProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['draft'],
			},
		},
		options: [
			{
				name: 'Create Draft',
				value: 'createDraft',
				description: 'Create a new draft',
				action: 'Create a draft',
			},
			{
				name: 'Delete Draft',
				value: 'deleteDraft',
				description: 'Delete a draft by ID',
				action: 'Delete a draft',
			},
			{
				name: 'Get Drafts',
				value: 'getDrafts',
				description: 'Retrieve drafts with optional pagination',
				action: 'Get drafts',
			},
			{
				name: 'Update Draft',
				value: 'updateDraft',
				description: 'Update an existing draft',
				action: 'Update a draft',
			},
		],
		default: 'createDraft',
	},
	{
		displayName: 'Draft ID',
		name: 'draftId',
		type: 'string',
		default: '',
		required: true,
		description: 'The ID of the draft',
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['deleteDraft', 'updateDraft'],
			},
		},
	},
	{
		displayName: 'Post Text',
		name: 'postText',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['createDraft', 'updateDraft'],
			},
		},
	},
	{
		displayName: 'Language Names or IDs',
		name: 'langs',
		type: 'multiOptions',
		description:
			'Choose from the list of supported languages. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
		options: getLanguageOptions(),
		default: ['en'],
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['createDraft', 'updateDraft'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'draftLimit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		description: 'Max number of drafts to return',
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['getDrafts'],
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'draftCursor',
		type: 'string',
		default: '',
		description: 'Pagination cursor from a previous request',
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['getDrafts'],
			},
		},
	},
];

export function createSimpleDraftPayload(
	postText: string,
	langs: string[],
): AppBskyDraftDefs.Draft {
	return {
		$type: 'app.bsky.draft.defs#draft',
		posts: [
			{
				$type: 'app.bsky.draft.defs#draftPost',
				text: postText,
			},
		],
		langs,
	};
}

export async function createDraftOperation(
	agent: AtpAgent,
	draft: AppBskyDraftDefs.Draft,
): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.draft.createDraft({
		draft,
	});

	return [{ json: { id: response.data.id } }];
}

export async function getDraftsOperation(
	agent: AtpAgent,
	limit = 50,
	cursor?: string,
): Promise<INodeExecutionData[]> {
	const params: { limit: number; cursor?: string } = { limit };
	if (cursor) {
		params.cursor = cursor;
	}

	const response = await agent.app.bsky.draft.getDrafts(params);

	return (response.data.drafts ?? []).map((draft) => ({
		json: draft as unknown as IDataObject,
	}));
}

export async function updateDraftOperation(
	agent: AtpAgent,
	draftId: string,
	draft: AppBskyDraftDefs.Draft,
): Promise<INodeExecutionData[]> {
	await agent.app.bsky.draft.updateDraft({
		draft: {
			$type: 'app.bsky.draft.defs#draftWithId',
			id: draftId,
			draft,
		},
	});

	return [{ json: { id: draftId, updated: true } }];
}

export async function deleteDraftOperation(
	agent: AtpAgent,
	draftId: string,
): Promise<INodeExecutionData[]> {
	await agent.app.bsky.draft.deleteDraft({ id: draftId });

	return [{ json: { id: draftId, deleted: true } }];
}
