/**
 * Council settings-card dictionaries.
 * @module @deepseek-ai/dsh-client-ui-council
 */

/** The locale namespace this plugin registers. */
export const NS = 'council' as const

/** English copy; its key set is the namespace's contract. */
export const en = {
  'title': 'Council',
  'description': 'How many members examine a task, how many verify each finding, and what it takes to confirm one.',
  'defaultPreset': 'Default preset',
  'width': '{n} members',
  'count': 'copies',
  'model': 'model',
  'modelInherit': 'inherit',
  'quorum': 'quorum',
  'threshold': 'needs',
  'overridden': 'overridden',
  'resetPreset': 'Reset this preset',
  'discard': 'Discard',
  'save': 'Save',
  'kind.map': 'examine',
  'kind.verify': 'verify',
  'kind.reduce': 'synthesize',
  'quorumRule.majority': 'simple majority',
  'quorumRule.unanimous': 'unanimous',
  'quorumRule.threshold': 'at least N confirmations',
  'status.loading': 'Loading council settings…',
  'status.unavailable': 'This deployment does not expose council settings.',
  'view.council': 'Council',
  'onlyMapReduce': 'The council graph is available in Map-Reduce mode.',
  'noRuns': 'No council run yet. Send a task to start one.',
  'tokens': '{n} tokens',
  'status.running': 'running',
  'status.completed': 'done',
  'status.failed': 'failed',
  'status.cancelled': 'cancelled',
  'status.interrupted': 'interrupted',
}

/** Chinese copy; must cover exactly {@link en}'s key set. */
export const zh: typeof en = {
  'title': '议事会',
  'description': '有多少成员审查任务、多少成员复核每条发现，以及确认一条发现需要什么。',
  'defaultPreset': '默认预设',
  'width': '{n} 名成员',
  'count': '副本数',
  'model': '模型',
  'modelInherit': '继承',
  'quorum': '法定人数',
  'threshold': '需要',
  'overridden': '已覆盖',
  'resetPreset': '重置此预设',
  'discard': '放弃',
  'save': '保存',
  'kind.map': '审查',
  'kind.verify': '复核',
  'kind.reduce': '综合',
  'quorumRule.majority': '简单多数',
  'quorumRule.unanimous': '一致同意',
  'quorumRule.threshold': '至少 N 票确认',
  'status.loading': '正在加载议事会设置…',
  'status.unavailable': '此部署未开放议事会设置。',
  'view.council': '议事会',
  'onlyMapReduce': '议事会图仅在 Map-Reduce 模式下可用。',
  'noRuns': '尚无议事会运行。发送任务即可开始。',
  'tokens': '{n} tokens',
  'status.running': '运行中',
  'status.completed': '完成',
  'status.failed': '失败',
  'status.cancelled': '已取消',
  'status.interrupted': '已中断',
}

/** Every key this namespace serves. */
export type CouncilKey = keyof typeof en
