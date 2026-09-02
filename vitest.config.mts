import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Les tests du moteur écrivent dans une base partagée : les exécuter en
    // parallèle les ferait se marcher dessus sur l'inventaire. La sérialisation
    // est ici un choix de justesse, pas une limitation.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
  },
});
