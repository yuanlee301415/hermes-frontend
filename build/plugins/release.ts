import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 生成 release 文件
 */
export function releasePlugin(__APP_RELEASE__: string) {
  return {
    name: 'release-plugin',
    writeBundle() {
      const [ version, buildTime, mode ] = __APP_RELEASE__.split('@')
      const text = ['VERSION: ' + version, 'BUILD_TIME: ' + buildTime, 'MODE: ' + mode].join('\n')
      writeFileSync(resolve('dist/release'), text, 'utf-8')
      console.log(`
      \n--------------------[GenerateRelease]:: Success--------------------
      \n${text}
      \n-------------------------------------------------------------------
      `)
    },
  }
}
