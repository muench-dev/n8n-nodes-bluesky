import {
	getPostInteractionsOperation,
	getUnreadCountOperation,
	listNotificationsOperation,
	updateSeenNotificationsOperation,
} from '../analyticsOperations';
import { AtpAgent } from '@atproto/api';

describe('analyticsOperations', () => {
	it('listNotificationsOperation should filter unread notifications', async () => {
		const updateSeen = jest.fn().mockResolvedValue({});
		const agent = {
			app: {
				bsky: {
					notification: {
						listNotifications: jest.fn().mockResolvedValue({
							data: {
								notifications: [
									{ id: '1', isRead: false },
									{ id: '2', isRead: true },
								],
							},
						}),
						updateSeen,
						getUnreadCount: jest.fn().mockResolvedValue({ data: { count: 3 } }),
					},
					feed: {
						getLikes: jest
							.fn()
							.mockResolvedValue({
								data: { likes: [{ actor: { did: '1' }, createdAt: 'now', indexedAt: 'now' }] },
							}),
						getRepostedBy: jest.fn().mockResolvedValue({ data: { repostedBy: [{ did: '2' }] } }),
						getPostThread: jest
							.fn()
							.mockResolvedValue({
								data: { thread: { replies: [{ post: { author: { did: '3' } } }] } },
							}),
					},
				},
			},
		} as unknown as AtpAgent;

		const result = await listNotificationsOperation(agent, 10, true, true);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ id: '1', isRead: false });
		expect(updateSeen).toHaveBeenCalled();
	});

	it('getUnreadCountOperation should return unread count', async () => {
		const agent = {
			app: {
				bsky: {
					notification: {
						getUnreadCount: jest.fn().mockResolvedValue({ data: { count: 9 } }),
					},
				},
			},
		} as unknown as AtpAgent;

		const result = await getUnreadCountOperation(agent);
		expect(result[0].json).toEqual({ count: 9 });
	});

	it('updateSeenNotificationsOperation should use provided timestamp', async () => {
		const updateSeen = jest.fn().mockResolvedValue({});
		const agent = {
			app: {
				bsky: {
					notification: { updateSeen },
				},
			},
		} as unknown as AtpAgent;

		const result = await updateSeenNotificationsOperation(agent, '2025-01-01T00:00:00.000Z');

		expect(updateSeen).toHaveBeenCalledWith({ seenAt: '2025-01-01T00:00:00.000Z' });
		expect(result[0].json).toEqual({ success: true, seenAt: '2025-01-01T00:00:00.000Z' });
	});

	it('getPostInteractionsOperation should aggregate likes reposts and replies', async () => {
		const agent = {
			app: {
				bsky: {
					feed: {
						getLikes: jest
							.fn()
							.mockResolvedValue({
								data: { likes: [{ actor: { did: '1' }, createdAt: 'now', indexedAt: 'now' }] },
							}),
						getRepostedBy: jest.fn().mockResolvedValue({ data: { repostedBy: [{ did: '2' }] } }),
						getPostThread: jest
							.fn()
							.mockResolvedValue({
								data: { thread: { replies: [{ post: { author: { did: '3' } } }] } },
							}),
					},
				},
			},
		} as unknown as AtpAgent;

		const result = await getPostInteractionsOperation(
			agent,
			'at://post/1',
			['likes', 'reposts', 'replies'],
			10,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				analytics: {
					likeCount: 1,
					repostCount: 1,
					replyCount: 1,
				},
			}),
		);
	});
});
