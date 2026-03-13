import { defineSystem, TickPhase } from '@babylon/sim';

/**
 * Type augmentation — declares what this system adds to the shared config
 * and shared data. Other systems importing @babylon/sim will see these types
 * on ctx.config and ctx.shared automatically.
 */
declare module '@babylon/sim' {
  interface BabylonConfig {
    hello?: { greeting: string };
  }
  interface BabylonSharedData {
    helloRan: boolean;
  }
}

export default defineSystem({
  id: 'hello-world',
  name: 'Hello World',
  phase: TickPhase.Bootstrap,

  async onTick(ctx) {
    const greeting = ctx.config.hello?.greeting ?? 'Hello from the sim engine!';
    ctx.logger.info(greeting, { tick: ctx.tickNumber }, 'HelloWorld');

    return {
      metrics: { helloTicks: 1 },
      sharedData: { helloRan: true },
    };
  },
});
