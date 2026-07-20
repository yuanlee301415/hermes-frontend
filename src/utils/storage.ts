/*
* 本地存储(localStorage)
* - 键名常量
* - 读取
* - 设置
* */
const ACTIVE_PROFILE_NAME_KEY = 'hermes_active_profile_name'

// 获取当前 ProfileName
export function getActiveProfileName() {
  return localStorage.getItem(ACTIVE_PROFILE_NAME_KEY)
}
