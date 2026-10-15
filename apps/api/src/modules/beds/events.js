import { eventBus } from '../../lib/eventBus.js';
import { getSocketServer } from '../../lib/socket.js';
import { getBedCounts } from './service.js';

eventBus.on('bed.updated', () => {
  void getBedCounts()
    .then((counts) => getSocketServer()?.to('staff').emit('bed.counts', counts))
    .catch((error) =>
      console.error('Failed to publish bed counts', error.message),
    );
});
