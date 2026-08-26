//#region src/invariant.ts
const PACKAGE_NAME = "@starsinc1708/dsh-tool-council";
/** Cordis companion plugin name. */
const name = "tool-council-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: this row owns no event stream or mutable runtime data — it registers one
* tool and one prompt section, and the workflow engine owns run lifecycle, child pairing, and
* disposal for every council member.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
