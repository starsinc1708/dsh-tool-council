/**
 * Council settings-card dictionaries.
 * @module @deepseek-ai/dsh-client-ui-council
 */
/** The locale namespace this plugin registers. */
export declare const NS: "council";
/** English copy; its key set is the namespace's contract. */
export declare const en: {
    title: string;
    description: string;
    defaultPreset: string;
    width: string;
    count: string;
    model: string;
    modelInherit: string;
    quorum: string;
    threshold: string;
    overridden: string;
    resetPreset: string;
    discard: string;
    save: string;
    'kind.map': string;
    'kind.verify': string;
    'kind.reduce': string;
    'quorumRule.majority': string;
    'quorumRule.unanimous': string;
    'quorumRule.threshold': string;
    'status.loading': string;
    'status.unavailable': string;
    'view.council': string;
    onlyMapReduce: string;
    noRuns: string;
    tokens: string;
    'status.running': string;
    'status.completed': string;
    'status.failed': string;
    'status.cancelled': string;
    'status.interrupted': string;
};
/** Chinese copy; must cover exactly {@link en}'s key set. */
export declare const zh: typeof en;
/** Every key this namespace serves. */
export type CouncilKey = keyof typeof en;
