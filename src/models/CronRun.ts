/*
* 运行历史 Model
* */

import { Job } from './Job.ts'

/**
 * 运行历史-单条记录 Model
 */
export class RunEntry {
  jobId: Job['id']
  // 文件名
  fileName: string
  // 运行时间
  runTime: string
  // 文件大小
  size: number

  constructor(_: RunEntry) {
    const { jobId, fileName, runTime, size } = { ..._ }
    this.jobId = jobId
    this.fileName = fileName
    this.runTime = runTime
    this.size = size
  }

  get key() {
    return `${this.jobId}/${this.fileName}`
  }

  /**
   * 批量实例化
   * @param list
   */
  static from(list?: RunEntry[]) {
    if (!list) return []
    return list.map(_ => new this(_))
  }
}

/**
 * 运行历史详情 Model
 */
export class RunDetail {
  jobId: Job['id']
  // 文件名
  fileName: string
  // 运行时间
  runTime: string
  // 内容
  content: string

  constructor(_: RunDetail) {
    const { jobId, fileName, runTime, content } = { ..._ }
    this.jobId = jobId
    this.fileName = fileName
    this.runTime = runTime
    this.content = content
  }
}
