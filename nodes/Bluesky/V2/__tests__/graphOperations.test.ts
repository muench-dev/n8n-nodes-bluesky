import { muteThreadOperation } from '../graphOperations';
import { AtpAgent } from '@atproto/api';

describe('graphOperations', () => {
	it('muteThreadOperation should mute thread root', async () => {
		const muteThread = jest.fn().mockResolvedValue({});
		const agent = {
			app: {
				bsky: {
					graph: { muteThread },
				},
			},
		} as unknown as AtpAgent;

		const result = await muteThreadOperation(agent, 'at://thread/root');

		expect(muteThread).toHaveBeenCalledWith({ root: 'at://thread/root' });
		expect(result[0].json).toEqual({ uri: 'at://thread/root', muted: true });
	});
});
