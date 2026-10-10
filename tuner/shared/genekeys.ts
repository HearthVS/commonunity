/**
 * OM Tuner — Gene Keys re-export
 *
 * The canonical implementation lives in sdk/genekeys.ts.
 * This file re-exports everything from there so existing imports
 * in the Tuner codebase continue to work without changes.
 *
 * To upgrade the synthesis engine: edit sdk/genekeys.ts
 * See sdk/../tuner/SYNTHESIS_ENGINE.md for the upgrade protocol.
 */
export * from "@sdk/genekeys";
