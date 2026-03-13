import { defineBabylonConfig } from './core/config';

export default defineBabylonConfig({
  systemsDir: './systems',
  budgetMs: 60_000,
  disabledSystems: [],
  hello: {
    greeting: 'wow',
  },
  dev: {
    watch: true,
    watchConfig: true,
  },
});
