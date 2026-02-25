import { consola, createConsola } from "consola";

export const logger = createConsola({
  fancy: true,
  formatOptions: {
    date: false,
    columns: 80,
  },
});

export function createScopedLogger(scope: string) {
  return logger.withTag(scope);
}
