import { defineSystem, TickPhase } from '@babylon/sim';

export default defineSystem({
  id: 'hello-world',
  name: 'Hello World',
  phase: TickPhase.Bootstrap,

  async onTick(ctx) {
    ctx.logger.info(
      'Hello from the sim engine!',
      { tick: ctx.tickNumber },
      'HelloWorld'
    );

    return {
      metrics: { helloTicks: 1 },
    };
  },
});
