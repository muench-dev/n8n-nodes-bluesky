import { AtUri, AtpAgent } from '@atproto/api';
import { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';

export const listProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['list'],
			},
		},
		options: [
			{
				name: 'Add User to List',
				value: 'addUserToList',
				description: 'Add a user to a list',
				action: 'Add user to list',
			},
			{
				name: 'Create List',
				value: 'createList',
				description: 'Create a new custom list',
				action: 'Create a list',
			},
			{
				name: 'Delete List',
				value: 'deleteList',
				description: 'Delete a list',
				action: 'Delete a list',
			},
			{
				name: 'Get List Feed',
				value: 'getListFeed',
				description: 'Get posts from a specific list',
				action: 'Get list feed',
			},
			{
				name: 'Get Lists',
				value: 'getLists',
				description: 'Get lists for a user',
				action: 'Get user lists',
			},
			{
				name: 'Remove User From List',
				value: 'removeUserFromList',
				description: 'Remove a user from a list',
				action: 'Remove user from list',
			},
			{
				name: 'Update List',
				value: 'updateList',
				description: 'Update an existing list',
				action: 'Update a list',
			},
		],
		default: 'createList',
	},
	{
		displayName: 'List URI',
		name: 'listUri',
		type: 'string',
		default: '',
		required: true,
		description: 'AT URI of the list',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['addUserToList', 'deleteList', 'getListFeed', 'updateList'],
			},
		},
	},
	{
		displayName: 'Actor',
		name: 'actor',
		type: 'string',
		default: '',
		required: true,
		description: 'Handle or DID of the user whose lists to retrieve',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['getLists'],
			},
		},
	},
	{
		displayName: 'List Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Name of the list',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['createList', 'updateList'],
			},
		},
	},
	{
		displayName: 'Purpose',
		name: 'purpose',
		type: 'options',
		default: 'app.bsky.graph.defs#curatelist',
		required: true,
		options: [
			{
				name: 'Curate List',
				value: 'app.bsky.graph.defs#curatelist',
				description: 'A curated list of users',
			},
			{ name: 'Mod List', value: 'app.bsky.graph.defs#modlist', description: 'A moderation list' },
		],
		description: 'Purpose of the list',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['createList', 'updateList'],
			},
		},
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 3,
		},
		description: 'Description of the list',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['createList', 'updateList'],
			},
		},
	},
	{
		displayName: 'User DID',
		name: 'userDid',
		type: 'string',
		default: '',
		required: true,
		description: 'DID of the user to add or remove',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['addUserToList', 'removeUserFromList'],
			},
		},
	},
	{
		displayName: 'List Item URI',
		name: 'listItemUri',
		type: 'string',
		default: '',
		required: true,
		description: 'AT URI of the list membership record to remove',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['removeUserFromList'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['list'],
				operation: ['getListFeed', 'getLists'],
			},
		},
	},
];

export async function createListOperation(
	agent: AtpAgent,
	name: string,
	purpose: string,
	description?: string,
): Promise<INodeExecutionData[]> {
	const record = {
		$type: 'app.bsky.graph.list',
		name,
		purpose,
		description: description || '',
		createdAt: new Date().toISOString(),
	};

	const response = await agent.com.atproto.repo.createRecord({
		repo: agent.session!.did,
		collection: 'app.bsky.graph.list',
		record,
	});

	return [
		{
			json: {
				uri: response.data.uri,
				cid: response.data.cid,
				...record,
			},
		},
	];
}

export async function updateListOperation(
	agent: AtpAgent,
	listUri: string,
	name: string,
	purpose: string,
	description?: string,
): Promise<INodeExecutionData[]> {
	const { rkey } = new AtUri(listUri);
	const currentRecord = await agent.com.atproto.repo.getRecord({
		repo: agent.session!.did,
		collection: 'app.bsky.graph.list',
		rkey,
	});

	const record = {
		$type: 'app.bsky.graph.list',
		name,
		purpose,
		description: description || '',
		createdAt:
			((currentRecord.data.value as IDataObject)?.createdAt as string) || new Date().toISOString(),
	};

	const response = await agent.com.atproto.repo.putRecord({
		repo: agent.session!.did,
		collection: 'app.bsky.graph.list',
		rkey,
		record,
	});

	return [
		{
			json: {
				uri: listUri,
				cid: response.data.cid,
				...record,
			},
		},
	];
}

export async function deleteListOperation(
	agent: AtpAgent,
	listUri: string,
): Promise<INodeExecutionData[]> {
	const { rkey } = new AtUri(listUri);

	await agent.com.atproto.repo.deleteRecord({
		repo: agent.session!.did,
		collection: 'app.bsky.graph.list',
		rkey,
	});

	return [{ json: { uri: listUri, deleted: true } }];
}

export async function getListsOperation(
	agent: AtpAgent,
	actor: string,
	limit = 50,
): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.graph.getLists({ actor, limit });

	return (response.data.lists ?? []).map((list) => ({
		json: list as unknown as IDataObject,
	}));
}

export async function getListFeedOperation(
	agent: AtpAgent,
	listUri: string,
	limit = 50,
): Promise<INodeExecutionData[]> {
	const response = await agent.app.bsky.feed.getListFeed({ list: listUri, limit });

	return (response.data.feed ?? []).map((item) => ({
		json: item as unknown as IDataObject,
	}));
}

export async function addUserToListOperation(
	agent: AtpAgent,
	listUri: string,
	userDid: string,
): Promise<INodeExecutionData[]> {
	const record = {
		$type: 'app.bsky.graph.listitem',
		subject: userDid,
		list: listUri,
		createdAt: new Date().toISOString(),
	};

	const response = await agent.com.atproto.repo.createRecord({
		repo: agent.session!.did,
		collection: 'app.bsky.graph.listitem',
		record,
	});

	return [
		{
			json: {
				uri: response.data.uri,
				cid: response.data.cid,
				...record,
			},
		},
	];
}

export async function removeUserFromListOperation(
	agent: AtpAgent,
	listItemUri: string,
): Promise<INodeExecutionData[]> {
	const { rkey } = new AtUri(listItemUri);

	await agent.com.atproto.repo.deleteRecord({
		repo: agent.session!.did,
		collection: 'app.bsky.graph.listitem',
		rkey,
	});

	return [{ json: { uri: listItemUri, deleted: true } }];
}
