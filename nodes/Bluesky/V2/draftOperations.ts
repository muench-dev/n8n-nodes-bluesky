import { AppBskyDraftDefs, AtpAgent, RichText } from '@atproto/api';
import { IDataObject, INodeExecutionData, INodeProperties, LoggerProxy as Logger } from 'n8n-workflow';
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
				name: 'Publish Draft',
				value: 'publishDraft',
				description: 'Publish a draft as a post and delete it',
				action: 'Publish a draft',
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
				operation: ['deleteDraft', 'updateDraft', 'publishDraft'],
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
		displayName: 'External URI',
		name: 'draftExternalUri',
		type: 'string',
		default: '',
		description: 'URL to attach as an external link embed to this draft',
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['createDraft', 'updateDraft'],
			},
		},
	},
	{
		displayName: 'Quote Post URI',
		name: 'draftQuoteUri',
		type: 'string',
		default: '',
		description: 'The AT-URI of the post to quote in this draft',
		displayOptions: {
			show: {
				resource: ['draft'],
				operation: ['createDraft', 'updateDraft'],
			},
		},
	},
	{
		displayName: 'Quote Post CID',
		name: 'draftQuoteCid',
		type: 'string',
		default: '',
		description: 'The CID of the post to quote in this draft',
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

function buildDraftPayload(
	postText: string,
	langs: string[],
	externalUri?: string,
	quoteUri?: string,
	quoteCid?: string,
): AppBskyDraftDefs.Draft {
	const draftPost: AppBskyDraftDefs.DraftPost = {
		$type: 'app.bsky.draft.defs#draftPost',
		text: postText,
	};

	if (externalUri) {
		draftPost.embedExternals = [
			{
				$type: 'app.bsky.draft.defs#draftEmbedExternal',
				uri: externalUri,
			},
		];
	}

	if (quoteUri && quoteCid) {
		draftPost.embedRecords = [
			{
				$type: 'app.bsky.draft.defs#draftEmbedRecord',
				record: { uri: quoteUri, cid: quoteCid },
			},
		];
	}

	return {
		$type: 'app.bsky.draft.defs#draft',
		posts: [draftPost],
		langs,
	};
}

export async function createDraftOperation(
	agent: AtpAgent,
	postText: string,
	langs: string[],
	externalUri?: string,
	quoteUri?: string,
	quoteCid?: string,
): Promise<INodeExecutionData[]> {
	const draft = buildDraftPayload(postText, langs, externalUri, quoteUri, quoteCid);
	const response = await agent.app.bsky.draft.createDraft({ draft });

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
	postText: string,
	langs: string[],
	externalUri?: string,
	quoteUri?: string,
	quoteCid?: string,
): Promise<INodeExecutionData[]> {
	const draft = buildDraftPayload(postText, langs, externalUri, quoteUri, quoteCid);
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

async function findDraftById(
	agent: AtpAgent,
	draftId: string,
): Promise<AppBskyDraftDefs.DraftView | undefined> {
	let cursor: string | undefined;

	do {
		const params: { limit: number; cursor?: string } = { limit: 100 };
		if (cursor) {
			params.cursor = cursor;
		}

		const response = await agent.app.bsky.draft.getDrafts(params);
		const match = (response.data.drafts ?? []).find((d) => d.id === draftId);
		if (match) {
			return match;
		}

		cursor = response.data.cursor;
	} while (cursor);

	return undefined;
}

export async function publishDraftOperation(
	agent: AtpAgent,
	draftId: string,
): Promise<INodeExecutionData[]> {
	const draftView = await findDraftById(agent, draftId);
	if (!draftView) {
		throw new Error(`Draft with ID '${draftId}' not found.`);
	}

	const firstPost = draftView.draft.posts[0];
	if (!firstPost) {
		throw new Error(`Draft '${draftId}' contains no posts.`);
	}

	const rt = new RichText({ text: firstPost.text });
	try {
		await rt.detectFacets(agent);
	} catch (facetsErr: any) {
		Logger.error(`Failed to detect facets in draft text: ${facetsErr?.message || facetsErr}`);
	}

	const postData: any = {
		text: rt.text || firstPost.text,
		langs: draftView.draft.langs ?? [],
		facets: rt.facets,
	};

	const externalEmbed = firstPost.embedExternals?.[0];
	const recordEmbed = firstPost.embedRecords?.[0];

	if (recordEmbed) {
		postData.embed = {
			$type: 'app.bsky.embed.record',
			record: {
				uri: recordEmbed.record.uri,
				cid: recordEmbed.record.cid,
			},
		};
	} else if (externalEmbed) {
		postData.embed = {
			$type: 'app.bsky.embed.external',
			external: {
				uri: externalEmbed.uri,
				title: '',
				description: '',
			},
		};
	}

	const postResponse: { uri: string; cid: string } = await agent.post(postData);

	await agent.app.bsky.draft.deleteDraft({ id: draftId });

	return [
		{
			json: {
				uri: postResponse.uri,
				cid: postResponse.cid,
				draftId,
			},
		},
	];
}
