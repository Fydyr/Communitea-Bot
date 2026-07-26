import { describe, it, expect } from "vitest";
import { repairJson } from "../../src/services/jsonRepair";

describe("repairJson", () => {
  it("supprime une virgule traînante avant }", () => {
    const repaired = repairJson('{"a": 1,}');
    expect(JSON.parse(repaired)).toEqual({ a: 1 });
  });

  it("supprime une virgule traînante avant ]", () => {
    const repaired = repairJson('{"a": [1, 2,]}');
    expect(JSON.parse(repaired)).toEqual({ a: [1, 2] });
  });

  it("rend parsable un JSON contenant un saut de ligne non échappé", () => {
    // Le nettoyage des caractères de contrôle remplace le saut de ligne brut
    // par une espace, ce qui produit un JSON valide.
    const repaired = repairJson('{"a": "ligne1\nligne2"}');
    expect(JSON.parse(repaired)).toEqual({ a: "ligne1 ligne2" });
  });

  it("laisse un JSON déjà valide inchangé sémantiquement", () => {
    const repaired = repairJson('{"a": "ok", "b": 2}');
    expect(JSON.parse(repaired)).toEqual({ a: "ok", b: 2 });
  });
});
