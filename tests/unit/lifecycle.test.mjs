import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
import {createReconnectScheduler} from '../../packages/whatsapp-engine/src/reconnect-scheduler.js';
import {createSerialExecutor} from '../../apps/server/src/lib/serial-operations.js';

describe('SKYWA lifecycle guards', () => {
  test('cancelled reconnect timer cannot call stale callback', () => {
    let sequence = 0;
    const timers = new Map();
    const scheduler = createReconnectScheduler({
      setTimeoutFn: (callback, delay) => {
        const id = ++sequence;
        timers.set(id, {callback, delay});
        return id;
      },
      clearTimeoutFn: id => timers.delete(id)
    });
    let called = 0;
    scheduler.schedule(() => { called++; }, 1000);
    const oldTimer = timers.get(1);
    assert.equal(scheduler.hasPending(), true);
    scheduler.cancel();
    assert.equal(scheduler.hasPending(), false);
    assert.equal(timers.has(1), false);
    oldTimer.callback();
    assert.equal(called, 0);
  });

  test('serial executor prevents overlapping start and stop operations', async () => {
    const serialize = createSerialExecutor();
    const order = [];
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    const first = serialize(async () => {
      order.push('start:first');
      await barrier;
      order.push('end:first');
    });
    const second = serialize(async () => { order.push('start:second'); });
    await Promise.resolve();
    assert.deepEqual(order, ['start:first']);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['start:first', 'end:first', 'start:second']);
  });

  test('a failed lifecycle operation does not poison the queue', async () => {
    const serialize = createSerialExecutor();
    await assert.rejects(serialize(async () => { throw new Error('expected'); }), /expected/);
    assert.equal(await serialize(async () => 'next operation ran'), 'next operation ran');
  });
});
